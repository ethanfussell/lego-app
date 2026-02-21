import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  // ✅ Default ALL fetch() to be cacheable unless you explicitly set no-store.
  // This removes a common “everything becomes dynamic” footgun.
  experimental: {
    fetchCache: "force-cache",
  },
};

export default nextConfig;