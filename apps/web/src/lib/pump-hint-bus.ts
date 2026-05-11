export interface PumpHint {
  hint: string;
  suggestedSide: "left" | "right" | "both" | null;
  updatedAt: number;
}

export type PumpIntent =
  | { kind: "page-open" }
  | { kind: "pump-start"; side: "left" | "right" | "both" }
  | { kind: "refresh" };

type HintListener = (hint: PumpHint) => void;
type IntentListener = (intent: PumpIntent) => void;
type RefreshingListener = (refreshing: boolean) => void;

let current: PumpHint | null = null;
let currentRefreshing = false;
const hintListeners = new Set<HintListener>();
const intentListeners = new Set<IntentListener>();
const refreshingListeners = new Set<RefreshingListener>();

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

export function publishPumpRefreshing(refreshing: boolean): void {
  currentRefreshing = refreshing;
  for (const fn of refreshingListeners) fn(refreshing);
}

export function subscribePumpRefreshing(fn: RefreshingListener): () => void {
  refreshingListeners.add(fn);
  fn(currentRefreshing);
  return () => {
    refreshingListeners.delete(fn);
  };
}
