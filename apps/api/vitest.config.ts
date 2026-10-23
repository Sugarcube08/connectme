import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";
import { isValidMySqlUrl } from "./src/config/mysql-url";

// Load workspace and root env files before importing API/Prisma. Shell, CI, and
// hosting-platform environment variables stay authoritative; empty template
// placeholders fall back to a non-empty value from the root file.
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
  path.resolve(process.cwd(), "../../.env"),
]) {
  loadEnvFallback(candidate);
}

// API integration tests delete rows. Prefer TEST_DATABASE_URL and never silently
// run destructive tests against a non-test database.
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (testDatabaseUrl && !isValidMySqlUrl(testDatabaseUrl)) {
  throw new Error("TEST_DATABASE_URL must be a valid MySQL URL. Percent-encode reserved characters in URL components.");
}
if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
} else {
  const configuredUrl = process.env.DATABASE_URL?.trim();
  if (!configuredUrl) {
    throw new Error("Set TEST_DATABASE_URL to an isolated MySQL test database before running API tests.");
  }
  if (!isValidMySqlUrl(configuredUrl)) {
    throw new Error("DATABASE_URL must be a valid MySQL URL. Set TEST_DATABASE_URL to a MySQL database ending in _test.");
  }
  let databaseName = "";
  try {
    databaseName = decodeURIComponent(new URL(configuredUrl).pathname.replace(/^\//, ""));
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
if (!process.env.ACCESS_CODE_PEPPER?.trim()) process.env.ACCESS_CODE_PEPPER = randomBytes(32).toString("hex");
if (!process.env.ACCESS_CODE_ENCRYPTION_KEY?.trim()) process.env.ACCESS_CODE_ENCRYPTION_KEY = randomBytes(32).toString("hex");

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 20000,
    fileParallelism: false,
  },
});
