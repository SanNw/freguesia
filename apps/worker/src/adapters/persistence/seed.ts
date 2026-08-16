import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { db } from "./db.js";

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const seedPath = join(
    here,
    "..",
    "..",
    "..",
    "..",
    "database",
    "seeds",
    "001-sources.sql",
  );
  const seed = readFileSync(seedPath, "utf-8");
  await db.query(seed);
  console.log("Seed applied successfully");
  await db.close();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
