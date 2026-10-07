import type { NextConfig } from "next";

// Public config is served at runtime from /.well-known/config, so one image
// works for any deployment. Nothing environment-specific is baked into the build.
const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@bubsie/db",
    "@bubsie/standard-config",
    "@bubsie/zpages",
  ],
  turbopack: {
    rules: {
      "**/config.ts": {
        as: "*.ts",
        condition: { not: "foreign" },
        loaders: ["@bubsie/standard-config/loader"],
      },
    },
  },
};

export default nextConfig;
