import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@babytalk/db",
    "@babytalk/standard-config",
    "@babytalk/zpages",
  ],
};

export default nextConfig;
