const INSTANT_EVENT_TYPES = new Set(["diaper", "note"]);

export const isInstantEventType = (type: string): boolean =>
  INSTANT_EVENT_TYPES.has(type);

export function normalizeEventEndTime(
  type: string,
  startedAt: Date,
  endedAt: Date | null
): Date | null {
  if (isInstantEventType(type)) return startedAt;
  return endedAt;
}
