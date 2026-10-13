import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { isValidMySqlUrl } from "./mysql-url";

import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import path from "node:path";

// Respect process/Vercel/CI variables first. For files, a non-empty workspace-local
// value wins; an empty template placeholder falls back to the root .env.
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

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL must be provided; there are no default database credentials.")
    .refine(
      isValidMySqlUrl,
      "DATABASE_URL must be mysql://USER:PASSWORD@HOST:3306/DATABASE; percent-encode reserved characters in URL components."
    ),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // No fallback values: generate independent random values per environment.
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters."),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters."),
  MAX_IMAGE_SIZE_BYTES: z.coerce.number().int().positive().default(2097152),
  MAX_BATCH_CODE_COUNT: z.coerce.number().int().min(1).max(100).default(100),
});

const parsed = EnvSchema.parse(process.env);

export const config = parsed;
