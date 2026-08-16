import { Pool, type PoolClient } from "pg";
import { env } from "../../config/env.js";

export class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      min: env.DATABASE_POOL_MIN,
      max: env.DATABASE_POOL_MAX,
      statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
    });
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]> {
    const result = await this.pool.query<T>(text, params);
    return result.rows;
  }

  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const db = new Database();
