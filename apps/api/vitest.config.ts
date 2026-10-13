import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Load the developer's monorepo .env before tests import the API/Prisma.
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

// API integration tests delete database rows. Prefer TEST_DATABASE_URL and never
// silently run them against a non-test database.
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
} else {
  const configuredUrl = process.env.DATABASE_URL?.trim();
  if (!configuredUrl) {
    throw new Error("Set TEST_DATABASE_URL to an isolated MySQL test database before running API tests.");
  }
  let databaseName = "";
  try {
    databaseName = new URL(configuredUrl).pathname.replace(/^\//, "");
  } catch {
    throw new Error("DATABASE_URL is not a valid URL. Set TEST_DATABASE_URL to a valid isolated MySQL database.");
  }
  if (!/(?:_test|_testing)$/i.test(databaseName)) {
    throw new Error("Refusing to run destructive API tests against a non-test database. Set TEST_DATABASE_URL to a database ending in _test.");
  }
  process.env.DATABASE_URL = configuredUrl;
}

process.env.NODE_ENV = "test";
if (!process.env.SESSION_SECRET?.trim()) process.env.SESSION_SECRET = randomBytes(32).toString("hex");
if (!process.env.JWT_SECRET?.trim()) process.env.JWT_SECRET = randomBytes(32).toString("hex");

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 20000,
  },
});
