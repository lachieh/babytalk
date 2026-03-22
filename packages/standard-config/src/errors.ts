/**
 * Redact a value for safe inclusion in error messages.
 * Shows type and length instead of the actual value to prevent secret leakage.
 */
const redactValue = (value: unknown): string => {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `[string, length=${value.length}]`;
  if (typeof value === "number") return `[number: ${value}]`;
  if (typeof value === "boolean") return `[boolean: ${value}]`;
  if (Array.isArray(value)) return `[array, length=${value.length}]`;
  if (typeof value === "object")
    return `[object, keys=${Object.keys(value).length}]`;
  return `[${typeof value}]`;
};

export interface ConfigIssue {
  path: string;
  message: string;
  expected?: string;
  received?: unknown;
  source?: string;
}

export class ConfigError extends Error {
  readonly issues: ConfigIssue[];

  constructor(issues: ConfigIssue[]) {
    const formatted = issues
      .map((i) => {
        const parts = [`  - ${i.path}: ${i.message}`];
        if (i.expected) {
          parts.push(`    expected: ${i.expected}`);
        }
        if (i.received !== undefined) {
          parts.push(`    received: ${redactValue(i.received)}`);
        }
        if (i.source) {
          parts.push(`    source: ${i.source}`);
        }
        return parts.join("\n");
      })
      .join("\n");

    super(`Config validation failed:\n${formatted}`);
    this.name = "ConfigError";
    this.issues = issues;
  }
}
