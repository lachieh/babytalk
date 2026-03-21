import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@babytalk/db",
    "@babytalk/standard-config",
    "@babytalk/zpages",
  ],
  turbopack: {
    rules: {
      "**/config.ts": {
        as: "*.ts",
        condition: { not: "foreign" },
        loaders: ["@babytalk/standard-config/loader"],
      },
    },
  },
};

export default nextConfig;
