import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname, // keep turbopack rooted at frontend_next
  },
};

export default nextConfig;