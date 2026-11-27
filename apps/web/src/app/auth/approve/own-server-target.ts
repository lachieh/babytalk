/** What to do with an address entered under "Using your own server?". */
export type OwnServerTarget =
  | { kind: "invalid" }
  /** This server: the device is already here, so a move could only fail. */
  | { kind: "this-server" }
  /** Check from the browser that the address serves Bubsie, then send the device. */
  | { kind: "check"; origin: string }
  /** An http address from an https page: the browser may not fetch it (mixed
   * content), so the device checks it itself and falls back if it isn't Bubsie. */
  | { kind: "device-checks"; origin: string };

export const ownServerTarget = (
  input: string,
  pageOrigin: string
): OwnServerTarget => {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { kind: "invalid" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { kind: "invalid" };
  }
  if (url.origin === pageOrigin) return { kind: "this-server" };
  const page = new URL(pageOrigin);
  if (page.protocol === "https:" && url.protocol === "http:") {
    return { kind: "device-checks", origin: url.origin };
  }
  return { kind: "check", origin: url.origin };
};
