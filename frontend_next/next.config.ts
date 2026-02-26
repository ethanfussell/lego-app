import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname, // keep turbopack rooted at frontend_next
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.rebrickable.com",
        pathname: "/media/**",
      },
    ],
  },
};

export default nextConfig;