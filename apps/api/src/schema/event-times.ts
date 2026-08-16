export function normalizeEventEndTime(
  type: string,
  startedAt: Date,
  endedAt: Date | null
): Date | null {
  if (type === "diaper") return startedAt;
  return endedAt;
}
