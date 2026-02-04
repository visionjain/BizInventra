import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.BUILD_MODE === 'android' ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  // Disable server-side features when building for Android
  ...(process.env.BUILD_MODE === 'android' && {
    trailingSlash: true,
    skipTrailingSlashRedirect: true,
  })
};

export default nextConfig;
