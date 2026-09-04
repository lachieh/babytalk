import { requireCurrentUser } from "./require-auth";

describe("authentication context", () => {
  it("rejects an unauthenticated context", () => {
    expect(() => requireCurrentUser({ currentUser: null })).toThrow(
      "Not authenticated"
    );
  });

  it("returns the authenticated user", () => {
    const currentUser = { email: "parent@example.com", sub: "user-1" };

    expect(requireCurrentUser({ currentUser })).toStrictEqual(currentUser);
  });
});
