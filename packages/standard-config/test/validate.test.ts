import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ConfigError } from "../src/errors";
import { validateConfig } from "../src/loader/validate";

describe("validateConfig", () => {
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
      expect(result).toEqual({ host: "localhost", port: 3000 });
    });

    it("throws ConfigError for invalid config", async () => {
      await expect(
        validateConfig(schema, { host: 123, port: "not-a-number" })
      ).rejects.toThrow(ConfigError);
    });

    it("collects all validation issues", async () => {
      try {
        await validateConfig(schema, { host: 123, port: "bad" });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const configErr = error as ConfigError;
        expect(configErr.issues.length).toBeGreaterThanOrEqual(2);
      }
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
      expect(result).toEqual({ host: "localhost", port: 3000 });
    });

    it("throws ConfigError for invalid config", async () => {
      await expect(
        validateConfig(schema, { port: "not-a-number" })
      ).rejects.toThrow(ConfigError);
    });
  });
});
