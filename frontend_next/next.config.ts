import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname, // keep turbopack rooted at frontend_next
  },

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Rebrickable CDN (prod)
      {
        protocol: "https",
        hostname: "cdn.rebrickable.com",
        pathname: "/media/**",
      },

      // Local dev convenience (optional but nice)
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;