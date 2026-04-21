import type { BabyEvent } from "./baby-context";
import { formatVolume, getVolumeUnit } from "./use-volume-unit";

/* ── Duration ───────────────────────────────────────────────── */

const INSTANT_TYPES = new Set(["diaper"]);

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
  if (mins <= 0) return null;
  if (mins < 60) return `${mins}m`;
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

function feedDetail(meta: ParsedMeta, duration: string | null): string {
  const parts: string[] = [];
  if (duration) parts.push(duration);
  if (meta.amountMl) parts.push(formatVolume(meta.amountMl, getVolumeUnit()));
  const label = METHOD_LABELS[meta.method ?? ""] ?? "Feed";
  parts.push(label);
  if (meta.method === "breast" && meta.side) parts.push(`- ${meta.side}`);
  if (meta.method === "solid" && meta.foodDesc)
    parts.push(`- ${meta.foodDesc}`);
  return parts.join(" ");
}

function sleepDetail(meta: ParsedMeta, duration: string | null): string {
  const parts: string[] = [];
  if (duration) parts.push(duration);
  if (meta.location) parts.push(`- ${meta.location}`);
  return parts.length > 0 ? parts.join(" ") : "started";
}

function diaperDetail(meta: ParsedMeta): string {
  const parts: string[] = [];
  if (meta.wet && meta.soiled) parts.push("Wet + Soiled");
  else if (meta.soiled) parts.push("Soiled");
  else parts.push("Wet");
  if (meta.color) parts.push(`- ${meta.color}`);
  return parts.join(" ");
}

function pumpDetail(meta: ParsedMeta, duration: string | null): string {
  const parts: string[] = [];
  if (duration) parts.push(duration);
  if (meta.amountMl) parts.push(formatVolume(meta.amountMl, getVolumeUnit()));
  if (meta.side) parts.push(`- ${meta.side}`);
  return parts.join(" ");
}

/* ── Summary (first line) ───────────────────────────────────── */

/**
 * "Type • detail" format for scanning consistency:
 * "Feed • 2oz Formula", "Sleep • 45m - bassinet", "Diaper • Wet"
 */
export function formatEventSummary(event: BabyEvent): string {
  const duration = formatDuration(event.startedAt, event.endedAt, event.type);

  try {
    const meta: ParsedMeta = JSON.parse(event.metadata);

    switch (event.type) {
      case "feed": {
        return `Feed • ${feedDetail(meta, duration)}`;
      }
      case "sleep": {
        return `Sleep • ${sleepDetail(meta, duration)}`;
      }
      case "diaper": {
        return `Diaper • ${diaperDetail(meta)}`;
      }
      case "pump": {
        const detail = pumpDetail(meta, duration);
        return detail ? `Pump • ${detail}` : "Pump";
      }
      case "note": {
        return meta.text ? `Note • ${meta.text}` : "Note";
      }
      default: {
        return event.type;
      }
    }
  } catch {
    return event.type;
  }
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
