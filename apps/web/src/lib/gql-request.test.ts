/* How gqlRequest tells a refusal (do not resend) from a failure (resend),
 * and when it refreshes the session. */

vi.mock(import("./runtime-config"), () => ({
  getApiUrl: () => "https://api.test/graphql",
  getRuntimeConfig: () => ({ apiUrl: "https://api.test/graphql" }) as never,
  loadRuntimeConfig: () => Promise.resolve() as never,
}));

const QUERY = 'mutation { deleteEvent(id: "x") }';

type Answer = () => Response;

const answers = (...queue: Answer[]) => {
  const calls: { authorization: string | null; body: string }[] = [];
  vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
    calls.push({
      authorization: new Headers(init.headers).get("Authorization"),
      body: String(init.body),
    });
    const next = queue.shift();
    if (!next) throw new TypeError("offline");
    return Promise.resolve(next());
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

const load = async () => {
  vi.resetModules();
  const items = new Map<string, string>([
    ["bubsie_token", "token-1"],
    ["bubsie_refresh_token", "refresh-1"],
  ]);
  vi.stubGlobal("window", {
    location: { href: "", pathname: "/", search: "" },
  });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => items.get(key) ?? null,
    removeItem: (key: string) => items.delete(key),
    setItem: (key: string, value: string) => items.set(key, value),
  });
  return await import("./gql-request");
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
});
