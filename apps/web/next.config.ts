import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@connectme/contracts", "@connectme/design-tokens"],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
