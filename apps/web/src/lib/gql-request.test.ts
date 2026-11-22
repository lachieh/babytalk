/* How gqlRequest tells a refusal (do not resend) from a failure (resend),
 * and when it refreshes the session. */

vi.mock(import("./runtime-config"), () => ({
  getApiUrl: () => "https://api.test/graphql",
  getRuntimeConfig: () => ({ apiUrl: "https://api.test/graphql" }) as never,
  loadRuntimeConfig: () => Promise.resolve() as never,
}));

const QUERY = 'mutation { deleteEvent(id: "x") }';

type Answer = (init: RequestInit) => Response | Promise<Response>;

const answers = (...queue: Answer[]) => {
  const calls: { authorization: string | null; body: string }[] = [];
  vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
    calls.push({
      authorization: new Headers(init.headers).get("Authorization"),
      body: String(init.body),
    });
    const next = queue.shift();
    if (!next) return Promise.reject(new TypeError("offline"));
    try {
      return Promise.resolve(next(init));
    } catch (error) {
      return Promise.reject(error);
    }
  });
  return calls;
};

const json =
  (value: unknown, status = 200) =>
  () =>
    Response.json(value, { status });
const text = (body: string, status: number) => () =>
  new Response(body, { status });

const refreshed = json({
  data: { refreshToken: { refreshToken: "refresh-2", token: "token-2" } },
});

const unreachable: Answer = () => {
  throw new TypeError("Failed to fetch");
};

const load = async () => {
  vi.resetModules();
  const items = new Map<string, string>([
    ["bubsie_token", "token-1"],
    ["bubsie_refresh_token", "refresh-1"],
  ]);
  const page = { location: { href: "", pathname: "/", search: "" } };
  vi.stubGlobal("window", page);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => items.get(key) ?? null,
    removeItem: (key: string) => items.delete(key),
    setItem: (key: string, value: string) => items.set(key, value),
  });
  return { ...(await import("./gql-request")), items, page };
};

const signInAs = (items: Map<string, string>, who: string) => {
  items.set("bubsie_token", `${who}-token`);
  items.set("bubsie_refresh_token", `${who}-refresh`);
};

type RefreshLockTask = (lock: { name: string }) => Promise<unknown>;

/** Web Locks that grant in order and honour an abort while waiting. */
const fifoLocks = () => {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    request: (
      name: string,
      optionsOrTask: { signal?: AbortSignal } | RefreshLockTask,
      maybeTask?: RefreshLockTask
    ) => {
      const task = (maybeTask ?? optionsOrTask) as RefreshLockTask;
      const options = maybeTask
        ? (optionsOrTask as { signal?: AbortSignal })
        : {};
      const previous = tail;
      const released = Promise.withResolvers<null>();
      tail = previous.then(() => released.promise);
      const result = Promise.withResolvers<unknown>();
      let granted = false;
      options.signal?.addEventListener("abort", () => {
        if (!granted) result.reject(new DOMException("aborted", "AbortError"));
      });
      void previous.then(async () => {
        if (options.signal?.aborted) {
          released.resolve(null);
          return;
        }
        granted = true;
        try {
          result.resolve(await task({ name }));
        } catch (error) {
          result.reject(error);
        } finally {
          released.resolve(null);
        }
      });
      return result.promise;
    },
  };
};

const hangs: Answer = ({ signal }) => {
  const pending = Promise.withResolvers<Response>();
  signal?.addEventListener("abort", () =>
    pending.reject(new DOMException("aborted", "AbortError"))
  );
  return pending.promise;
};

const settleWithin = async <T>(promise: Promise<T>, ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
  const waiting = Symbol("waiting");
  const value = await Promise.race([promise, Promise.resolve(waiting)]);
  return value === waiting ? { settled: false } : { settled: true, value };
};

describe("gqlRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls a refusal a refusal, keeping the message", async () => {
    const { RequestRefusedError, gqlRequest } = await load();
    answers(
      json({
        data: null,
        errors: [
          { extensions: { code: "REFUSED" }, message: "Event not found" },
        ],
      })
    );
    const request = gqlRequest(QUERY);
    await expect(request).rejects.toBeInstanceOf(RequestRefusedError);
    await expect(request).rejects.toThrow("Event not found");
  });

  it("calls a malformed request a refusal", async () => {
    const { RequestRefusedError, gqlRequest } = await load();
    answers(
      json(
        {
          errors: [
            {
              extensions: { code: "GRAPHQL_VALIDATION_FAILED" },
              message: "Unknown argument",
            },
          ],
        },
        400
      )
    );
    await expect(gqlRequest(QUERY)).rejects.toBeInstanceOf(RequestRefusedError);
  });

  it.each([
    [
      "a server error reported as GraphQL errors",
      json({
        data: null,
        errors: [
          {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
            message: "Unexpected error.",
          },
        ],
      }),
    ],
    [
      "an error with no code",
      json({ data: null, errors: [{ message: "Failed query: select …" }] }),
    ],
    [
      "a 503 with GraphQL-shaped errors",
      json({ errors: [{ message: "Service unavailable" }] }, 503),
    ],
    ["a 502 that is not JSON", text("<html>Bad gateway</html>", 502)],
  ])("does not call %s a refusal", async (_name, answer) => {
    const { RequestRefusedError, gqlRequest } = await load();
    answers(answer);
    const request = gqlRequest(QUERY);
    await expect(request).rejects.toThrow(Error);
    await expect(request).rejects.not.toBeInstanceOf(RequestRefusedError);
  });

  it.each([
    ["a 401 that is not JSON", text("Unauthorized", 401)],
    ["a 401 with a plain body", json({ message: "Unauthorized" }, 401)],
    [
      "an UNAUTHENTICATED error",
      json({
        errors: [
          {
            extensions: { code: "UNAUTHENTICATED" },
            message: "Not authenticated",
          },
        ],
      }),
    ],
  ])(
    "refreshes the session after %s and tries again",
    async (_name, answer) => {
      const { gqlRequest } = await load();
      const calls = answers(
        answer,
        refreshed,
        json({ data: { deleteEvent: true } })
      );
      await expect(gqlRequest(QUERY)).resolves.toStrictEqual({
        deleteEvent: true,
      });
      expect(calls.at(-1)?.authorization).toBe("Bearer token-2");
    }
  );

  describe("a refresh that cannot reach the server", () => {
    it.each([
      ["a network error", unreachable],
      ["a 503", json({ errors: [{ message: "Service unavailable" }] }, 503)],
      [
        "a masked server error",
        json({
          data: { refreshToken: null },
          errors: [
            {
              extensions: { code: "INTERNAL_SERVER_ERROR" },
              message: "Unexpected error.",
            },
          ],
        }),
      ],
    ])(
      "keeps the session after %s and fails the request as retryable",
      async (_name, answer) => {
        const { RequestRefusedError, gqlRequest, items, page } = await load();
        answers(text("Unauthorized", 401), answer);
        const request = gqlRequest(QUERY);
        await expect(request).rejects.toThrow(Error);
        await expect(request).rejects.not.toBeInstanceOf(RequestRefusedError);
        expect(items.get("bubsie_refresh_token")).toBe("refresh-1");
        expect(page.location.href).toBe("");
      }
    );

    it("lets the app open during an outage without signing out", async () => {
      const { items, restoreSession } = await load();
      answers(unreachable);
      await expect(restoreSession()).resolves.toBeTruthy();
      expect(items.get("bubsie_refresh_token")).toBe("refresh-1");
    });
  });

  describe("a refresh the server rejects", () => {
    it.each([
      [
        "with a refusal",
        json({
          data: { refreshToken: null },
          errors: [
            {
              extensions: { code: "REFUSED" },
              message: "Refresh token rejected",
            },
          ],
        }),
      ],
      [
        "with no session (older server)",
        json({ data: { refreshToken: null } }),
      ],
    ])("ends the session %s", async (_name, answer) => {
      const { gqlRequest, items, page } = await load();
      answers(text("Unauthorized", 401), answer);
      await expect(gqlRequest(QUERY)).rejects.toThrow(Error);
      expect(items.has("bubsie_refresh_token")).toBeFalsy();
      expect(page.location.href).toContain("/auth/login");
    });

    it("sends the app to sign in when it opens with a rejected session", async () => {
      const { items, restoreSession } = await load();
      answers(json({ data: { refreshToken: null } }));
      await expect(restoreSession()).resolves.toBeFalsy();
      expect(items.has("bubsie_token")).toBeFalsy();
    });
  });

  describe("signing out while a refresh is in flight", () => {
    it("keeps the refresh from storing credentials or retrying the request", async () => {
      const { gqlRequest, items, signOut } = await load();
      const slow = Promise.withResolvers<Response>();
      const calls = answers(
        text("Unauthorized", 401),
        () => slow.promise,
        json({ data: { deleteEvent: true } })
      );
      const request = gqlRequest(QUERY);
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
      signOut();
      slow.resolve(refreshed());
      await expect(request).rejects.toThrow(Error);
      expect(items.has("bubsie_token")).toBeFalsy();
      expect(items.has("bubsie_refresh_token")).toBeFalsy();
      expect(calls).toHaveLength(2);
    });
  });

  describe("which session a request belongs to", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("never retries an old request as the next person, even if the clock went back", async () => {
      vi.useFakeTimers({
        now: new Date("2026-11-22T10:00:00Z"),
        toFake: ["Date"],
      });
      const { gqlRequest, items, signOut } = await load();
      const slow = Promise.withResolvers<Response>();
      const calls = answers(
        text("Unauthorized", 401),
        () => slow.promise,
        json({ data: { deleteEvent: true } })
      );
      const request = gqlRequest(QUERY);
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
      vi.setSystemTime(new Date("2026-11-22T09:00:00Z"));
      signOut();
      signInAs(items, "next-person");
      slow.resolve(refreshed());
      await expect(request).rejects.toThrow(Error);
      expect(calls.map((c) => c.authorization)).not.toContain(
        "Bearer next-person-token"
      );
      expect(items.get("bubsie_token")).toBe("next-person-token");
    });

    it("lets a new session start at once after a sign-out stamped in the future", async () => {
      vi.useFakeTimers({
        now: new Date("2026-11-22T11:00:00Z"),
        toFake: ["Date"],
      });
      const { items, restoreSession, signOut } = await load();
      signOut();
      vi.setSystemTime(new Date("2026-11-22T10:00:00Z"));
      signInAs(items, "returning");
      const calls = answers(refreshed);
      await expect(restoreSession()).resolves.toBeTruthy();
      expect(calls).toHaveLength(1);
    });

    it("does not continue a session that ended while its refresh failed", async () => {
      const { restoreSession, signOut } = await load();
      const slow = Promise.withResolvers<Response>();
      answers(() => slow.promise);
      const restoring = restoreSession();
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
      signOut();
      slow.reject(new TypeError("Failed to fetch"));
      await expect(restoring).resolves.toBeFalsy();
    });
  });

  describe("a refresh that stalls", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("gives up waiting for another tab's stalled refresh, keeps the session, and starts no second one", async () => {
      vi.useFakeTimers();
      const { items, restoreSession } = await load();
      const blocked = fifoLocks();
      void blocked.request(
        "bubsie-session-refresh",
        {},
        () => Promise.withResolvers<null>().promise
      );
      vi.stubGlobal("navigator", { locks: blocked });
      const calls = answers(refreshed);
      await expect(
        settleWithin(restoreSession(), 60_000)
      ).resolves.toStrictEqual({ settled: true, value: true });
      expect(calls).toHaveLength(0);
      expect(items.get("bubsie_refresh_token")).toBe("refresh-1");
    });

    it("bounds its own request, then lets the next refresh through", async () => {
      vi.useFakeTimers();
      const { items, restoreSession } = await load();
      vi.stubGlobal("navigator", { locks: fifoLocks() });
      answers(hangs, refreshed);
      await expect(
        settleWithin(restoreSession(), 60_000)
      ).resolves.toStrictEqual({ settled: true, value: true });
      expect(items.get("bubsie_refresh_token")).toBe("refresh-1");
      await expect(
        settleWithin(restoreSession(), 60_000)
      ).resolves.toStrictEqual({ settled: true, value: true });
      expect(items.get("bubsie_refresh_token")).toBe("refresh-2");
    });
  });
});
