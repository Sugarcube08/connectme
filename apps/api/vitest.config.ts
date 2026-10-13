import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Load the developer's configured monorepo .env before tests import the API/Prisma.
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

// Ephemeral test-only signing keys. Production config has no secret fallbacks.
process.env.NODE_ENV = "test";
process.env.SESSION_SECRET ??= randomBytes(32).toString("hex");
process.env.JWT_SECRET ??= randomBytes(32).toString("hex");

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 20000,
  },
});
