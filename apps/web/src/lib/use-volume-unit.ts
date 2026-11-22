import { useCallback, useSyncExternalStore } from "react";

export type VolumeUnit = "ml" | "oz";

const STORAGE_KEY = "bubsie_volume_unit";

const ML_PER_OZ = 29.5735;

/* ── Detect locale default ────────────────────────────────── */

function localeDefault(): VolumeUnit {
  if (typeof navigator === "undefined") return "ml";
  // US customary uses fl oz; most other locales use ml
  return navigator.language.startsWith("en-US") ? "oz" : "ml";
}

/* ── External store for cross-component reactivity ────────── */

let listeners: (() => void)[] = [];

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/** Read the current volume unit preference (safe to call outside React) */
export function getVolumeUnit(): VolumeUnit {
  if (typeof window === "undefined") return "ml";
  return (
    (localStorage.getItem(STORAGE_KEY) as VolumeUnit | null) ?? localeDefault()
  );
}

function getServerSnapshot(): VolumeUnit {
  return "ml";
}

function setUnit(unit: VolumeUnit) {
  localStorage.setItem(STORAGE_KEY, unit);
  for (const listener of listeners) {
    listener();
  }
}

/* ── Hook ─────────────────────────────────────────────────── */

export function useVolumeUnit() {
  const unit = useSyncExternalStore(
    subscribe,
    getVolumeUnit,
    getServerSnapshot
  );
  const toggle = useCallback(
    () => setUnit(unit === "ml" ? "oz" : "ml"),
    [unit]
  );
  return { unit, setUnit, toggle } as const;
}

/* ── Conversion helpers ───────────────────────────────────── */

/** Convert ml to the display unit, rounded to 1 decimal place.
 *  1 decimal avoids round-trip precision noise (e.g. 3oz → 89ml → 3.01oz).
 */
export function mlToDisplay(ml: number, unit: VolumeUnit): number {
  if (unit === "oz") {
    return Math.round((ml / ML_PER_OZ) * 10) / 10;
  }
  return Math.round(ml * 10) / 10;
}

/** Convert a display-unit value back to ml */
export function displayToMl(value: number, unit: VolumeUnit): number {
  return unit === "oz" ? Math.round(value * ML_PER_OZ) : Math.round(value);
}

export function formatVolume(ml: number, unit: VolumeUnit): string {
  const val = mlToDisplay(ml, unit);
  return `${val} ${unit}`;
}

export function amountChips(lastMl: number | null, unit: VolumeUnit): number[] {
  const step = unit === "oz" ? 1 : 30;
  const snap = unit === "oz" ? 0.5 : 10;
  const typical = unit === "oz" ? 4 : 120;
  const snapped =
    lastMl && lastMl > 0
      ? Math.round(mlToDisplay(lastMl, unit) / snap) * snap
      : typical;
  const middle = Math.max(snap, snapped);
  const lower = middle - step > 0 ? middle - step : middle / 2;
  return [lower, middle, middle + step];
}
