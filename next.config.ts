import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: For Android builds, use build:android script which handles static export
  // For Vercel production, this runs normally with API routes
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
