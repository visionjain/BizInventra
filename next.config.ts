import type { NextConfig } from "next";

// Production config with API routes for Vercel
const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
