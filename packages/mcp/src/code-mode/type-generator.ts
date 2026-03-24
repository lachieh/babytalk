/**
 * Tool descriptor with enough info to generate TypeScript declarations.
 */
export interface ToolDescriptor {
  description: string;
  inputSchema: Record<string, unknown>;
  name: string;
}

const jsonSchemaToTs = (schema: Record<string, unknown>): string => {
  if (schema.enum) {
    return (schema.enum as string[]).map((v) => `"${v}"`).join(" | ");
  }

  switch (schema.type) {
    case "string": {
      return "string";
    }
    case "number":
    case "integer": {
      return "number";
    }
    case "boolean": {
      return "boolean";
    }
    case "array": {
      return `${jsonSchemaToTs(schema.items as Record<string, unknown>)}[]`;
    }
    case "object": {
      return "Record<string, unknown>";
    }
    default: {
      return "unknown";
    }
  }
};

const formatParams = (schema: Record<string, unknown>): string => {
  if (!schema || typeof schema !== "object") return "";

  const props = schema.properties as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!props) return "";

  const requiredFields = (schema.required as string[] | undefined) ?? [];
  const required = new Set<string>(requiredFields);

  return Object.entries(props)
    .map(([name, prop]) => {
      const optional = required.has(name) ? "" : "?";
      const type = jsonSchemaToTs(prop);
      return `${name}${optional}: ${type}`;
    })
    .join("; ");
};

/**
 * Generate TypeScript type declarations from tool descriptors.
 * The LLM uses these to write correctly-typed code in execute_code.
 */
export const generateTypes = (tools: ToolDescriptor[]): string => {
  const lines = [
    "// BabyTalk API — available via the `babytalk` namespace",
    "declare namespace babytalk {",
  ];

  for (const tool of tools) {
    const params = formatParams(tool.inputSchema);
    lines.push(`  /** ${tool.description} */`);
    lines.push(
      `  function ${tool.name}(args: { ${params} }): Promise<unknown>;`
    );
    lines.push("");
  }

  lines.push("}");
  return lines.join("\n");
};
