import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the WebGL map is created imperatively; a dev-only double mount just spins up a second globe
  reactStrictMode: false,
};

export default nextConfig;
