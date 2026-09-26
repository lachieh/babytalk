import type { BabyEvent } from "./baby-context";

export function latestPastEvent(
  events: BabyEvent[],
  type: BabyEvent["type"],
  now = Date.now()
): BabyEvent | null {
  return (
    events
      .filter(
        (event) =>
          event.type === type && new Date(event.startedAt).getTime() <= now
      )
      .toSorted(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      )[0] ?? null
  );
}
