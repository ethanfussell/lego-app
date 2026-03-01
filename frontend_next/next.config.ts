// frontend_next/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },

  images: {
    // Keep AVIF too (better compression) unless you have a reason to disable it
    formats: ["image/avif", "image/webp"],

    // allow the qualities we use in <Image quality={...}>
    qualities: [70, 75, 80],

    // Small “fixed” sizes (icons, etc). Next uses these for `w=` candidates too.
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 320, 360, 420],

    // ✅ IMPORTANT: cap responsive candidates so you don't get 1920/2048/3840 in srcset
    // Make this match the real max widths your UI ever needs.
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