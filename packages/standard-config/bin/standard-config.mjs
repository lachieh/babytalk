#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

const __dirname = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(__dirname, { interopDefault: true });
await jiti.import(resolve(__dirname, "../src/cli.ts"));
