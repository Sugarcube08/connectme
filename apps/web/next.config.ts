import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

// Next loads apps/web/.env* by default. The shared root .env is a fallback;
// process/Vercel values win, and blank template placeholders do not mask the root.
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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@connectme/api-client", "@connectme/contracts", "@connectme/design-tokens", "@connectme/validation"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
