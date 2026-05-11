#!/usr/bin/env node
// Renders SVG icons to the PWA PNG set using rsvg-convert.
//
// Usage:
//   node scripts/render-icons.mjs            # rebuild production icon set
//   node scripts/render-icons.mjs variations # render preview PNGs for every
//                                            # SVG in icons/variations/
//   node scripts/render-icons.mjs all        # both
//
// Requires librsvg2-bin (provides rsvg-convert).

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const iconsDir = path.resolve(repoRoot, "apps/web/public/icons");
const variationsDir = path.resolve(iconsDir, "variations");
const previewsDir = path.resolve(variationsDir, "previews");

const productionRenders = [
  { src: "icon.svg", out: "icon-192.png", size: 192 },
  { src: "icon.svg", out: "icon-512.png", size: 512 },
  { src: "icon.svg", out: "apple-touch-icon.png", size: 180 },
  { src: "icon.svg", out: "favicon-32.png", size: 32 },
  { src: "icon.svg", out: "favicon-16.png", size: 16 },
  { src: "icon-maskable.svg", out: "icon-192-maskable.png", size: 192 },
  { src: "icon-maskable.svg", out: "icon-512-maskable.png", size: 512 },
];

const variationSizes = [512, 192];

const rasterize = (src, out, size) => {
  const result = spawnSync(
    "rsvg-convert",
    ["-w", String(size), "-h", String(size), src, "-o", out],
    { stdio: "inherit" }
  );
  if (result.error?.code === "ENOENT") {
    console.error(
      "rsvg-convert not found. Install librsvg2-bin (apt-get install -y librsvg2-bin)."
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`Failed: ${src} -> ${out}`);
    process.exit(result.status ?? 1);
  }
  console.log(`  ${path.relative(repoRoot, out)} (${size}x${size})`);
};

const renderProduction = () => {
  console.log("Rendering production icon set...");
  for (const { src, out, size } of productionRenders) {
    rasterize(path.join(iconsDir, src), path.join(iconsDir, out), size);
  }
};

const renderVariations = () => {
  if (!existsSync(variationsDir)) {
    console.error(`No variations directory at ${variationsDir}`);
    process.exit(1);
  }
  mkdirSync(previewsDir, { recursive: true });
  const svgs = readdirSync(variationsDir).filter((f) => f.endsWith(".svg"));
  if (svgs.length === 0) {
    console.log("No variation SVGs found.");
    return;
  }
  console.log(`Rendering ${svgs.length} variation(s)...`);
  for (const svg of svgs) {
    const base = path.basename(svg, ".svg");
    for (const size of variationSizes) {
      rasterize(
        path.join(variationsDir, svg),
        path.join(previewsDir, `${base}-${size}.png`),
        size
      );
    }
  }
};

const mode = process.argv[2] ?? "production";
if (mode === "variations") {
  renderVariations();
} else if (mode === "all") {
  renderProduction();
  renderVariations();
} else {
  renderProduction();
}
