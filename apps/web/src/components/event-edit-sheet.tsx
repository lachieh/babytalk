"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { parseMeta } from "@/lib/event-meta";
import type { EventType } from "@/lib/event-styles";
import {
  changeTiming,
  entryShape,
  NOW,
  resolveEntryTiming,
  timingFromEvent,
} from "@/lib/event-time";
import type { EntryShape, EntryTiming, TimeChoice } from "@/lib/event-time";
import { triggerFeedback } from "@/lib/haptics";
import { useVolumeUnit } from "@/lib/use-volume-unit";

import {
  ChoiceChips,
  FIELD_INPUT_CLASS,
  FIELD_LABEL_CLASS,
  FieldError,
  Sheet,
  ToggleChip,
} from "./sheet";
import type { ChipOption } from "./sheet";
import { AmountSlider, TimeSlider } from "./slider-field";

/* ── Types ─────────────────────────────────────────────────── */

type Meta = Record<string, unknown>;

interface EventFormData {
  meta: Meta;
  timing: EntryTiming;
  type: EventType;
}

type FieldErrors = Partial<Record<"start" | "end" | "meta", string>>;

const EVENT_TYPES: readonly ChipOption<EventType>[] = [
  { label: "Feed", value: "feed" },
  { label: "Pump", value: "pump" },
  { label: "Diaper", value: "diaper" },
  { label: "Sleep", value: "sleep" },
  { label: "Note", value: "note" },
];

const METHODS: readonly ChipOption<string>[] = [
  { label: "Breast", value: "breast" },
  { label: "Bottle", value: "bottle" },
  { label: "Formula", value: "formula" },
  { label: "Solid", value: "solid" },
];

const SIDES: readonly ChipOption<string>[] = [
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
  { label: "Both", value: "both" },
];

const LOCATIONS: readonly ChipOption<string>[] = [
  { label: "Crib", value: "crib" },
  { label: "Bassinet", value: "bassinet" },
  { label: "Held", value: "held" },
  { label: "Carrier", value: "carrier" },
];

const DEFAULT_META: Record<EventType, Meta> = {
  diaper: { soiled: false, wet: true },
  feed: { method: "breast", side: "left" },
  note: { text: "" },
  pump: { side: "left" },
  sleep: { location: "crib" },
};

const DEFAULT_START: TimeChoice = { kind: "ago", minutes: 15 };

function formFor(event: BabyEvent | null): EventFormData {
  if (!event) {
    return {
      meta: DEFAULT_META.feed,
      timing: { end: NOW, running: false, start: DEFAULT_START },
      type: "feed",
    };
  }
  const type = event.type as EventType;
  const meta = parseMeta(event.metadata);
  return {
    meta,
    timing: timingFromEvent(event, entryShape(type, meta.method)),
    type,
  };
}

function metaError(type: EventType, meta: Meta): string | undefined {
  if (type === "diaper" && !meta.wet && !meta.soiled) {
    return "Choose wet, soiled, or both.";
  }
  if (type === "note" && !(typeof meta.text === "string" && meta.text.trim())) {
    return "Write a note first.";
  }
  return undefined;
}

function validate(form: EventFormData, shape: EntryShape) {
  const errors: FieldErrors = {};
  const timing = resolveEntryTiming(shape, form.timing);
  if (!timing.ok) errors[timing.field] = timing.message;
  const meta = metaError(form.type, form.meta);
  if (meta) errors.meta = meta;
  return { errors, timing };
}

interface MetaProps {
  meta: Meta;
  onChange: (m: Meta) => void;
}

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v ? v : fallback;

function useMetaField<V>(
  meta: Meta,
  onChange: (m: Meta) => void,
  key: string
): (value: V) => void {
  return useCallback(
    (value: V) => onChange({ ...meta, [key]: value }),
    [meta, onChange, key]
  );
}

const AmountField = ({ meta, onChange }: MetaProps) => {
  const { unit } = useVolumeUnit();
  const handleAmount = useCallback(
    (amountMl: number | undefined) => onChange({ ...meta, amountMl }),
    [meta, onChange]
  );
  return (
    <AmountSlider
      amountMl={typeof meta.amountMl === "number" ? meta.amountMl : undefined}
      legend={
        <>
          Amount <span className="font-normal text-neutral-400">optional</span>
        </>
      }
      onChange={handleAmount}
      unit={unit}
    />
  );
};

const FeedFields = ({ meta, onChange }: MetaProps) => {
  const method = str(meta.method, "breast");
  const handleSide = useMetaField<string>(meta, onChange, "side");
  const handleMethod = useCallback(
    (next: string) => {
      const { side: _side, amountMl: _amount, ...rest } = meta;
      const keepAmount = next === "bottle" || next === "formula";
      onChange({
        ...rest,
        ...(keepAmount && meta.amountMl !== undefined
          ? { amountMl: meta.amountMl }
          : {}),
        ...(next === "breast" ? { side: str(meta.side, "left") } : {}),
        method: next,
      });
    },
    [meta, onChange]
  );

  return (
    <>
      <ChoiceChips
        legend="Method"
        onChange={handleMethod}
        options={METHODS}
        value={method}
      />
      {method === "breast" && (
        <ChoiceChips
          legend="Side"
          onChange={handleSide}
          options={SIDES}
          value={str(meta.side, "left")}
        />
      )}
      {(method === "bottle" || method === "formula") && (
        <AmountField meta={meta} onChange={onChange} />
      )}
    </>
  );
};

const DiaperFields = ({
  meta,
  onChange,
  error,
}: MetaProps & { error?: string }) => {
  const errorId = useId();
  const handleWet = useMetaField<boolean>(meta, onChange, "wet");
  const handleSoiled = useMetaField<boolean>(meta, onChange, "soiled");
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="mb-2 text-sm font-medium text-neutral-600">
        What was in it
      </legend>
      <div className="flex flex-wrap gap-2">
        <ToggleChip
          checked={Boolean(meta.wet)}
          label="Wet"
          onChange={handleWet}
        />
        <ToggleChip
          checked={Boolean(meta.soiled)}
          label="Soiled"
          onChange={handleSoiled}
        />
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
};

const SleepFields = ({ meta, onChange }: MetaProps) => {
  const handleLocation = useMetaField<string>(meta, onChange, "location");
  return (
    <ChoiceChips
      legend="Where"
      onChange={handleLocation}
      options={LOCATIONS}
      value={str(meta.location, "crib")}
    />
  );
};

const PumpFields = ({ meta, onChange }: MetaProps) => {
  const handleSide = useMetaField<string>(meta, onChange, "side");
  return (
    <>
      <ChoiceChips
        legend="Side"
        onChange={handleSide}
        options={SIDES}
        value={str(meta.side, "left")}
      />
      <AmountField meta={meta} onChange={onChange} />
    </>
  );
};

const TextField = ({
  field,
  label,
  meta,
  onChange,
  optional,
  rows,
  placeholder,
  error,
}: MetaProps & {
  error?: string;
  field: "notes" | "text";
  label: string;
  optional?: boolean;
  placeholder?: string;
  rows: number;
}) => {
  const errorId = useId();
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) =>
      onChange({ ...meta, [field]: e.target.value || undefined }),
    [meta, onChange, field]
  );
  return (
    <div>
      <label className={FIELD_LABEL_CLASS}>
        {label}
        {optional && (
          <span className="ml-1 font-normal text-neutral-400">optional</span>
        )}
        <textarea
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          className={FIELD_INPUT_CLASS}
          onChange={handleChange}
          placeholder={placeholder}
          rows={rows}
          value={str(meta[field], "")}
        />
      </label>
      <FieldError id={errorId} message={error} />
    </div>
  );
};

const MetaFields = ({
  type,
  meta,
  onChange,
  error,
}: MetaProps & { error?: string; type: EventType }) => {
  switch (type) {
    case "feed": {
      return <FeedFields meta={meta} onChange={onChange} />;
    }
    case "pump": {
      return <PumpFields meta={meta} onChange={onChange} />;
    }
    case "sleep": {
      return <SleepFields meta={meta} onChange={onChange} />;
    }
    case "diaper": {
      return <DiaperFields error={error} meta={meta} onChange={onChange} />;
    }
    case "note": {
      return (
        <TextField
          error={error}
          field="text"
          label="Note"
          meta={meta}
          onChange={onChange}
          rows={3}
        />
      );
    }
    default: {
      return null;
    }
  }
};

const TimingFields = ({
  shape,
  timing,
  errors,
  canRun,
  onChange,
}: {
  canRun: boolean;
  errors: FieldErrors;
  onChange: (patch: Partial<EntryTiming>) => void;
  shape: EntryShape;
  timing: EntryTiming;
}) => {
  const handleStart = useCallback(
    (start: TimeChoice) => onChange({ start }),
    [onChange]
  );
  const handleEnd = useCallback(
    (end: TimeChoice) => onChange({ end, running: false }),
    [onChange]
  );
  const handleRunning = useCallback(
    (running: boolean) => onChange({ end: NOW, running }),
    [onChange]
  );

  if (shape === "instant") {
    return (
      <TimeSlider
        choice={timing.end}
        error={errors.end}
        legend="Time"
        onChange={handleEnd}
      />
    );
  }

  return (
    <>
      <TimeSlider
        choice={timing.start}
        error={errors.start}
        legend="Started"
        onChange={handleStart}
      />
      <div>
        <TimeSlider
          choice={timing.end}
          error={timing.running ? undefined : errors.end}
          legend="Ended"
          onChange={handleEnd}
          running={timing.running}
        />
        {canRun && (
          <div className="mt-2">
            <ToggleChip
              checked={timing.running}
              label="Still going"
              onChange={handleRunning}
            />
          </div>
        )}
      </div>
    </>
  );
};

const SheetActions = ({
  isNew,
  saving,
  saveError,
  confirmDelete,
  onSave,
  onDelete,
}: {
  confirmDelete: boolean;
  isNew: boolean;
  onDelete: () => void;
  onSave: () => void;
  saveError: string | null;
  saving: boolean;
}) => {
  let saveLabel = "Save";
  if (saving) saveLabel = "Saving…";
  else if (isNew) saveLabel = "Add";

  return (
    <>
      {saveError && (
        <p className="mb-3 text-center text-sm text-danger-500" role="alert">
          {saveError}
        </p>
      )}
      <div className={isNew ? "flex" : "grid grid-cols-2 gap-3"}>
        {!isNew && (
          <button
            className="min-h-[48px] rounded-xl border border-danger-200 px-3 py-3 text-sm font-medium text-danger-500 transition-colors hover:bg-danger-50"
            onClick={onDelete}
            type="button"
          >
            {confirmDelete ? "Tap again to delete" : "Delete"}
          </button>
        )}
        <button
          className="min-h-[48px] w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.97] disabled:opacity-40"
          disabled={saving}
          onClick={onSave}
          type="button"
        >
          {saveLabel}
        </button>
      </div>
    </>
  );
};

async function persist(
  form: EventFormData,
  timing: { endedAt: string | null; startedAt: string },
  event: BabyEvent | null,
  ctx: Pick<
    ReturnType<typeof useBabyContext>,
    "logEventDirect" | "updateEventMeta"
  >
): Promise<void> {
  if (!event) {
    await ctx.logEventDirect(form.type, {
      ...form.meta,
      _startedAt: timing.startedAt,
      ...(timing.endedAt ? { _endedAt: timing.endedAt } : {}),
    });
    return;
  }
  await ctx.updateEventMeta(
    event.id,
    form.type,
    form.meta,
    timing.startedAt,
    timing.endedAt ?? undefined
  );
}

/* ── Event Edit Sheet ──────────────────────────────────────── */

const CONFIRM_DELETE_MS = 4000;

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
  const [form, setForm] = useState<EventFormData>(() => formFor(event));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(formFor(event));
    setSubmitted(false);
    setSaveError(null);
    setConfirmDelete(false);
  }, [event, open]);

  useEffect(() => {
    if (!confirmDelete) return;
    const id = setTimeout(() => setConfirmDelete(false), CONFIRM_DELETE_MS);
    return () => clearTimeout(id);
  }, [confirmDelete]);

  const shape = entryShape(form.type, form.meta.method);
  const canRun = shape === "span" && (isNew || event?.endedAt === null);
  const errors = submitted ? validate(form, shape).errors : {};

  const handleTypeChange = useCallback(
    (type: EventType) =>
      setForm((f) => ({
        meta: DEFAULT_META[type],
        timing: changeTiming(f.timing, { running: false }),
        type,
      })),
    []
  );

  const handleMetaChange = useCallback((meta: Meta) => {
    setSaveError(null);
    setForm((f) => ({ ...f, meta }));
  }, []);

  const handleTimingChange = useCallback((patch: Partial<EntryTiming>) => {
    setSaveError(null);
    setForm((f) => ({ ...f, timing: changeTiming(f.timing, patch) }));
  }, []);

  const handleSave = useCallback(async () => {
    setSubmitted(true);
    setSaveError(null);
    const { errors: found, timing } = validate(form, shape);
    if (!timing.ok || Object.keys(found).length > 0) {
      requestAnimationFrame(() => {
        formRef.current
          ?.querySelector<HTMLElement>(
            "[aria-invalid='true'], fieldset[aria-describedby]"
          )
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    setSaving(true);
    let saved = false;
    try {
      await persist(form, timing, event, {
        logEventDirect,
        updateEventMeta,
      });
      saved = true;
    } catch (error) {
      console.error("[EventEditSheet] Save failed:", error);
    } finally {
      setSaving(false);
    }

    if (saved) {
      triggerFeedback("logged");
      onClose();
    } else {
      setSaveError("Couldn't save. Try again.");
    }
  }, [form, shape, event, logEventDirect, updateEventMeta, onClose]);

  const handleDelete = useCallback(async () => {
    if (!event) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteEvent(event.id);
    triggerFeedback("logged");
    onClose();
  }, [event, confirmDelete, deleteEvent, onClose]);

  return (
    <Sheet
      footer={
        <SheetActions
          confirmDelete={confirmDelete}
          isNew={isNew}
          onDelete={handleDelete}
          onSave={handleSave}
          saveError={saveError}
          saving={saving}
        />
      }
      onClose={onClose}
      open={open}
      title={isNew ? "Add entry" : "Edit entry"}
    >
      <div className="space-y-5 px-5 pb-4" ref={formRef}>
        {isNew && (
          <ChoiceChips
            legend="Type"
            onChange={handleTypeChange}
            options={EVENT_TYPES}
            value={form.type}
          />
        )}

        <MetaFields
          error={errors.meta}
          meta={form.meta}
          onChange={handleMetaChange}
          type={form.type}
        />

        <TimingFields
          canRun={canRun}
          errors={errors}
          onChange={handleTimingChange}
          shape={shape}
          timing={form.timing}
        />

        {form.type !== "note" && (
          <TextField
            field="notes"
            label="Notes"
            meta={form.meta}
            onChange={handleMetaChange}
            optional
            placeholder="Anything to remember?"
            rows={2}
          />
        )}
      </div>
    </Sheet>
  );
};
