import { ownServerTarget } from "./own-server-target";

describe("own server address", () => {
  it("refuses what isn't an http(s) address", () => {
    expect(
      ownServerTarget("bubsie.example.com", "https://bubsie.app")
    ).toStrictEqual({ kind: "invalid" });
    expect(
      ownServerTarget("ftp://example.com", "https://bubsie.app")
    ).toStrictEqual({ kind: "invalid" });
  });

  it("refuses this server, whatever the path", () => {
    expect(
      ownServerTarget(" https://bubsie.app/auth/approve ", "https://bubsie.app")
    ).toStrictEqual({ kind: "this-server" });
  });

  it("checks an https address from the browser", () => {
    expect(
      ownServerTarget("https://bubsie.example.com/x", "https://bubsie.app")
    ).toStrictEqual({ kind: "check", origin: "https://bubsie.example.com" });
  });

  it("leaves an http address to the device when the page is https", () => {
    expect(
      ownServerTarget("http://192.168.1.20:3000", "https://bubsie.app")
    ).toStrictEqual({
      kind: "device-checks",
      origin: "http://192.168.1.20:3000",
    });
  });

  it("checks an http address from an http page", () => {
    expect(
      ownServerTarget("http://192.168.1.20:3000", "http://localhost:3000")
    ).toStrictEqual({ kind: "check", origin: "http://192.168.1.20:3000" });
  });
});
