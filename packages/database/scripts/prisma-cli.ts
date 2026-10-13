import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

// Prefer a non-empty database-workspace or API-local setting, then fall back to
// the monorepo root .env. Shell/CI/hosting-platform variables always win.
const environmentProvidedByProcess = new Set(Object.keys(process.env));

function loadEnvFallback(fileName: string): void {
  if (!existsSync(fileName)) return;
  const fileValues = parseEnv(readFileSync(fileName, "utf8"));
  for (const [key, value] of Object.entries(fileValues)) {
    if (environmentProvidedByProcess.has(key)) continue;
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

for (const candidate of [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../apps/api/.env"),
  path.resolve(process.cwd(), "../../.env"),
]) {
  loadEnvFallback(candidate);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  throw new Error("Expected Prisma CLI arguments, such as generate, migrate deploy, or migrate status.");
}
const result = spawnSync("prisma", args, {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
