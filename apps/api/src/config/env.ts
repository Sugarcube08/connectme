import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

// Support workspace-local .env files and a shared monorepo-root .env.
// Values already present in the process environment take precedence.
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

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL must be provided; there are no default database credentials."),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // No fallback values: generate independent random values per environment.
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters."),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters."),
  MAX_IMAGE_SIZE_BYTES: z.coerce.number().int().positive().default(2097152),
  MAX_BATCH_CODE_COUNT: z.coerce.number().int().min(1).max(100).default(100),
});

const parsed = EnvSchema.parse(process.env);

export const config = parsed;
