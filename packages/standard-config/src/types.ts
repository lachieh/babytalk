import type { StandardSchemaV1 } from "@standard-schema/spec";

export interface ConfigDefinition<T> {
  /** Config file prefix, e.g. "app" => app.config.yaml */
  prefix: string;
  /** Schema for validation (any standard-schema@1.1 compatible) */
  schema: StandardSchemaV1<unknown, T>;
  /** Root directory for file discovery. Default: process.cwd() */
  root?: string;
  /** Env var separator. Default: "_" */
  separator?: string;
  /** Key paths exposed as public config */
  public?: string[];
  /** Public env var prefix, e.g. "NEXT_PUBLIC_" */
  publicPrefix?: string;
  /** Custom env var name mapping callback */
  envMap?: (keyPath: string) => string | null | undefined;
}
