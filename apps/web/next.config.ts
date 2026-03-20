import { webpack as standardConfig } from "@babytalk/standard-config/webpack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@babytalk/db",
    "@babytalk/standard-config",
    "@babytalk/zpages",
  ],
  webpack: (config) => {
    config.plugins.push(
      standardConfig({
        schema: "./src/config.ts",
      })
    );
    return config;
  },
};

export default nextConfig;
