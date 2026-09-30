import type { NextConfig } from "next";

const gateway = (process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [new URL(`${gateway}/ipfs/**`)],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
