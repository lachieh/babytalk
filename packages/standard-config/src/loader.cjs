/**
 * Webpack/Turbopack loader that triggers standard-config code generation
 * when a config source file is processed.
 *
 * Passes through the source unchanged — generation is a side effect.
 *
 * Usage in next.config.ts (Turbopack):
 *   turbopack: {
 *     rules: {
 *       'src/config.ts': {
 *         loaders: ['@babytalk/standard-config/loader'],
 *         as: '*.ts',
 *       },
 *     },
 *   },
 */
const { resolve, dirname } = require("node:path");

module.exports = function standardConfigLoader(source) {
  const callback = this.async();
  const { resourcePath } = this;
  const root = this.rootContext || process.cwd();

  (async () => {
    const { createJiti } = await import("jiti");
    const jiti = createJiti(dirname(resourcePath), { interopDefault: true });

    // Verify the file exports a valid config definition
    const mod = await jiti.import(resourcePath);
    if (!mod.default?.schema) {
      return source;
    }

    // Import the generator from source via jiti
    const { generate } = await jiti.import(
      resolve(__dirname, "./generator/core")
    );

    const result = await generate({ root, schema: resourcePath });
    console.log(`[standard-config] Generated: ${result.tsPath}`);
    if (result.jsonPath) {
      console.log(`[standard-config] Generated: ${result.jsonPath}`);
    }

    return source;
  // oxlint-disable-next-line promise/prefer-await-to-then
  })().then(
    (result) => callback(null, result)
  ).catch((error) => {
    console.error(`[standard-config] Unexpected error: ${error.message}`);
    callback(null, source);
  });
};
