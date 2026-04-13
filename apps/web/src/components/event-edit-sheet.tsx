"use client";

import { useCallback, useEffect, useState } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { triggerFeedback } from "@/lib/haptics";
import { useVolumeUnit, mlToDisplay, displayToMl } from "@/lib/use-volume-unit";

/* ── Types ─────────────────────────────────────────────────── */

type EventType = "feed" | "sleep" | "diaper" | "pump" | "note";

interface EventFormData {
  type: EventType;
  startedAt: string;
  endedAt: string;
  meta: Record<string, unknown>;
}

/* ── Helpers ───────────────────────────────────────────────── */

const pad2 = (n: number) => String(n).padStart(2, "0");

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseMeta(event: BabyEvent): Record<string, unknown> {
  try {
    return JSON.parse(event.metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function hasDuration(form: EventFormData): boolean {
  if (form.type === "diaper" || form.type === "note") return false;
  if (form.type === "feed") {
    const method = form.meta.method as string | undefined;
    return method === "breast";
  }
  return true;
}

function saveButtonLabel(saving: boolean, isNew: boolean): string {
  if (saving) return "Saving...";
  if (isNew) return "Add";
  return "Save";
}

const EVENT_TYPES: { key: EventType; label: string }[] = [
  { key: "feed", label: "Feed" },
  { key: "pump", label: "Pump" },
  { key: "diaper", label: "Diaper" },
  { key: "sleep", label: "Sleep" },
  { key: "note", label: "Note" },
];

/* ── Meta Fields by Type ───────────────────────────────────── */

const FeedFields = ({
  meta,
  onChange,
}: {
  meta: Record<string, unknown>;
  onChange: (m: Record<string, unknown>) => void;
}) => {
  const { unit } = useVolumeUnit();
  const handleMethod = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      onChange({ ...meta, method: e.target.value }),
    [meta, onChange]
  );
  const handleSide = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      onChange({ ...meta, side: e.target.value }),
    [meta, onChange]
  );
  const handleAmount = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({
        ...meta,
        amountMl: e.target.value
          ? displayToMl(Number(e.target.value), unit)
          : undefined,
      }),
    [meta, onChange, unit]
  );

  const displayAmount = (meta.amountMl as number)
    ? mlToDisplay(meta.amountMl as number, unit)
    : "";

  return (
    <>
      <label className="block text-xs font-medium text-neutral-500">
        Method
        <select
          className="mt-1 block w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2.5 text-sm text-neutral-800"
          onChange={handleMethod}
          value={(meta.method as string) || "breast"}
        >
          <option value="breast">Breast</option>
          <option value="bottle">Bottle</option>
          <option value="formula">Formula</option>
          <option value="solid">Solid</option>
        </select>
      </label>
      {(meta.method === "breast" || !meta.method) && (
        <label className="block text-xs font-medium text-neutral-500">
          Side
          <select
            className="mt-1 block w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2.5 text-sm text-neutral-800"
            onChange={handleSide}
            value={(meta.side as string) || "left"}
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
            <option value="both">Both</option>
          </select>
        </label>
      )}
      {(meta.method === "bottle" || meta.method === "formula") && (
        <label className="block text-xs font-medium text-neutral-500">
          Amount ({unit})
          <input
            className="mt-1 block w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2.5 text-sm text-neutral-800"
            inputMode="decimal"
            onChange={handleAmount}
            step="0.01"
            type="number"
            value={displayAmount}
          />
        </label>
      )}
    </>
  );
};

const DiaperFields = ({
  meta,
  onChange,
}: {
  meta: Record<string, unknown>;
  onChange: (m: Record<string, unknown>) => void;
}) => {
  const handleWet = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...meta, wet: e.target.checked }),
    [meta, onChange]
  );
  const handleSoiled = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...meta, soiled: e.target.checked }),
    [meta, onChange]
  );

  return (
    <div className="flex gap-4">
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          checked={Boolean(meta.wet)}
          className="h-5 w-5 rounded border-neutral-300"
          onChange={handleWet}
          type="checkbox"
        />
        Wet
      </label>
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          checked={Boolean(meta.soiled)}
          className="h-5 w-5 rounded border-neutral-300"
          onChange={handleSoiled}
          type="checkbox"
        />
        Soiled
      </label>
    </div>
  );
};

const SleepFields = ({
  meta,
  onChange,
}: {
  meta: Record<string, unknown>;
  onChange: (m: Record<string, unknown>) => void;
}) => {
  const handleLocation = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      onChange({ ...meta, location: e.target.value }),
    [meta, onChange]
  );

  return (
    <label className="block text-xs font-medium text-neutral-500">
      Location
      <select
        className="mt-1 block w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2.5 text-sm text-neutral-800"
        onChange={handleLocation}
        value={(meta.location as string) || "crib"}
      >
        <option value="crib">Crib</option>
        <option value="bassinet">Bassinet</option>
        <option value="held">Held</option>
        <option value="carrier">Carrier</option>
      </select>
    </label>
  );
};

const PumpFields = ({
  meta,
  onChange,
}: {
  meta: Record<string, unknown>;
  onChange: (m: Record<string, unknown>) => void;
}) => {
  const { unit } = useVolumeUnit();
  const handleSide = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      onChange({ ...meta, side: e.target.value }),
    [meta, onChange]
  );
  const handleAmount = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({
        ...meta,
        amountMl: e.target.value
          ? displayToMl(Number(e.target.value), unit)
          : undefined,
      }),
    [meta, onChange, unit]
  );

  const displayAmount = (meta.amountMl as number)
    ? mlToDisplay(meta.amountMl as number, unit)
    : "";

  return (
    <>
      <label className="block text-xs font-medium text-neutral-500">
        Side
        <select
          className="mt-1 block w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2.5 text-sm text-neutral-800"
          onChange={handleSide}
          value={(meta.side as string) || "left"}
        >
          <option value="left">Left</option>
          <option value="right">Right</option>
          <option value="both">Both</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-neutral-500">
        Amount ({unit})
        <input
          className="mt-1 block w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2.5 text-sm text-neutral-800"
          inputMode="numeric"
          onChange={handleAmount}
          type="number"
          value={displayAmount}
        />
      </label>
    </>
  );
};

const NoteFields = ({
  meta,
  onChange,
}: {
  meta: Record<string, unknown>;
  onChange: (m: Record<string, unknown>) => void;
}) => {
  const handleText = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) =>
      onChange({ ...meta, text: e.target.value }),
    [meta, onChange]
  );

  return (
    <label className="block text-xs font-medium text-neutral-500">
      Note
      <textarea
        className="mt-1 block w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2.5 text-sm text-neutral-800"
        onChange={handleText}
        rows={3}
        value={(meta.text as string) || ""}
      />
    </label>
  );
};

/* ── Event Edit Sheet ──────────────────────────────────────── */

export const EventEditSheet = ({
  event,
  open,
  onClose,
}: {
  event: BabyEvent | null;
  open: boolean;
  onClose: () => void;
}) => {
  const { logEventDirect, updateEventMeta, deleteEvent } = useBabyContext();
  const isNew = event === null;

  const [form, setForm] = useState<EventFormData>(() => {
    if (event) {
      return {
        type: event.type as EventType,
        startedAt: toLocalDatetime(event.startedAt),
        endedAt: event.endedAt ? toLocalDatetime(event.endedAt) : "",
        meta: parseMeta(event),
      };
    }
    return {
      type: "feed",
      startedAt: toLocalDatetime(new Date().toISOString()),
      endedAt: "",
      meta: { method: "breast", side: "left" },
    };
  });

  // Reset form when a different event is selected or sheet opens
  useEffect(() => {
    if (!open) return;
    if (event) {
      setForm({
        type: event.type as EventType,
        startedAt: toLocalDatetime(event.startedAt),
        endedAt: event.endedAt ? toLocalDatetime(event.endedAt) : "",
        meta: parseMeta(event),
      });
    } else {
      setForm({
        type: "feed",
        startedAt: toLocalDatetime(new Date().toISOString()),
        endedAt: "",
        meta: { method: "breast", side: "left" },
      });
    }
  }, [event, open]);

  const [saving, setSaving] = useState(false);

  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newType = e.target.value as EventType;
      let newMeta: Record<string, unknown> = {};
      switch (newType) {
        case "feed": {
          newMeta = { method: "breast", side: "left" };
          break;
        }
        case "pump": {
          newMeta = { side: "left" };
          break;
        }
        case "diaper": {
          newMeta = { wet: true, soiled: false };
          break;
        }
        case "sleep": {
          newMeta = { location: "crib" };
          break;
        }
        case "note": {
          newMeta = { text: "" };
          break;
        }
        default: {
          break;
        }
      }
      setForm((f) => ({ ...f, type: newType, meta: newMeta }));
    },
    []
  );

  const handleStartChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, startedAt: e.target.value })),
    []
  );

  const handleEndChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, endedAt: e.target.value })),
    []
  );

  const handleMetaChange = useCallback(
    (meta: Record<string, unknown>) => setForm((f) => ({ ...f, meta })),
    []
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (isNew) {
        const startedAt = new Date(form.startedAt).toISOString();
        const endedAt = form.endedAt
          ? new Date(form.endedAt).toISOString()
          : undefined;
        await logEventDirect(form.type, {
          ...form.meta,
          _startedAt: startedAt,
          ...(endedAt ? { _endedAt: endedAt } : {}),
        });
      } else if (event) {
        const startedAt = new Date(form.startedAt).toISOString();
        const endedAt = form.endedAt
          ? new Date(form.endedAt).toISOString()
          : null;
        await updateEventMeta(
          event.id,
          form.type,
          form.meta,
          startedAt,
          endedAt
        );
      }
      triggerFeedback("logged");
      onClose();
    } catch (error) {
      console.error("[EventEditSheet] Save failed:", error);
    } finally {
      setSaving(false);
    }
  }, [isNew, event, form, logEventDirect, updateEventMeta, onClose]);

  const handleDelete = useCallback(async () => {
    if (!event) return;
    await deleteEvent(event.id);
    triggerFeedback("logged");
    onClose();
  }, [event, deleteEvent, onClose]);

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/30"
      onClick={handleBackdrop}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? "Add event" : "Edit event"}
    >
      <div className="w-full max-w-lg rounded-t-2xl bg-surface-raised shadow-lg safe-bottom">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <h2 className="text-base font-semibold text-neutral-700">
            {isNew ? "Add entry" : "Edit entry"}
          </h2>
          <button
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4 px-5 pb-6">
          {/* Type */}
          {isNew && (
            <label className="block text-xs font-medium text-neutral-500">
              Type
              <select
                className="mt-1 block w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2.5 text-sm text-neutral-800"
                onChange={handleTypeChange}
                value={form.type}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Timing */}
          {hasDuration(form) ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-neutral-500">
                Started
                <input
                  className="mt-1 block w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2.5 text-sm text-neutral-800"
                  onChange={handleStartChange}
                  type="datetime-local"
                  value={form.startedAt}
                />
              </label>
              <label className="block text-xs font-medium text-neutral-500">
                Ended
                <input
                  className="mt-1 block w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2.5 text-sm text-neutral-800"
                  onChange={handleEndChange}
                  type="datetime-local"
                  value={form.endedAt}
                />
              </label>
            </div>
          ) : (
            <label className="block text-xs font-medium text-neutral-500">
              Time
              <input
                className="mt-1 block w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2.5 text-sm text-neutral-800"
                onChange={handleStartChange}
                type="datetime-local"
                value={form.startedAt}
              />
            </label>
          )}

          {/* Type-specific fields */}
          {form.type === "feed" && (
            <FeedFields meta={form.meta} onChange={handleMetaChange} />
          )}
          {form.type === "diaper" && (
            <DiaperFields meta={form.meta} onChange={handleMetaChange} />
          )}
          {form.type === "sleep" && (
            <SleepFields meta={form.meta} onChange={handleMetaChange} />
          )}
          {form.type === "pump" && (
            <PumpFields meta={form.meta} onChange={handleMetaChange} />
          )}
          {form.type === "note" && (
            <NoteFields meta={form.meta} onChange={handleMetaChange} />
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              className="min-h-[48px] flex-1 rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.97] disabled:opacity-40"
              disabled={saving}
              onClick={handleSave}
              type="button"
            >
              {saveButtonLabel(saving, isNew)}
            </button>
            {!isNew && (
              <button
                className="min-h-[48px] rounded-xl border border-danger-200 px-4 py-3 text-sm font-medium text-danger-500 transition-colors hover:bg-danger-50"
                onClick={handleDelete}
                type="button"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
