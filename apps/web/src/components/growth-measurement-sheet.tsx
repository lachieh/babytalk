"use client";

import { useCallback, useId, useState } from "react";
import type { InputHTMLAttributes } from "react";

import { gqlRequest } from "@/lib/gql-request";
import { triggerFeedback } from "@/lib/haptics";
import { ymd } from "@/lib/history-days";

import { buildMeasurementPayload, initialFormValues } from "./growth-model";
import type { FormValues, Measurement } from "./growth-model";
import {
  FIELD_INPUT_CLASS,
  FIELD_LABEL_CLASS,
  FieldError,
  Sheet,
} from "./sheet";

const ADD_MEASUREMENT = `
  mutation AddMeasurement(
    $babyId: String!
    $measuredAt: String
    $weightG: Int
    $lengthMm: Int
    $headMm: Int
    $notes: String
  ) {
    addMeasurement(
      babyId: $babyId
      measuredAt: $measuredAt
      weightG: $weightG
      lengthMm: $lengthMm
      headMm: $headMm
      notes: $notes
    ) {
      id babyId measuredAt weightG lengthMm headMm notes
    }
  }
`;

const UPDATE_MEASUREMENT = `
  mutation UpdateMeasurement(
    $id: String!
    $measuredAt: String
    $weightG: Int
    $lengthMm: Int
    $headMm: Int
    $notes: String
  ) {
    updateMeasurement(
      id: $id
      measuredAt: $measuredAt
      weightG: $weightG
      lengthMm: $lengthMm
      headMm: $headMm
      notes: $notes
    ) {
      id babyId measuredAt weightG lengthMm headMm notes
    }
  }
`;

const DELETE_MEASUREMENT = `
  mutation DeleteMeasurement($id: String!) {
    deleteMeasurement(id: $id)
  }
`;

type FieldName = keyof FormValues;

const Field = ({
  name,
  label,
  value,
  onChange,
  ...input
}: {
  label: string;
  name: FieldName;
  onChange: (name: FieldName, value: string) => void;
  value: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "onChange">) => {
  const id = useId();
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(name, e.target.value),
    [onChange, name]
  );
  return (
    <div className="min-w-0 flex-1">
      <label className={FIELD_LABEL_CLASS} htmlFor={id}>
        {label}
      </label>
      <input
        className={`${FIELD_INPUT_CLASS} tabular-nums`}
        id={id}
        onChange={handleChange}
        value={value}
        {...input}
      />
    </div>
  );
};

const NUMBER_INPUT = {
  inputMode: "decimal",
  min: "0",
  type: "number",
} as const;

interface MeasurementSheetProps {
  babyId: string;
  imperial: boolean;
  measurement: Measurement | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onSaved: () => void;
}

const MeasurementForm = ({
  imperial,
  babyId,
  measurement,
  onClose,
  onSaved,
  onDeleted,
}: MeasurementSheetProps) => {
  const [values, setValues] = useState(() =>
    initialFormValues(measurement, imperial, new Date())
  );
  const [maxDate] = useState(() => ymd(new Date()));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const handleChange = useCallback((name: FieldName, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!values.date) {
      setError("Choose the date this was measured.");
      return;
    }
    const payload = buildMeasurementPayload(values, imperial);
    if (
      payload.weightG === null &&
      payload.lengthMm === null &&
      payload.headMm === null
    ) {
      setError("Enter a weight, length or head circumference to save.");
      return;
    }
    setSaving(true);
    try {
      await (measurement
        ? gqlRequest(UPDATE_MEASUREMENT, { id: measurement.id, ...payload })
        : gqlRequest(ADD_MEASUREMENT, { babyId, ...payload }));
      triggerFeedback("logged");
      onSaved();
      onClose();
    } catch {
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }, [values, imperial, measurement, babyId, onSaved, onClose]);

  const handleDelete = useCallback(async () => {
    if (!measurement) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await gqlRequest(DELETE_MEASUREMENT, { id: measurement.id });
      triggerFeedback("logged");
      onDeleted(measurement.id);
      onClose();
    } catch {
      setError("That didn't delete. Check your connection and try again.");
    }
  }, [measurement, confirmDelete, onDeleted, onClose]);

  const lengthUnit = imperial ? "in" : "cm";
  const describedBy = error ? errorId : undefined;

  return (
    <Sheet
      footer={
        <div className="flex flex-col gap-2 pb-4">
          <button
            className="min-h-[48px] w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-primary-700 active:scale-[0.98] disabled:opacity-40 motion-reduce:active:scale-100"
            disabled={saving}
            onClick={handleSave}
            type="button"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {measurement && (
            <button
              className="min-h-[48px] rounded-xl border border-danger-200 px-4 py-3 text-sm font-medium text-danger-500 transition-colors hover:bg-danger-50"
              onClick={handleDelete}
              type="button"
            >
              {confirmDelete ? "Tap again to delete" : "Delete measurement"}
            </button>
          )}
        </div>
      }
      onClose={onClose}
      open
      title={measurement ? "Edit measurement" : "Add measurement"}
    >
      <div className="space-y-5 px-5 pb-2">
        <Field
          label="Date measured"
          max={maxDate}
          name="date"
          onChange={handleChange}
          type="date"
          value={values.date}
        />

        {imperial ? (
          <fieldset>
            <legend className={FIELD_LABEL_CLASS}>Weight</legend>
            <div className="mt-2 flex gap-3">
              <Field
                {...NUMBER_INPUT}
                aria-describedby={describedBy}
                label="Pounds (lb)"
                name="weightLb"
                onChange={handleChange}
                step="1"
                value={values.weightLb}
              />
              <Field
                {...NUMBER_INPUT}
                label="Ounces (oz)"
                name="weightOz"
                onChange={handleChange}
                step="0.1"
                value={values.weightOz}
              />
            </div>
          </fieldset>
        ) : (
          <Field
            {...NUMBER_INPUT}
            aria-describedby={describedBy}
            label="Weight (kg)"
            name="weightKg"
            onChange={handleChange}
            step="0.01"
            value={values.weightKg}
          />
        )}

        <Field
          {...NUMBER_INPUT}
          label={`Length (${lengthUnit})`}
          name="length"
          onChange={handleChange}
          step="0.1"
          value={values.length}
        />
        <Field
          {...NUMBER_INPUT}
          label={`Head circumference (${lengthUnit})`}
          name="head"
          onChange={handleChange}
          step="0.1"
          value={values.head}
        />
        <Field
          label="Notes (optional)"
          name="notes"
          onChange={handleChange}
          type="text"
          value={values.notes}
        />

        <FieldError id={errorId} message={error} />
      </div>
    </Sheet>
  );
};

export const MeasurementSheet = ({
  open,
  ...form
}: MeasurementSheetProps & { open: boolean }) =>
  open ? (
    <MeasurementForm key={form.measurement?.id ?? "new"} {...form} />
  ) : null;
