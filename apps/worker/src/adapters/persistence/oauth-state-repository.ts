import { createHash } from "node:crypto";
import { db } from "./db.js";

function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

class OauthStateRepository {
  async save(
    provider: string,
    state: string,
    codeVerifier: string,
  ): Promise<void> {
    await db.query(
      `INSERT INTO oauth_states (provider, state_hash, code_verifier, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
      [provider, hashState(state), codeVerifier],
    );
  }

  async consume(provider: string, state: string): Promise<string | null> {
    const rows = await db.query<{ code_verifier: string }>(
      `DELETE FROM oauth_states
       WHERE provider = $1 AND state_hash = $2 AND expires_at > NOW()
       RETURNING code_verifier`,
      [provider, hashState(state)],
    );
    return rows[0]?.code_verifier ?? null;
  }
}

export const oauthStateRepository = new OauthStateRepository();
