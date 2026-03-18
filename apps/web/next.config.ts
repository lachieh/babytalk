import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@babytalk/db", "@babytalk/zpages"],
};

export default nextConfig;
