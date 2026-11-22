import type { BabyEvent } from "./baby-context";
import { capitalize, eventTypeLabel, parseMeta } from "./event-meta";
import { isDurationEvent } from "./event-time";
import { getVolumeUnit, mlToDisplay } from "./use-volume-unit";

/* ── Duration ───────────────────────────────────────────────── */

const INSTANT_TYPES = new Set(["diaper", "note"]);

export function formatDuration(
  start: string,
  end: string | null,
  type: string
): string | null {
  if (INSTANT_TYPES.has(type)) return null;
  if (!end) return null;
  if (start === end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60_000);
  if (!(mins > 0)) return null;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/* ── Per-type detail formatters ─────────────────────────────── */

interface ParsedMeta {
  amountMl?: number;
  color?: string;
  foodDesc?: string;
  location?: string;
  method?: string;
  side?: string;
  soiled?: boolean;
  text?: string;
  wet?: boolean;
}

const METHOD_LABELS: Record<string, string> = {
  breast: "Breast",
  bottle: "Bottle",
  formula: "Formula",
  solid: "Solid",
};

const SEPARATOR = " · ";

const clean = (s: unknown): string | null =>
  typeof s === "string" && s.trim() ? s.trim() : null;

function formatAmount(ml: number | undefined): string | null {
  if (!(typeof ml === "number" && ml > 0)) return null;
  const unit = getVolumeUnit();
  return `${mlToDisplay(ml, unit)} ${unit}`;
}

function joinParts(parts: (string | null | undefined)[]): string | null {
  const present = parts.filter(
    (p): p is string => typeof p === "string" && p !== ""
  );
  return present.length > 0 ? present.join(SEPARATOR) : null;
}

function feedDetail(meta: ParsedMeta, duration: string | null): string | null {
  const method = METHOD_LABELS[meta.method ?? ""] ?? null;
  let qualifier: string | null = null;
  if (meta.method === "breast") qualifier = clean(meta.side);
  if (meta.method === "solid") qualifier = clean(meta.foodDesc);
  const head =
    method && qualifier ? `${method}, ${qualifier.toLowerCase()}` : method;
  return joinParts([head, formatAmount(meta.amountMl), duration]);
}

function sleepDetail(meta: ParsedMeta, duration: string | null): string | null {
  const location = clean(meta.location);
  return joinParts([location && capitalize(location), duration]);
}

function diaperDetail(meta: ParsedMeta): string {
  let kind = "Wet";
  if (meta.wet && meta.soiled) kind = "Wet and soiled";
  else if (meta.soiled) kind = "Soiled";
  const color = clean(meta.color);
  return color ? `${kind}, ${color.toLowerCase()}` : kind;
}

function pumpDetail(meta: ParsedMeta, duration: string | null): string | null {
  const side = clean(meta.side);
  return joinParts([
    side && capitalize(side),
    formatAmount(meta.amountMl),
    duration,
  ]);
}

/* ── Summary (first line) ───────────────────────────────────── */

/**
 * Structured version — returns label and detail separately so
 * components can style them at different weights/colors.
 */
export function formatEventParts(event: BabyEvent): {
  label: string;
  detail: string | null;
} {
  const duration = formatDuration(event.startedAt, event.endedAt, event.type);

  try {
    const meta: ParsedMeta = JSON.parse(event.metadata);

    switch (event.type) {
      case "feed": {
        return { label: "Feed", detail: feedDetail(meta, duration) };
      }
      case "sleep": {
        return { label: "Sleep", detail: sleepDetail(meta, duration) };
      }
      case "diaper": {
        return { label: "Diaper", detail: diaperDetail(meta) };
      }
      case "pump": {
        return { label: "Pump", detail: pumpDetail(meta, duration) };
      }
      case "note": {
        return { label: "Note", detail: clean(meta.text) };
      }
      default: {
        return { label: capitalize(event.type), detail: null };
      }
    }
  } catch {
    return { label: capitalize(event.type), detail: null };
  }
}

/**
 * "Type • detail" as a plain string for contexts that don't need split styling.
 */
export function formatEventSummary(event: BabyEvent): string {
  const { label, detail } = formatEventParts(event);
  return detail ? `${label} • ${detail}` : label;
}

function timerDetail(type: string, meta: Record<string, unknown>): string {
  const side = typeof meta.side === "string" ? meta.side : "";
  if (type === "feed") {
    const method = typeof meta.method === "string" ? meta.method : "";
    if (method === "breast") {
      return side ? `${capitalize(side)} breast` : "Breast";
    }
    return capitalize(method);
  }
  if (type === "sleep") {
    return typeof meta.location === "string" ? capitalize(meta.location) : "";
  }
  if (type === "pump") {
    if (side === "both") return "Both sides";
    return capitalize(side);
  }
  return "";
}

export function timerLabel(
  event: Pick<BabyEvent, "metadata" | "type">
): string {
  const typeLabel = eventTypeLabel(event.type);
  const detail = timerDetail(event.type, parseMeta(event.metadata));
  return detail ? `${typeLabel} · ${detail}` : typeLabel;
}

/* ── Notes (second line) ────────────────────────────────────── */

/**
 * Extracts the notes field from event metadata, if present.
 * Note-type events return null here (their text is in the summary).
 */
export function formatEventNotes(event: BabyEvent): string | null {
  if (event.type === "note") return null;
  try {
    const meta = JSON.parse(event.metadata);
    const notes = meta.notes as string | undefined;
    return notes?.trim() || null;
  } catch {
    return null;
  }
}

export interface EventTimes {
  distinctEnd: string | null;
  inProgress: boolean;
  start: string;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function formatEventTimes(event: BabyEvent): EventTimes {
  const start = formatTime(event.startedAt);
  const inProgress = isDurationEvent(event) && event.endedAt === null;
  const spanMs = event.endedAt
    ? new Date(event.endedAt).getTime() - new Date(event.startedAt).getTime()
    : 0;
  const end =
    event.endedAt && Math.abs(spanMs) >= 60_000
      ? formatTime(event.endedAt)
      : null;
  return { distinctEnd: end === start ? null : end, inProgress, start };
}
