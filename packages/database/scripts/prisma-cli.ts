import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

// Prisma's own .env discovery is workspace-local. Connect Me supports one root .env,
// so load it explicitly and pass the resolved variables to the Prisma CLI process.
const loadEnvFile = (process as any).loadEnvFile as
  | ((fileName?: string) => void)
  | undefined;
if (loadEnvFile) {
  for (const candidate of [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
  ]) {
    if (existsSync(candidate)) loadEnvFile(candidate);
  }
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
