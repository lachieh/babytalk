/** A v4 UUID. `crypto.randomUUID` exists only in secure contexts (https,
 * localhost), and a self-hosted Bubsie is often reached over plain http on
 * the LAN; `crypto.getRandomValues` works everywhere. */
export const randomUUID = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  // Version 4, variant 10xx.
  const variant = "89ab"[Number.parseInt(hex[16] ?? "0", 16) % 4];
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20)}`;
};
