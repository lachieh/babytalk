"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { parseMeta } from "@/lib/event-meta";
import type { EventType } from "@/lib/event-styles";
import {
  changeTiming,
  entryShape,
  resolveEntryTiming,
  timingFromEvent,
  toLocalInput,
} from "@/lib/event-time";
import type {
  EntryShape,
  EntryTiming,
  LengthChoice,
  TimeChoice,
} from "@/lib/event-time";
import { triggerFeedback } from "@/lib/haptics";
import { displayToMl, mlToDisplay, useVolumeUnit } from "@/lib/use-volume-unit";

import {
  ChoiceChips,
  FIELD_INPUT_CLASS,
  FIELD_LABEL_CLASS,
  FieldError,
  Sheet,
  ToggleChip,
} from "./sheet";
import type { ChipOption } from "./sheet";

/* ── Types ─────────────────────────────────────────────────── */

type Meta = Record<string, unknown>;

interface EventFormData {
  meta: Meta;
  timing: EntryTiming;
  type: EventType;
}

type FieldErrors = Partial<Record<"time" | "length" | "meta", string>>;

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

function lengthPresets(type: EventType): readonly number[] {
  if (type === "sleep") return [30, 45, 60, 90, 120, 180];
  if (type === "pump") return [10, 15, 20, 30];
  return [5, 10, 15, 20, 30];
}

const formatMinutes = (m: number): string => {
  if (m < 60) return `${m} min`;
  const h = m / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hr`;
};

const DEFAULT_META: Record<EventType, Meta> = {
  diaper: { soiled: false, wet: true },
  feed: { method: "breast", side: "left" },
  note: { text: "" },
  pump: { side: "left" },
  sleep: { location: "crib" },
};

const NOW: TimeChoice = { kind: "ago", minutes: 0 };

function formFor(event: BabyEvent | null): EventFormData {
  if (!event) {
    return {
      meta: DEFAULT_META.feed,
      timing: { length: null, running: false, time: NOW },
      type: "feed",
    };
  }
  const type = event.type as EventType;
  const meta = parseMeta(event.metadata);
  return {
    meta,
    timing: timingFromEvent(
      event,
      entryShape(type, meta.method),
      lengthPresets(type)
    ),
    type,
  };
}

const timeKey = (choice: TimeChoice | null): string | null => {
  if (!choice) return null;
  return choice.kind === "ago" ? String(choice.minutes) : "at";
};

const toPickedLocal = (choice: TimeChoice | null): string => {
  if (choice?.kind === "at" && choice.local) return choice.local;
  const minutes = choice?.kind === "ago" ? choice.minutes : 0;
  return toLocalInput(Date.now() - minutes * 60_000);
};

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

const TIME_OPTIONS: readonly ChipOption<string>[] = [
  { label: "Now", value: "0" },
  { label: "15 min ago", value: "15" },
  { label: "30 min ago", value: "30" },
  { label: "Pick a time", value: "at" },
];

const RUNNING = "running";

const TimeField = ({
  legend,
  choice,
  onChange,
  error,
  running,
  onRunningChange,
}: {
  choice: TimeChoice | null;
  error?: string;
  legend: string;
  onChange: (choice: TimeChoice) => void;
  onRunningChange?: (running: boolean) => void;
  running?: boolean;
}) => {
  const pickerId = useId();
  const options = onRunningChange
    ? [...TIME_OPTIONS, { label: "Still going", value: RUNNING }]
    : TIME_OPTIONS;

  const handleChoice = useCallback(
    (key: string) => {
      if (key === RUNNING) {
        onRunningChange?.(true);
        return;
      }
      if (running) onRunningChange?.(false);
      onChange(
        key === "at"
          ? { kind: "at", local: toPickedLocal(choice) }
          : { kind: "ago", minutes: Number(key) }
      );
    },
    [choice, onChange, onRunningChange, running]
  );

  const handlePicked = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ kind: "at", local: e.target.value }),
    [onChange]
  );

  const showPicker = !running && choice?.kind === "at";

  return (
    <div>
      <ChoiceChips
        error={showPicker ? undefined : (error ?? null)}
        legend={legend}
        onChange={handleChoice}
        options={options}
        value={running ? RUNNING : timeKey(choice)}
      />
      {showPicker && (
        <>
          <label className="sr-only" htmlFor={pickerId}>
            {legend}, date and time
          </label>
          <input
            aria-describedby={`${pickerId}-error`}
            aria-invalid={error ? true : undefined}
            className={FIELD_INPUT_CLASS}
            id={pickerId}
            max={toLocalInput(Date.now())}
            onChange={handlePicked}
            type="datetime-local"
            value={choice.local}
          />
          <FieldError id={`${pickerId}-error`} message={error} />
        </>
      )}
    </div>
  );
};

const LengthField = ({
  type,
  end,
  length,
  onChange,
  error,
}: {
  end: TimeChoice | null;
  error?: string;
  length: LengthChoice | null;
  onChange: (length: LengthChoice) => void;
  type: EventType;
}) => {
  const pickerId = useId();
  const presets = lengthPresets(type);
  const options: ChipOption<string>[] = [
    ...presets.map((m) => ({ label: formatMinutes(m), value: String(m) })),
    { label: "Pick start time", value: "start" },
  ];

  const handleChoice = useCallback(
    (key: string) => {
      if (key !== "start") {
        onChange({ kind: "minutes", minutes: Number(key) });
        return;
      }
      const endLocal = toPickedLocal(end);
      const minutes = length?.kind === "minutes" ? length.minutes : 15;
      onChange({
        kind: "start",
        local: toLocalInput(new Date(endLocal).getTime() - minutes * 60_000),
      });
    },
    [end, length, onChange]
  );

  const handlePicked = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ kind: "start", local: e.target.value }),
    [onChange]
  );

  let value: string | null = null;
  if (length)
    value = length.kind === "start" ? "start" : String(length.minutes);
  const showPicker = length?.kind === "start";

  return (
    <div>
      <ChoiceChips
        error={showPicker ? undefined : (error ?? null)}
        legend="How long"
        onChange={handleChoice}
        options={options}
        value={value}
      />
      {showPicker && (
        <>
          <label className="sr-only" htmlFor={pickerId}>
            Started, date and time
          </label>
          <input
            aria-describedby={`${pickerId}-error`}
            aria-invalid={error ? true : undefined}
            className={FIELD_INPUT_CLASS}
            id={pickerId}
            max={toLocalInput(Date.now())}
            onChange={handlePicked}
            type="datetime-local"
            value={length.local}
          />
          <FieldError id={`${pickerId}-error`} message={error} />
        </>
      )}
    </div>
  );
};

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
  const amount = typeof meta.amountMl === "number" ? meta.amountMl : 0;
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
  return (
    <label className={FIELD_LABEL_CLASS}>
      Amount ({unit})
      <span className="ml-1 font-normal text-neutral-400">optional</span>
      <input
        className={FIELD_INPUT_CLASS}
        inputMode="decimal"
        min="0"
        onChange={handleAmount}
        step="any"
        type="number"
        value={amount ? mlToDisplay(amount, unit) : ""}
      />
    </label>
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

function startOf(timing: EntryTiming): TimeChoice {
  const { length, time } = timing;
  if (length?.kind === "start") return { kind: "at", local: length.local };
  if (length && time) {
    const end = new Date(toPickedLocal(time)).getTime();
    return { kind: "at", local: toLocalInput(end - length.minutes * 60_000) };
  }
  return NOW;
}

const TimingFields = ({
  type,
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
  type: EventType;
}) => {
  const handleTime = useCallback(
    (time: TimeChoice) => onChange({ time }),
    [onChange]
  );
  const handleLength = useCallback(
    (length: LengthChoice) => onChange({ length }),
    [onChange]
  );
  const handleRunning = useCallback(
    (running: boolean) =>
      onChange(
        running
          ? { length: null, running: true, time: startOf(timing) }
          : { running: false }
      ),
    [onChange, timing]
  );

  if (shape === "instant") {
    return (
      <TimeField
        choice={timing.time}
        error={errors.time}
        legend="Time"
        onChange={handleTime}
      />
    );
  }

  return (
    <>
      <TimeField
        choice={timing.running ? null : timing.time}
        error={timing.running ? undefined : errors.time}
        legend="Ended"
        onChange={handleTime}
        onRunningChange={canRun ? handleRunning : undefined}
        running={timing.running}
      />
      {timing.running ? (
        <TimeField
          choice={timing.time}
          error={errors.time}
          legend="Started"
          onChange={handleTime}
        />
      ) : (
        <LengthField
          end={timing.time}
          error={errors.length}
          length={timing.length}
          onChange={handleLength}
          type={type}
        />
      )}
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
          type={form.type}
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
