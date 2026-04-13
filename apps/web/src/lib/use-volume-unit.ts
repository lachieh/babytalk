import { useCallback, useSyncExternalStore } from "react";

export type VolumeUnit = "ml" | "oz";

const STORAGE_KEY = "babytalk_volume_unit";

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

/** Convert ml to the display unit, rounded to 2 decimal places */
export function mlToDisplay(ml: number, unit: VolumeUnit): number {
  if (unit === "oz") {
    return Math.round((ml / ML_PER_OZ) * 100) / 100;
  }
  return Math.round(ml * 100) / 100;
}

/** Convert a display-unit value back to ml */
export function displayToMl(value: number, unit: VolumeUnit): number {
  return unit === "oz" ? Math.round(value * ML_PER_OZ) : Math.round(value);
}

/** Format a ml value for display with unit label */
export function formatVolume(ml: number, unit: VolumeUnit): string {
  const val = mlToDisplay(ml, unit);
  // Drop trailing zeros: 2.50 → 2.5, 3.00 → 3
  const display =
    val % 1 === 0 ? String(val) : val.toFixed(2).replace(/0+$/, "");
  return `${display}${unit}`;
}
