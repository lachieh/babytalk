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
          parts.push(`    received: ${JSON.stringify(i.received)}`);
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
