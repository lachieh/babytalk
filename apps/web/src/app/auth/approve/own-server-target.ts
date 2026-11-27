export type OwnServerTarget =
  | { kind: "invalid" }
  | { kind: "this-server" }
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
