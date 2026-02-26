import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow reading snapshot files from the data/ directory in server components
  serverExternalPackages: [],
  // Disable image optimization for simplicity (internal tool)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
