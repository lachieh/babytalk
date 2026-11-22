#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const webDir = path.resolve(repoRoot, "apps/web");
const iconsDir = path.resolve(webDir, "public/icons");

const renders = [
  { out: "icon-192.png", size: 192, src: "icon.svg" },
  { out: "icon-512.png", size: 512, src: "icon.svg" },
  { out: "favicon-32.png", size: 32, src: "icon-small.svg" },
  { out: "favicon-16.png", size: 16, src: "icon-small.svg" },
  { out: "icon-192-maskable.png", size: 192, src: "icon-maskable.svg" },
  { out: "icon-512-maskable.png", size: 512, src: "icon-maskable.svg" },
  { out: "apple-touch-icon.png", size: 180, src: "icon-maskable.svg" },
];

const SOURCE_SIZE = 512;

const hasRsvg = spawnSync("rsvg-convert", ["--version"]).error === undefined;

const loadSharp = () => {
  const fromWeb = createRequire(path.join(webDir, "package.json"));
  return createRequire(fromWeb.resolve("next/package.json"))("sharp");
};

const rasterizeWithRsvg = (src, out, size) => {
  const result = spawnSync(
    "rsvg-convert",
    ["-w", String(size), "-h", String(size), src, "-o", out],
    { stdio: "inherit" }
  );
  if (result.status !== 0) {
    throw new Error(`rsvg-convert failed: ${src} -> ${out}`);
  }
};

const rasterizeWithSharp = async (sharp, src, out, size) => {
  await sharp(src, { density: (72 * size) / SOURCE_SIZE })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
};

const sharp = hasRsvg ? null : loadSharp();
console.log(`Rendering icon set with ${hasRsvg ? "rsvg-convert" : "sharp"}...`);
for (const { src, out, size } of renders) {
  const srcPath = path.join(iconsDir, src);
  const outPath = path.join(iconsDir, out);
  if (hasRsvg) {
    rasterizeWithRsvg(srcPath, outPath, size);
  } else {
    await rasterizeWithSharp(sharp, srcPath, outPath, size);
  }
  console.log(`  ${path.relative(repoRoot, outPath)} (${size}x${size})`);
}
