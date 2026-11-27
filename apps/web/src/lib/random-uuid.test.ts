import { randomUUID } from "./random-uuid";

const V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("random UUIDs", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("makes v4 UUIDs where crypto.randomUUID is missing (plain http)", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });
    const ids = new Set(Array.from({ length: 200 }, randomUUID));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(V4);
  });

  it("uses crypto.randomUUID where there is one", () => {
    expect(randomUUID()).toMatch(V4);
  });
});
