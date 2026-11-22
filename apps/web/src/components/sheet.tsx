"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
} from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";

interface SheetEntry {
  close: () => void;
  root: HTMLElement;
}

const stack: SheetEntry[] = [];
const inerted = new Set<HTMLElement>();
let savedBodyOverflow: string | null = null;

function syncBackground() {
  for (const el of inerted) el.inert = false;
  inerted.clear();

  const top = stack.at(-1);
  if (!top) {
    if (savedBodyOverflow !== null) {
      document.body.style.overflow = savedBodyOverflow;
      savedBodyOverflow = null;
    }
    return;
  }

  for (const child of document.body.children) {
    if (child === top.root || !(child instanceof HTMLElement)) continue;
    if (child.inert || child.tagName === "SCRIPT") continue;
    child.inert = true;
    inerted.add(child);
  }
  if (savedBodyOverflow === null) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function tabStops(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) =>
      !(el instanceof HTMLInputElement && el.type === "radio" && !el.checked) &&
      el.getClientRects().length > 0
  );
}

function trapTab(e: KeyboardEvent, panel: HTMLElement) {
  const stops = tabStops(panel);
  if (stops.length === 0) {
    e.preventDefault();
    panel.focus();
    return;
  }
  const [first] = stops;
  const last = stops.at(-1) ?? first;
  const active = document.activeElement;
  const inside = active instanceof Node && panel.contains(active);

  if (!inside) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  } else if (e.shiftKey && (active === first || active === panel)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

// oxlint-disable-next-line no-empty-function -- nothing to subscribe to
const noop = () => {};
const subscribeNever = () => noop;
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const useIsClient = () =>
  useSyncExternalStore(subscribeNever, clientSnapshot, serverSnapshot);

function useSheetBehaviour({
  open,
  onClose,
  rootRef,
  panelRef,
  initialFocusRef,
}: {
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  open: boolean;
  panelRef: RefObject<HTMLElement | null>;
  rootRef: RefObject<HTMLElement | null>;
}) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const mounted = useIsClient();

  useEffect(() => {
    if (!(open && mounted)) return;
    const root = rootRef.current;
    const panel = panelRef.current;
    if (!(root && panel)) return;

    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const entry: SheetEntry = { close: () => onCloseRef.current(), root };
    stack.push(entry);
    syncBackground();
    (initialFocusRef?.current ?? panel).focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (stack.at(-1) !== entry) return;
      if (e.key === "Escape") {
        e.preventDefault();
        entry.close();
      } else if (e.key === "Tab") {
        trapTab(e, panel);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const index = stack.indexOf(entry);
      if (index !== -1) stack.splice(index, 1);
      syncBackground();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, mounted, rootRef, panelRef, initialFocusRef]);
}

const CHIP_CLASS =
  "relative inline-flex min-h-[44px] cursor-pointer select-none items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-surface px-4 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 has-checked:border-primary-500 has-checked:bg-primary-500 has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-ink has-disabled:cursor-not-allowed has-disabled:opacity-40";

export const FieldError = ({
  id,
  message,
}: {
  id: string;
  message: string | null | undefined;
}) => (
  <p
    aria-live="polite"
    className={`text-sm text-danger-500 ${message ? "mt-2" : ""}`}
    id={id}
  >
    {message}
  </p>
);

export interface ChipOption<T extends string> {
  disabled?: boolean;
  label: string;
  value: T;
}

export function ChoiceChips<T extends string>({
  legend,
  options,
  value,
  onChange,
  error,
}: {
  error?: string | null;
  legend: string;
  onChange: (value: T) => void;
  options: readonly ChipOption<T>[];
  value: T | null;
}) {
  const name = useId();
  const errorId = `${name}-error`;
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value as T),
    [onChange]
  );
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="mb-2 text-sm font-medium text-neutral-600">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label className={CHIP_CLASS} key={option.value}>
            <input
              checked={value === option.value}
              className="sr-only focus-visible:outline-none"
              disabled={option.disabled}
              name={name}
              onChange={handleChange}
              type="radio"
              value={option.value}
            />
            {option.label}
          </label>
        ))}
      </div>
      {error !== undefined && <FieldError id={errorId} message={error} />}
    </fieldset>
  );
}

export const ToggleChip = ({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked),
    [onChange]
  );
  return (
    <label className={CHIP_CLASS}>
      <input
        checked={checked}
        className="sr-only focus-visible:outline-none"
        onChange={handleChange}
        type="checkbox"
      />
      {checked && (
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <path
            d="M5 13l4 4L19 7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {label}
    </label>
  );
};

export const FIELD_LABEL_CLASS = "block text-sm font-medium text-neutral-600";
export const FIELD_INPUT_CLASS =
  "mt-1.5 block min-h-[48px] w-full rounded-xl border border-neutral-200 bg-surface px-3 py-2.5 text-base text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:border-primary-300";

export const Sheet = ({
  open,
  onClose,
  title,
  children,
  footer,
  closeLabel = "Close",
  initialFocusRef,
}: {
  children: ReactNode;
  closeLabel?: string;
  footer?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  open: boolean;
  title: string;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const mounted = useIsClient();

  useSheetBehaviour({ initialFocusRef, onClose, open, panelRef, rootRef });

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  if (!(open && mounted)) return null;

  return createPortal(
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop tap is a pointer shortcut; Escape is handled on document
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/30"
      onClick={handleBackdrop}
      ref={rootRef}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="animate-slide-up motion-reduce:animate-none flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col rounded-t-2xl bg-surface-raised shadow-lg safe-bottom focus:outline-none"
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div
          aria-hidden="true"
          className="flex shrink-0 justify-center pt-3 pb-1"
        >
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>

        <div className="flex shrink-0 items-center justify-between px-5 pt-2 pb-4">
          <h2 className="text-base font-semibold text-neutral-700" id={titleId}>
            {title}
          </h2>
          <button
            aria-label={closeLabel}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            onClick={onClose}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>

        {footer && <div className="shrink-0 px-5 pt-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};
