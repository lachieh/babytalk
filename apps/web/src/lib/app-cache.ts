import type { ZodType } from "zod";

const DEVICE_PREFIX = "bubsie_cache:";

const memory = new Map<string, unknown>();

export const readMemory = <T>(key: string): T | undefined =>
  memory.get(key) as T | undefined;

export const writeMemory = (key: string, value: unknown) => {
  memory.set(key, value);
};

const deviceKey = (user: string, name: string) =>
  `${DEVICE_PREFIX}${user}:${name}`;

export const readDevice = <T>(
  user: string | null,
  name: string,
  schema: ZodType<T>
): T | null => {
  if (!user || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(deviceKey(user, name));
    if (raw === null) return null;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const writeDevice = (
  user: string | null,
  name: string,
  value: unknown
) => {
  if (!user || typeof window === "undefined") return;
  try {
    localStorage.setItem(deviceKey(user, name), JSON.stringify(value));
  } catch {
    // Storage full or blocked: the app still works, it just opens colder.
  }
};

export const clearAppCache = () => {
  memory.clear();
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(DEVICE_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    /* nothing more can be done */
  }
};
