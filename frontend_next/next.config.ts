// frontend_next/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },

  // Redirect any /new?period=... (or any query) back to canonical /new
  async redirects() {
    return [
      {
        source: "/new",
        has: [{ type: "query", key: "period" }],
        destination: "/new",
        permanent: true,
      },
    ];
  },

  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [70, 75, 80],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 320, 360, 420],
    deviceSizes: [320, 360, 384, 420, 640, 750, 828, 1080, 1200],

    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.rebrickable.com",
        pathname: "/media/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;