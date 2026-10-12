import { z } from "zod";

try {
  (process as any).loadEnvFile?.();
} catch {
  // Ignored if .env does not exist
}

const EnvSchema = z.object({
  PORT: z.string().default("4000").transform((val) => parseInt(val, 10)),
  DATABASE_URL: z
    .string()
    .default("postgres://postgres:postgres@localhost:5432/connectme"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  INITIAL_ADMIN_USERNAME: z.string().default("harsh"),
  SESSION_SECRET: z
    .string()
    .default("devcon-obsidian-royal-session-secret-32-chars-minimum"),
  JWT_SECRET: z
    .string()
    .default("devcon-obsidian-royal-jwt-secret-key-32-chars-minimum"),
  CORS_ORIGIN: z.string().default("http://localhost:3000,http://localhost:3001"),
  QR_CANONICAL_ORIGIN: z.string().default("http://localhost:3001"),
  MAX_IMAGE_SIZE_BYTES: z
    .string()
    .default("2097152")
    .transform((val) => parseInt(val, 10)),
  MAX_BATCH_CODE_COUNT: z
    .string()
    .default("100")
    .transform((val) => parseInt(val, 10)),
});

export const config = EnvSchema.parse(process.env);
