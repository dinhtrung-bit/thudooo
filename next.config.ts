import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the live dev server independent of production builds.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
