import { buildEnvVarMap, scanEnvVars } from "../src/loader/env";

describe(scanEnvVars, () => {
  it("scans matching prefix vars (flat keys with word separator)", () => {
    const env = {
      APP_HOST: "localhost",
      APP_PORT: "3000",
      OTHER_VAR: "ignored",
    };

    const result = scanEnvVars({ prefix: "APP" }, env);
    expect(result).toStrictEqual({ host: "localhost", port: 3000 });
  });

  it("preserves underscores in flat keys (word separator)", () => {
    const env = {
      APP_API_URL: "https://api.example.com",
      APP_TAMBO_API_KEY: "secret123",
    };

    const result = scanEnvVars({ prefix: "APP" }, env);
    expect(result).toStrictEqual({
      api_url: "https://api.example.com",
      tambo_api_key: "secret123",
    });
  });

  it("maps nested keys via double-underscore nesting separator", () => {
    const env = {
      APP__DATABASE__HOST: "db.local",
      APP__DATABASE__PORT: "5432",
    };

    const result = scanEnvVars({ prefix: "APP" }, env);
    expect(result).toStrictEqual({
      database: { host: "db.local", port: 5432 },
    });
  });

  it("handles nesting prefix with flat key (APP__VAR_NAME)", () => {
    const env = {
      APP__VAR_NAME: "value",
    };

    const result = scanEnvVars({ prefix: "APP" }, env);
    expect(result).toStrictEqual({ var_name: "value" });
  });

  it("handles word prefix with nested key (APP_VAR_NAME__NESTED__KEY)", () => {
    const env = {
      APP_VAR_NAME__NESTED__KEY: "deep",
    };

    const result = scanEnvVars({ prefix: "APP" }, env);
    expect(result).toStrictEqual({
      var_name: { nested: { key: "deep" } },
    });
  });

  it("uses custom nesting separator", () => {
    const env = {
      "APP---DATABASE---HOST": "db.local",
    };

    const result = scanEnvVars({ prefix: "APP", nestingSeparator: "---" }, env);
    expect(result).toStrictEqual({ database: { host: "db.local" } });
  });

  it("uses custom separator for legacy behavior", () => {
    const env = {
      APP__DATABASE__HOST: "db.local",
    };

    const result = scanEnvVars({ prefix: "APP", separator: "__" }, env);
    // With separator="__" and default nestingSeparator="__",
    // the nesting separator matches the old separator behavior
    expect(result).toStrictEqual({ database: { host: "db.local" } });
  });

  it("coerces boolean values", () => {
    const env = {
      APP_DEBUG: "true",
      APP_VERBOSE: "false",
    };

    const result = scanEnvVars({ prefix: "APP" }, env);
    expect(result).toStrictEqual({ debug: true, verbose: false });
  });

  it("coerces numeric values", () => {
    const env = {
      APP_PORT: "3000",
      APP_RATIO: "0.5",
    };

    const result = scanEnvVars({ prefix: "APP" }, env);
    expect(result).toStrictEqual({ port: 3000, ratio: 0.5 });
  });

  it("parses JSON array values", () => {
    const env = {
      APP_ORIGINS: '["http://localhost:3000","http://localhost:4000"]',
    };

    const result = scanEnvVars({ prefix: "APP" }, env);
    expect(result).toStrictEqual({
      origins: ["http://localhost:3000", "http://localhost:4000"],
    });
  });

  it("treats invalid JSON array as string", () => {
    const env = {
      APP_VALUE: "[not valid json",
    };

    const result = scanEnvVars({ prefix: "APP" }, env);
    expect(result).toStrictEqual({ value: "[not valid json" });
  });

  it("handles public prefix vars with flat keys", () => {
    const env = {
      NEXT_PUBLIC_APP_API_URL: "https://api.example.com",
    };

    const result = scanEnvVars(
      {
        prefix: "APP",
        public: ["api_url"],
        publicPrefix: "NEXT_PUBLIC_",
      },
      env
    );
    expect(result).toStrictEqual({ api_url: "https://api.example.com" });
  });

  it("handles public prefix vars with nested keys", () => {
    const env = {
      NEXT_PUBLIC_APP__API__URL: "https://api.example.com",
    };

    const result = scanEnvVars(
      {
        prefix: "APP",
        public: ["api.url"],
        publicPrefix: "NEXT_PUBLIC_",
      },
      env
    );
    expect(result).toStrictEqual({ api: { url: "https://api.example.com" } });
  });

  it("ignores public prefix vars for non-public paths", () => {
    const env = {
      NEXT_PUBLIC_APP_SECRET: "should-be-ignored",
    };

    const result = scanEnvVars(
      {
        prefix: "APP",
        public: ["api_url"],
        publicPrefix: "NEXT_PUBLIC_",
      },
      env
    );
    expect(result).toStrictEqual({});
  });

  it("applies custom envMap callback", () => {
    const env = {
      APP_PORT: "3000",
      DATABASE_URL: "postgres://localhost/mydb",
    };

    const result = scanEnvVars(
      {
        envMap: (keyPath) =>
          keyPath === "database_url" ? "DATABASE_URL" : null,
        prefix: "APP",
      },
      env
    );
    // database_url should NOT be set via APP_DATABASE_URL (default mapping)
    // because envMap overrides it to DATABASE_URL
    expect(result).toStrictEqual({ port: 3000 });
  });

  it("reads custom-mapped env var when present", () => {
    const env = {
      APP_DATABASE_URL: "should-be-ignored",
      APP_PORT: "3000",
      DATABASE_URL: "postgres://localhost/mydb",
    };

    const result = scanEnvVars(
      {
        envMap: (keyPath) =>
          keyPath === "database_url" ? "DATABASE_URL" : null,
        prefix: "APP",
      },
      env
    );
    // APP_DATABASE_URL should be skipped (envMap says the real name is DATABASE_URL)
    // DATABASE_URL doesn't match APP_ prefix so it's not scanned here
    expect(result).toStrictEqual({ port: 3000 });
  });

  it("returns empty for no matching vars", () => {
    const env = {
      OTHER_VAR: "value",
    };

    const result = scanEnvVars({ prefix: "APP" }, env);
    expect(result).toStrictEqual({});
  });

  it("keeps plain strings as strings", () => {
    const env = {
      APP_NAME: "my-app",
    };

    const result = scanEnvVars({ prefix: "APP" }, env);
    expect(result).toStrictEqual({ name: "my-app" });
  });
});

describe(buildEnvVarMap, () => {
  it("maps flat key paths to env var names", () => {
    const map = buildEnvVarMap({ prefix: "APP" }, ["port", "api_url"]);

    expect(map).toStrictEqual({
      api_url: "APP__API_URL",
      port: "APP__PORT",
    });
  });

  it("maps nested key paths to env var names with nesting separator", () => {
    const map = buildEnvVarMap({ prefix: "APP" }, [
      "port",
      "database.host",
      "database.port",
    ]);

    expect(map).toStrictEqual({
      "database.host": "APP__DATABASE__HOST",
      "database.port": "APP__DATABASE__PORT",
      port: "APP__PORT",
    });
  });

  it("includes public variants", () => {
    const map = buildEnvVarMap(
      {
        prefix: "APP",
        public: ["api_url"],
        publicPrefix: "NEXT_PUBLIC_",
      },
      ["api_url", "api_secret"]
    );

    expect(map["api_url"]).toBe("APP__API_URL");
    expect(map["public:api_url"]).toBe("NEXT_PUBLIC_APP__API_URL");
    expect(map["public:api_secret"]).toBeUndefined();
  });

  it("uses custom nesting separator", () => {
    const map = buildEnvVarMap({ prefix: "APP", nestingSeparator: "---" }, [
      "database.host",
    ]);

    expect(map["database.host"]).toBe("APP---DATABASE---HOST");
  });

  it("applies custom envMap callback", () => {
    const map = buildEnvVarMap(
      {
        envMap: (keyPath) =>
          keyPath === "database_url" ? "DATABASE_URL" : null,
        prefix: "APP",
      },
      ["database_url", "port"]
    );

    expect(map["database_url"]).toBe("DATABASE_URL");
    expect(map.port).toBe("APP__PORT");
  });
});
