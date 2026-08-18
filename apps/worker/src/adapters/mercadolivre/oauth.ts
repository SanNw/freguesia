import { createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors.js";
import { resilientFetch } from "../../shared/http-client.js";
import { integrationCredentialRepository } from "../persistence/integration-credential-repository.js";
import { oauthStateRepository } from "../persistence/oauth-state-repository.js";

const PROVIDER = "mercadolivre";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in: number;
  scope?: string;
  user_id?: number | string;
}

function assertConfigured(): void {
  if (
    !env.MERCADOLIVRE_CLIENT_ID ||
    !env.MERCADOLIVRE_CLIENT_SECRET ||
    !env.MERCADOLIVRE_REDIRECT_URI
  ) {
    throw new AppError(
      "SOURCE_AUTH_REQUIRED",
      "Mercado Livre OAuth credentials are not configured",
      false,
      503,
    );
  }
}

function base64Url(value: Buffer): string {
  return value.toString("base64url");
}

async function requestToken(params: URLSearchParams): Promise<TokenResponse> {
  const response = await resilientFetch(
    `${env.MERCADOLIVRE_API_BASE_URL}/oauth/token`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: params,
      source: "mercadolivre-oauth",
    },
  );
  const body = (await response.json()) as TokenResponse & {
    message?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new AppError(
      "SOURCE_AUTH_REQUIRED",
      body.error_description ?? body.message ?? "Mercado Livre OAuth failed",
      false,
      response.status,
    );
  }
  return body;
}

async function saveToken(token: TokenResponse): Promise<void> {
  await integrationCredentialRepository.save({
    provider: PROVIDER,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    tokenType: token.token_type ?? "bearer",
    scope: token.scope ?? null,
    externalUserId: token.user_id == null ? null : String(token.user_id),
    expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
  });
}

export async function createMercadoLivreAuthorizationUrl(): Promise<string> {
  assertConfigured();
  const state = base64Url(randomBytes(32));
  const codeVerifier = base64Url(randomBytes(64));
  const codeChallenge = base64Url(
    createHash("sha256").update(codeVerifier).digest(),
  );
  await oauthStateRepository.save(PROVIDER, state, codeVerifier);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.MERCADOLIVRE_CLIENT_ID,
    redirect_uri: env.MERCADOLIVRE_REDIRECT_URI,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${env.MERCADOLIVRE_AUTH_BASE_URL}/authorization?${params}`;
}

export async function completeMercadoLivreAuthorization(
  code: string,
  state: string,
): Promise<void> {
  assertConfigured();
  const codeVerifier = await oauthStateRepository.consume(PROVIDER, state);
  if (!codeVerifier) {
    throw new AppError(
      "VALIDATION_FAILED",
      "OAuth state is invalid or expired",
      false,
      400,
    );
  }
  const token = await requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: env.MERCADOLIVRE_CLIENT_ID,
      client_secret: env.MERCADOLIVRE_CLIENT_SECRET,
      code,
      redirect_uri: env.MERCADOLIVRE_REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  );
  await saveToken(token);
}

export async function getMercadoLivreAccessToken(): Promise<string> {
  assertConfigured();
  const credential = await integrationCredentialRepository.get(PROVIDER);
  if (!credential) {
    throw new AppError(
      "SOURCE_AUTH_REQUIRED",
      "Mercado Livre account is not connected",
      false,
      401,
    );
  }
  if (new Date(credential.expiresAt).getTime() > Date.now() + 60_000) {
    return credential.accessToken;
  }
  if (!credential.refreshToken) {
    throw new AppError(
      "SOURCE_AUTH_REQUIRED",
      "Mercado Livre refresh token is unavailable",
      false,
      401,
    );
  }
  const token = await requestToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.MERCADOLIVRE_CLIENT_ID,
      client_secret: env.MERCADOLIVRE_CLIENT_SECRET,
      refresh_token: credential.refreshToken,
    }),
  );
  await saveToken(token);
  return token.access_token;
}
