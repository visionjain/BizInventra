import type { NextConfig } from "next";

// Production config for Vercel - includes API routes
// For Android builds, use build:android script which uses next.config.android.ts
const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
