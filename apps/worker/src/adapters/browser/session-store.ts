import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";

export class SessionStore {
  constructor(private readonly authDir: string) {}

  pathFor(source: string): string {
    return join(this.authDir, `${source}.json`);
  }

  exists(source: string): boolean {
    return existsSync(this.pathFor(source));
  }

  load(source: string): string | null {
    const p = this.pathFor(source);
    if (!existsSync(p)) return null;
    return readFileSync(p, "utf-8");
  }

  save(source: string, storageState: string): void {
    mkdirSync(this.authDir, { recursive: true });
    writeFileSync(this.pathFor(source), storageState, { mode: 0o600 });
  }

  delete(source: string): void {
    const p = this.pathFor(source);
    if (existsSync(p)) {
      unlinkSync(p);
    }
  }
}
