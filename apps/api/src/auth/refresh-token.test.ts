import { createRefreshToken, hashRefreshToken } from "./refresh-token";

describe("refresh tokens", () => {
  it("creates an opaque token and a stable hash", () => {
    const token = createRefreshToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).not.toBe(token);
  });

  it("creates unique tokens", () => {
    expect(createRefreshToken()).not.toBe(createRefreshToken());
  });
});
