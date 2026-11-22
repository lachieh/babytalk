"use client";

import { useCallback, useEffect, useState } from "react";

import { gqlRequest } from "@/lib/gql-request";
import { triggerFeedback } from "@/lib/haptics";

import {
  ChoiceChips,
  FIELD_INPUT_CLASS,
  FIELD_LABEL_CLASS,
  Sheet,
} from "./sheet";
import type { ChipOption } from "./sheet";

/* ── Types ─────────────────────────────────────────────────── */

interface BabyData {
  id: string;
  name: string;
  birthDate: string;
  birthWeightG: number | null;
  gender: string | null;
}

/* ── GraphQL ───────────────────────────────────────────────── */

const UPDATE_BABY = `
  mutation UpdateBaby($id: String!, $name: String, $birthDate: String, $birthWeightG: Int, $gender: Gender) {
    updateBaby(id: $id, name: $name, birthDate: $birthDate, birthWeightG: $birthWeightG, gender: $gender) {
      id name birthDate birthWeightG gender
    }
  }
`;

/* ── Helpers ───────────────────────────────────────────────── */

function gramsToLbOz(g: number): { lbs: string; oz: string } {
  const lbs = Math.floor(g / 453.592);
  const oz = Math.round((g % 453.592) / 28.3495);
  return { lbs: String(lbs), oz: String(oz) };
}

function lbOzToGrams(lbs: string, oz: string): number | null {
  const l = Number(lbs) || 0;
  const o = Number(oz) || 0;
  if (l === 0 && o === 0) return null;
  return Math.round(l * 453.592 + o * 28.3495);
}

type GenderKey = "male" | "female" | "other" | "unset";

const GENDERS: readonly ChipOption<GenderKey>[] = [
  { label: "Boy", value: "male" },
  { label: "Girl", value: "female" },
  { label: "Other", value: "other" },
  { label: "Prefer not to say", value: "unset" },
];

/* ── Component ─────────────────────────────────────────────── */

export const EditBabySheet = ({
  baby,
  open,
  onClose,
  onSaved,
}: {
  baby: BabyData | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [weightOz, setWeightOz] = useState("");
  const [gender, setGender] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !baby) return;
    setSaveError(null);
    setName(baby.name);
    setBirthDate(baby.birthDate);
    setGender(baby.gender ?? "");
    if (baby.birthWeightG === null) {
      setWeightLbs("");
      setWeightOz("");
    } else {
      const { lbs, oz } = gramsToLbOz(baby.birthWeightG);
      setWeightLbs(lbs);
      setWeightOz(oz);
    }
  }, [baby, open]);

  const handleSave = useCallback(async () => {
    if (!baby) return;
    setSaving(true);
    setSaveError(null);
    try {
      await gqlRequest(UPDATE_BABY, {
        id: baby.id,
        name: name || undefined,
        birthDate: birthDate || undefined,
        birthWeightG: lbOzToGrams(weightLbs, weightOz),
        gender: gender || null,
      });
      triggerFeedback("logged");
      onSaved();
      onClose();
    } catch (error) {
      console.error("[EditBabySheet]", error);
      setSaveError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }, [baby, name, birthDate, weightLbs, weightOz, gender, onSaved, onClose]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value),
    []
  );
  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setBirthDate(e.target.value),
    []
  );
  const handleLbsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setWeightLbs(e.target.value),
    []
  );
  const handleOzChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setWeightOz(e.target.value),
    []
  );
  const handleGenderChange = useCallback(
    (key: GenderKey) => setGender(key === "unset" ? "" : key),
    []
  );

  return (
    <Sheet
      footer={
        <>
          {saveError && (
            <p
              className="mb-3 text-center text-sm text-danger-500"
              role="alert"
            >
              {saveError}
            </p>
          )}
          <button
            className="min-h-[48px] w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.97] disabled:opacity-40"
            disabled={saving || !name}
            onClick={handleSave}
            type="button"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
      onClose={onClose}
      open={open && baby !== null}
      title="Edit baby"
    >
      <div className="space-y-5 px-5 pb-4">
        <label className={FIELD_LABEL_CLASS}>
          Name
          <input
            autoComplete="off"
            className={FIELD_INPUT_CLASS}
            onChange={handleNameChange}
            type="text"
            value={name}
          />
        </label>

        <ChoiceChips
          legend="Gender"
          onChange={handleGenderChange}
          options={GENDERS}
          value={(gender || "unset") as GenderKey}
        />

        <label className={FIELD_LABEL_CLASS}>
          Birthday
          <input
            className={FIELD_INPUT_CLASS}
            onChange={handleDateChange}
            type="date"
            value={birthDate}
          />
        </label>

        <fieldset>
          <legend className={FIELD_LABEL_CLASS}>Birth weight</legend>
          <div className="flex gap-3">
            <label className="flex-1 text-sm text-neutral-600">
              <span className="sr-only">Pounds</span>
              <span className="relative block">
                <input
                  className={`${FIELD_INPUT_CLASS} pr-10`}
                  inputMode="numeric"
                  onChange={handleLbsChange}
                  type="number"
                  value={weightLbs}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-3 mt-1.5 flex items-center text-neutral-400"
                >
                  lb
                </span>
              </span>
            </label>
            <label className="flex-1 text-sm text-neutral-600">
              <span className="sr-only">Ounces</span>
              <span className="relative block">
                <input
                  className={`${FIELD_INPUT_CLASS} pr-10`}
                  inputMode="decimal"
                  onChange={handleOzChange}
                  step="0.1"
                  type="number"
                  value={weightOz}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-3 mt-1.5 flex items-center text-neutral-400"
                >
                  oz
                </span>
              </span>
            </label>
          </div>
        </fieldset>
      </div>
    </Sheet>
  );
};
