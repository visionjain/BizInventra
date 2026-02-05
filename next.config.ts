import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Always use static export for now (mainly for Capacitor)
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
