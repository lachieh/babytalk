import { capitalize, eventTypeLabel, parseMeta } from "./event-meta";
import { formatVolume } from "./use-volume-unit";
import type { VolumeUnit } from "./use-volume-unit";

export type ToastPhase = "started" | "saved" | "discarded";

interface ToastEvent {
  type: string;
  startedAt: string;
  endedAt: string | null;
  metadata: string;
}

export const formatDuration = (ms: number): string => {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "Under 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

const diaperDetail = (meta: Record<string, unknown>) => {
  if (meta.wet && meta.soiled) return "Wet and dirty";
  if (meta.wet) return "Wet";
  if (meta.soiled) return "Dirty";
  return "Dry";
};

const detailFor = (
  type: string,
  meta: Record<string, unknown>,
  unit: VolumeUnit
): string[] => {
  const str = (key: string) =>
    typeof meta[key] === "string" ? capitalize(meta[key] as string) : null;
  const amount =
    typeof meta.amountMl === "number" && meta.amountMl > 0
      ? formatVolume(meta.amountMl, unit)
      : null;
  switch (type) {
    case "feed": {
      const how = meta.method === "breast" ? str("side") : str("method");
      return [how, amount].filter((part): part is string => part !== null);
    }
    case "pump": {
      return [str("side"), amount].filter(
        (part): part is string => part !== null
      );
    }
    case "sleep": {
      const where = str("location");
      return where ? [where] : [];
    }
    case "diaper": {
      return [diaperDetail(meta)];
    }
    default: {
      return [];
    }
  }
};

export const buildToastCopy = (
  event: ToastEvent,
  phase: ToastPhase,
  unit: VolumeUnit = "ml"
): string => {
  const name = eventTypeLabel(event.type);
  const parts = [
    phase === "discarded" ? `${name} timer discarded` : `${name} ${phase}`,
  ];
  if (phase === "saved" && event.endedAt) {
    const ms = Date.parse(event.endedAt) - Date.parse(event.startedAt);
    if (ms > 0) parts.push(formatDuration(ms));
  }
  parts.push(...detailFor(event.type, parseMeta(event.metadata), unit));
  return parts.join(" · ");
};
