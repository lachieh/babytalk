import { useCallback, useSyncExternalStore } from "react";

export type MeasurementUnit = "imperial" | "metric";

const STORAGE_KEY = "babytalk_measurement_unit";

function localeDefault(): MeasurementUnit {
  if (typeof navigator === "undefined") return "metric";
  return navigator.language.startsWith("en-US") ? "imperial" : "metric";
}

let listeners: (() => void)[] = [];

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getMeasurementUnit(): MeasurementUnit {
  if (typeof window === "undefined") return "metric";
  return (
    (localStorage.getItem(STORAGE_KEY) as MeasurementUnit | null) ??
    localeDefault()
  );
}

function getServerSnapshot(): MeasurementUnit {
  return "metric";
}

function setUnit(unit: MeasurementUnit) {
  localStorage.setItem(STORAGE_KEY, unit);
  for (const listener of listeners) {
    listener();
  }
}

export function useMeasurementUnit() {
  const unit = useSyncExternalStore(
    subscribe,
    getMeasurementUnit,
    getServerSnapshot
  );
  const toggle = useCallback(
    () => setUnit(unit === "imperial" ? "metric" : "imperial"),
    [unit]
  );
  return {
    imperial: unit === "imperial",
    setUnit,
    toggle,
    unit,
  } as const;
}
