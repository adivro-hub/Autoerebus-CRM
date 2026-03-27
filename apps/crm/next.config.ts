import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@autoerebus/ui",
    "@autoerebus/database",
    "@autoerebus/types",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
