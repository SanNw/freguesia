import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "../adapters/persistence/db.js";
import type { Logger } from "../config/logger.js";

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

async function removeOldFiles(directory: string): Promise<number> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    () => [],
  );
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(directory, entry.name);
    const fileStat = await stat(filePath).catch(() => null);
    if (!fileStat || Date.now() - fileStat.mtimeMs < RETENTION_MS) continue;
    await unlink(filePath);
    removed++;
  }
  return removed;
}

export async function runMaintenanceCleanup(logger: Logger) {
  const expiredOffers = await db.query<{ id: string }>(
    `UPDATE offers
     SET status = 'expired', rejection_reason = 'Expired by daily maintenance', updated_at = NOW()
     WHERE expires_at < NOW()
       AND status IN ('discovered', 'validated', 'needs_affiliate_link',
         'pending_approval', 'approved', 'scheduled')
     RETURNING id`,
  );
  const removedOauthStates = await db.query<{ state_hash: string }>(
    `DELETE FROM oauth_states WHERE expires_at < NOW() RETURNING state_hash`,
  );
  const removedScreenshots = await removeOldFiles(
    process.env.PLAYWRIGHT_SCREENSHOT_DIR || "/app/data/screenshots",
  );
  const removedTraces = await removeOldFiles(
    process.env.PLAYWRIGHT_TRACE_DIR || "/app/data/traces",
  );

  const result = {
    expiredOffers: expiredOffers.length,
    removedOauthStates: removedOauthStates.length,
    removedTemporaryFiles: removedScreenshots + removedTraces,
  };
  logger.info(result, "Daily maintenance cleanup completed");
  return result;
}
