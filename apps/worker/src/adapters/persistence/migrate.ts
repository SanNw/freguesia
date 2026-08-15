import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "./db.js";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const schemaPath = join(here, "..", "..", "..", "..", "database", "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  await db.query(schema);
  console.log("Migrations applied successfully");
  await db.close();
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
