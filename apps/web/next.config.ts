import type { NextConfig } from "next";

const apiOrigin = (process.env.API_INTERNAL_URL || "http://localhost:4000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@connectme/contracts", "@connectme/design-tokens"],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  async rewrites() {
    // /api/v1/* is handled by a runtime Route Handler proxy (not a build-time rewrite)
    // so API_INTERNAL_URL can change independently of the web image.
    return [
      { source: "/health/:path*", destination: `${apiOrigin}/health/:path*` },
      { source: "/api/docs", destination: `${apiOrigin}/api/docs` },
      { source: "/api/docs/:path*", destination: `${apiOrigin}/api/docs/:path*` },
    ];
  },
};

export default nextConfig;
