import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname, // <-- forces turbopack to treat frontend_next as the root
  },
};

export default nextConfig;
