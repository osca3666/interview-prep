import type { NextConfig } from "next";

const isPlaywright =
  process.env.PLAYWRIGHT_TEST === "1" || process.env.PLAYWRIGHT_E2E === "1";

const nextConfig: NextConfig = {
  distDir: isPlaywright ? ".next-playwright" : ".next",
  devIndicators: isPlaywright ? false : undefined,
};

export default nextConfig;
