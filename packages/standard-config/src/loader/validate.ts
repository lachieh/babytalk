import type { StandardSchemaV1 } from "@standard-schema/spec";

import { ConfigError } from "../errors";
import type { ConfigIssue } from "../errors";

/**
 * Validate a config object against a standard-schema.
 * Returns the validated output or throws ConfigError with all issues.
 */
export const validateConfig = async <T>(
  schema: StandardSchemaV1<unknown, T>,
  config: Record<string, unknown>
): Promise<T> => {
  const result = schema["~standard"].validate(config);

  // Handle both sync and async results
  const resolved = result instanceof Promise ? await result : result;

  if (resolved.issues) {
    const issues: ConfigIssue[] = resolved.issues.map((issue) => ({
      message: issue.message,
      path:
        issue.path
          ?.map((p) => {
            if (typeof p === "object" && p !== null && "key" in p) {
              return String(p.key);
            }
            return String(p);
          })
          .join(".") ?? "",
    }));

    throw new ConfigError(issues);
  }

  return resolved.value as T;
};
