#!/usr/bin/env node
import { parseArgs } from "node:util";

import { generate } from "./generator/core.js";

const { values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { short: "h", type: "boolean" },
    "output-json": {
      default: "./src/config.schema.json",
      type: "string",
    },
    "output-ts": { default: "./src/config.gen.ts", type: "string" },
    root: { default: process.cwd(), type: "string" },
    schema: { default: "./src/config.ts", type: "string" },
  },
  strict: false,
});

if (values.help) {
  console.log(`
Usage: standard-config generate [options]

Options:
  --schema <path>       Path to schema source file (default: ./src/config.ts)
  --output-ts <path>    Output path for .gen.ts (default: ./src/config.gen.ts)
  --output-json <path>  Output path for .schema.json (default: ./src/config.schema.json)
  --root <path>         Root directory (default: cwd)
  -h, --help            Show this help message
`);
  process.exit(0);
}

const main = async (): Promise<void> => {
  const result = await generate({
    outputJson: values["output-json"] as string,
    outputTs: values["output-ts"] as string,
    root: values.root as string,
    schema: values.schema as string,
  });

  console.log(`Generated: ${result.tsPath}`);
  if (result.jsonPath) {
    console.log(`Generated: ${result.jsonPath}`);
  }
};

try {
  await main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
