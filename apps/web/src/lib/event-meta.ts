import type { EventType } from "./event-styles";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  diaper: "Diaper",
  feed: "Feed",
  note: "Note",
  pump: "Pump",
  sleep: "Sleep",
};

export const capitalize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

export const eventTypeLabel = (type: string): string =>
  EVENT_TYPE_LABELS[type as EventType] ?? capitalize(type);

export function parseMeta(metadata: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(metadata);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
