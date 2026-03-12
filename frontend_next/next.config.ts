// frontend_next/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
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
      {
        source: "/login",
        destination: "/sign-in",
        permanent: true,
      },
      {
        source: "/signup",
        destination: "/sign-up",
        permanent: true,
      },
    ];
  },

  images: {
    // Skip Next.js image optimization — Render's limited resources cause timeouts
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    qualities: [75, 85],
    minimumCacheTTL: 86400, // cache optimized images for 24 hours
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 320, 360, 420],
    deviceSizes: [320, 360, 384, 420, 640, 750, 828, 1080, 1200],

    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.rebrickable.com",
        pathname: "/media/**",
      },
      // LEGO.com CDN domains (for admin-pasted image URLs)
      {
        protocol: "https",
        hostname: "www.lego.com",
        pathname: "/cdn/**",
      },
      {
        protocol: "https",
        hostname: "assets.lego.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.brickset.com",
        pathname: "/**",
      },
      // Dev-only: allow local backend images
      ...(process.env.NODE_ENV !== "production"
        ? [
            {
              protocol: "http" as const,
              hostname: "localhost",
              pathname: "/**",
            },
            {
              protocol: "http" as const,
              hostname: "127.0.0.1",
              pathname: "/**",
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;