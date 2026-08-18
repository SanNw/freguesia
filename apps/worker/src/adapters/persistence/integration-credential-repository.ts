import { db } from "./db.js";

export interface IntegrationCredential {
  provider: string;
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  scope: string | null;
  externalUserId: string | null;
  expiresAt: string;
}

class IntegrationCredentialRepository {
  async get(provider: string): Promise<IntegrationCredential | null> {
    const rows = await db.query<Record<string, unknown>>(
      `SELECT provider, access_token, refresh_token, token_type, scope,
        external_user_id, expires_at
       FROM integration_credentials WHERE provider = $1`,
      [provider],
    );
    if (!rows[0]) return null;
    return {
      provider: String(rows[0].provider),
      accessToken: String(rows[0].access_token),
      refreshToken:
        rows[0].refresh_token == null ? null : String(rows[0].refresh_token),
      tokenType: String(rows[0].token_type),
      scope: rows[0].scope == null ? null : String(rows[0].scope),
      externalUserId:
        rows[0].external_user_id == null
          ? null
          : String(rows[0].external_user_id),
      expiresAt: String(rows[0].expires_at),
    };
  }

  async save(input: IntegrationCredential): Promise<void> {
    await db.query(
      `INSERT INTO integration_credentials (
        provider, access_token, refresh_token, token_type, scope,
        external_user_id, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (provider) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_type = EXCLUDED.token_type,
        scope = EXCLUDED.scope,
        external_user_id = EXCLUDED.external_user_id,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()`,
      [
        input.provider,
        input.accessToken,
        input.refreshToken,
        input.tokenType,
        input.scope,
        input.externalUserId,
        input.expiresAt,
      ],
    );
  }
}

export const integrationCredentialRepository =
  new IntegrationCredentialRepository();
