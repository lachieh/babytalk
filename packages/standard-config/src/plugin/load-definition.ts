import { createJiti } from "jiti";

import type { ConfigDefinition } from "../types";

/**
 * Load the config definition from a schema source file.
 * Returns the definition or null if the file can't be loaded.
 */
export const loadDefinition = async (
  schemaPath: string,
  root: string
): Promise<ConfigDefinition<unknown> | null> => {
  const jiti = createJiti(root, { interopDefault: true });
  const mod = await jiti.import(schemaPath);
  const definition = (mod as { default: ConfigDefinition<unknown> }).default;
  return definition?.prefix ? definition : null;
};
