import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import path from "node:path";

// Next.js searches apps/web/.env* by default. Support the repository's single root
// .env as well; platform-provided process values take precedence over file values.
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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@connectme/contracts", "@connectme/design-tokens"],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
