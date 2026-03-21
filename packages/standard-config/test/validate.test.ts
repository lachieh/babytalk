import * as v from "valibot";
import { z } from "zod";

import { ConfigError } from "../src/errors";
import { validateConfig } from "../src/loader/validate";

describe(validateConfig, () => {
  describe("with Zod", () => {
    const schema = z.object({
      host: z.string(),
      port: z.number(),
    });

    it("validates a correct config", async () => {
      const result = await validateConfig(schema, {
        host: "localhost",
        port: 3000,
      });
      expect(result).toStrictEqual({ host: "localhost", port: 3000 });
    });

    it("throws ConfigError for invalid config", async () => {
      await expect(
        validateConfig(schema, { host: 123, port: "not-a-number" })
      ).rejects.toThrow(ConfigError);
    });

    it("collects all validation issues", async () => {
      const thrown = await validateConfig(schema, {
        host: 123,
        port: "bad",
      }).catch((error: unknown) => error);
      expect(thrown).toBeInstanceOf(ConfigError);
      const configErr = thrown as ConfigError;
      expect(configErr.issues.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("with Valibot", () => {
    const schema = v.object({
      host: v.string(),
      port: v.number(),
    });

    it("validates a correct config", async () => {
      const result = await validateConfig(schema, {
        host: "localhost",
        port: 3000,
      });
      expect(result).toStrictEqual({ host: "localhost", port: 3000 });
    });

    it("throws ConfigError for invalid config", async () => {
      await expect(
        validateConfig(schema, { port: "not-a-number" })
      ).rejects.toThrow(ConfigError);
    });
  });
});
