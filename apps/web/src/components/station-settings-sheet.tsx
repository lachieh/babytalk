"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { STATION_ACTIONS } from "@/lib/station-config";
import type { StationActionKey } from "@/lib/station-config";

const ToggleRow = ({
  action,
  isOn,
  onToggle,
}: {
  action: {
    description: string;
    key: StationActionKey;
    label: string;
  };
  isOn: boolean;
  onToggle: (key: StationActionKey) => void;
}) => {
  const handleClick = useCallback(
    () => onToggle(action.key),
    [action.key, onToggle]
  );
  return (
    <button
      aria-pressed={isOn}
      className="flex w-full items-center gap-3 rounded-xl bg-neutral-50 px-4 py-3 text-left transition-colors hover:bg-neutral-100"
      onClick={handleClick}
      type="button"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-neutral-800">
          {action.label}
        </span>
        <span className="mt-0.5 block text-xs text-neutral-500">
          {action.description}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-7 w-12 rounded-full transition-colors ${
          isOn ? "bg-primary-500" : "bg-neutral-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
            isOn ? "translate-x-[1.375rem]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
};

export const StationSettingsSheet = ({
  open,
  onClose,
  visible,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  visible: StationActionKey[];
  onToggle: (key: StationActionKey) => void;
}) => {
  const router = useRouter();

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleBackdropKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  const handleExitStation = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  if (!open) return null;

  return (
    <div
      aria-label="Station settings"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/40"
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
      role="dialog"
    >
      <div className="animate-slide-up w-full max-w-lg rounded-t-2xl bg-surface-raised shadow-lg safe-bottom">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>

        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <h2 className="text-base font-semibold text-neutral-700">
            Station settings
          </h2>
          <button
            aria-label="Close"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            onClick={onClose}
            type="button"
          >
            <svg
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

        <div className="space-y-5 px-5 pb-6">
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
              Visible actions
            </h3>
            <p className="mb-3 text-xs text-neutral-500">
              Pick which buttons appear on this device. Settings stay on this
              device only.
            </p>
            <ul className="space-y-2">
              {STATION_ACTIONS.map((action) => {
                const isOn = visible.includes(action.key);
                return (
                  <li key={action.key}>
                    <ToggleRow
                      action={action}
                      isOn={isOn}
                      onToggle={onToggle}
                    />
                  </li>
                );
              })}
            </ul>
          </section>

          <button
            className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-700"
            onClick={handleExitStation}
            type="button"
          >
            Exit station mode
          </button>
        </div>
      </div>
    </div>
  );
};
