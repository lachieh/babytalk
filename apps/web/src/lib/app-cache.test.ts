import { z } from "zod";

import { readDevice, writeDevice } from "./app-cache";

const schema = z.object({ name: z.string() });

describe("what the device kept from last time", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      removeItem: (key: string) => store.delete(key),
      setItem: (key: string, value: string) => store.set(key, value),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("comes back for the same person", () => {
    writeDevice("u1", "baby", { name: "Milo" });
    expect(readDevice("u1", "baby", schema)).toStrictEqual({ name: "Milo" });
  });

  it("is never shown to someone else", () => {
    writeDevice("u1", "baby", { name: "Milo" });
    expect(readDevice("u2", "baby", schema)).toBeNull();
  });

  it("is ignored when an older version saved a different shape", () => {
    writeDevice("u1", "baby", { name: 3 });
    expect(readDevice("u1", "baby", schema)).toBeNull();
  });

  it("is ignored when it is not JSON", () => {
    localStorage.setItem("bubsie_cache:u1:baby", "{not json");
    expect(readDevice("u1", "baby", schema)).toBeNull();
  });
});
