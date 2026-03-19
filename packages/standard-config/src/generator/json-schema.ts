import type { StandardJSONSchemaV1 } from "@standard-schema/spec";

/**
 * Check if a schema supports StandardJSONSchemaV1.
 */
export const supportsJsonSchema = (
  schema: unknown
): schema is StandardJSONSchemaV1 =>
  typeof schema === "object" &&
  schema !== null &&
  "~standard" in schema &&
  typeof (schema as StandardJSONSchemaV1)["~standard"].jsonSchema ===
    "object" &&
  (schema as StandardJSONSchemaV1)["~standard"].jsonSchema !== null;

/**
 * Extract JSON Schema from a standard-schema object that implements
 * StandardJSONSchemaV1. Returns the JSON Schema as a plain object.
 */
export const extractJsonSchema = (
  schema: StandardJSONSchemaV1
): Record<string, unknown> => {
  const { jsonSchema } = schema["~standard"];

  if (!jsonSchema) {
    throw new Error(
      "Schema does not support StandardJSONSchemaV1. " +
        "Ensure your schema library supports the ~standard.jsonSchema interface. " +
        "Compatible libraries include Zod 4+ and Valibot 1+."
    );
  }

  return jsonSchema.input({ target: "draft-2020-12" }) as Record<
    string,
    unknown
  >;
};

/**
 * Format JSON Schema as a pretty-printed JSON string with a $schema field.
 */
export const formatJsonSchema = (schema: Record<string, unknown>): string => {
  const output = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    ...schema,
  };

  return `${JSON.stringify(output, null, 2)}\n`;
};
