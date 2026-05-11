export interface PumpHint {
  hint: string;
  suggestedSide: "left" | "right" | "both" | null;
  updatedAt: number;
}

export type PumpIntent =
  | { kind: "page-open" }
  | { kind: "pump-start"; side: "left" | "right" | "both" };

type HintListener = (hint: PumpHint) => void;
type IntentListener = (intent: PumpIntent) => void;

let current: PumpHint | null = null;
const hintListeners = new Set<HintListener>();
const intentListeners = new Set<IntentListener>();

export function getPumpHint(): PumpHint | null {
  return current;
}

export function publishPumpHint(hint: PumpHint): void {
  current = hint;
  for (const fn of hintListeners) fn(hint);
}

export function subscribePumpHint(fn: HintListener): () => void {
  hintListeners.add(fn);
  return () => {
    hintListeners.delete(fn);
  };
}

export function signalPumpIntent(intent: PumpIntent): void {
  for (const fn of intentListeners) fn(intent);
}

export function subscribePumpIntent(fn: IntentListener): () => void {
  intentListeners.add(fn);
  return () => {
    intentListeners.delete(fn);
  };
}
