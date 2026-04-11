"use client";

import { useCallback, useEffect, useState } from "react";

import { triggerFeedback } from "@/lib/haptics";
import { gqlRequest } from "@/lib/tambo/graphql";

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

  useEffect(() => {
    if (!open || !baby) return;
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
    } finally {
      setSaving(false);
    }
  }, [baby, name, birthDate, weightLbs, weightOz, gender, onSaved, onClose]);

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
    (e: React.ChangeEvent<HTMLSelectElement>) => setGender(e.target.value),
    []
  );

  if (!open || !baby) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/30"
      onClick={handleBackdrop}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Edit baby"
    >
      <div className="w-full max-w-lg rounded-t-2xl bg-surface-raised shadow-lg safe-bottom">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>
        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <h2 className="text-base font-semibold text-neutral-700">
            Edit baby
          </h2>
          <button
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100"
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

        <div className="space-y-4 px-5 pb-6">
          <label className="block text-xs font-medium text-neutral-500">
            Name
            <input
              className="mt-1 block w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2.5 text-sm text-neutral-800"
              onChange={handleNameChange}
              type="text"
              value={name}
            />
          </label>

          <label className="block text-xs font-medium text-neutral-500">
            Gender
            <select
              className="mt-1 block w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2.5 text-sm text-neutral-800"
              onChange={handleGenderChange}
              value={gender}
            >
              <option value="">Prefer not to say</option>
              <option value="male">Boy</option>
              <option value="female">Girl</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="block text-xs font-medium text-neutral-500">
            Birthday
            <input
              className="mt-1 block w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2.5 text-sm text-neutral-800"
              onChange={handleDateChange}
              type="date"
              value={birthDate}
            />
          </label>

          <div>
            <p className="text-xs font-medium text-neutral-500">Birth weight</p>
            <div className="mt-1 flex gap-2">
              <input
                className="min-h-[44px] flex-1 rounded-lg border border-neutral-200 bg-surface px-3 py-2 text-sm text-neutral-800"
                inputMode="numeric"
                onChange={handleLbsChange}
                placeholder="lbs"
                type="number"
                value={weightLbs}
              />
              <input
                className="min-h-[44px] flex-1 rounded-lg border border-neutral-200 bg-surface px-3 py-2 text-sm text-neutral-800"
                inputMode="decimal"
                onChange={handleOzChange}
                placeholder="oz"
                step="0.1"
                type="number"
                value={weightOz}
              />
            </div>
          </div>

          <button
            className="min-h-[48px] w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.97] disabled:opacity-40"
            disabled={saving || !name}
            onClick={handleSave}
            type="button"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};
