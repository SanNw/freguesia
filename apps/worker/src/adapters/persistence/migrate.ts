import { db } from "./db.js";

async function main() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS integration_credentials (
      provider TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_type TEXT NOT NULL DEFAULT 'bearer',
      scope TEXT,
      external_user_id TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS oauth_states (
      provider TEXT NOT NULL,
      state_hash TEXT NOT NULL,
      code_verifier TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (provider, state_hash)
    )
  `);
  await db.query(`DELETE FROM oauth_states WHERE expires_at <= NOW()`);
  await db.query(
    `ALTER TABLE approvals ADD COLUMN IF NOT EXISTS idempotency_key TEXT`,
  );
  await db.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_approvals_idempotency_key ON approvals(idempotency_key) WHERE idempotency_key IS NOT NULL`,
  );
  console.log("Integration credential migrations applied.");
  await db.close();
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
