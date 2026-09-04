import type { NextConfig } from "next";

function backendOrigin(): string {
  const raw =
    process.env.API_BASE_URL ||
    process.env.NSE_API_URL ||
    "http://127.0.0.1:8080";
  return raw.replace(/\/$/, "");
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backend = backendOrigin();
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backend}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
