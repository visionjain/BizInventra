import type { NextConfig } from "next";

// Production config: enables API routes for Vercel deployment
const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
