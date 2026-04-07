"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { gqlRequest } from "@/lib/tambo/graphql";

const CREATE_HOUSEHOLD = `
  mutation { createHousehold { id } }
`;

const ADD_BABY = `
  mutation AddBaby($name: String!, $birthDate: String!, $birthWeightG: Int) {
    addBaby(name: $name, birthDate: $birthDate, birthWeightG: $birthWeightG) {
      id name
    }
  }
`;

const INVITE_PARTNER = `
  mutation InvitePartner($email: String!) {
    invitePartner(email: $email)
  }
`;

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"welcome" | "baby">("welcome");
  const [babyName, setBabyName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthWeightLbs, setBirthWeightLbs] = useState("");
  const [birthWeightOz, setBirthWeightOz] = useState("");
  const [birthWeightG, setBirthWeightG] = useState("");
  const [weightUnit, setWeightUnit] = useState<"lb" | "g">("lb");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateHousehold = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      await gqlRequest(CREATE_HOUSEHOLD);
      setStep("baby");
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Failed to create household"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddBaby = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setErrorMsg("");
      try {
        let weightGrams: number | null = null;
        if (weightUnit === "lb" && (birthWeightLbs || birthWeightOz)) {
          const lbs = Number(birthWeightLbs) || 0;
          const oz = Number(birthWeightOz) || 0;
          weightGrams = Math.round(lbs * 453.592 + oz * 28.3495);
        } else if (weightUnit === "g" && birthWeightG) {
          weightGrams = Number(birthWeightG);
        }
        await gqlRequest(ADD_BABY, {
          birthDate,
          birthWeightG: weightGrams,
          name: babyName,
        });

        // Send partner invite if email provided
        if (partnerEmail.trim()) {
          try {
            await gqlRequest(INVITE_PARTNER, { email: partnerEmail.trim() });
          } catch {
            // Non-blocking — baby is already created, don't fail the whole flow
          }
        }

        router.push("/dashboard");
      } catch (error) {
        setErrorMsg(
          error instanceof Error ? error.message : "Failed to add baby"
        );
      } finally {
        setLoading(false);
      }
    },
    [
      babyName,
      birthDate,
      birthWeightLbs,
      birthWeightOz,
      birthWeightG,
      weightUnit,
      partnerEmail,
      router,
    ]
  );

  const handleBabyNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setBabyName(e.target.value),
    []
  );

  const handleBirthDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setBirthDate(e.target.value),
    []
  );

  const handleWeightLbsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setBirthWeightLbs(e.target.value),
    []
  );

  const handleWeightOzChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setBirthWeightOz(e.target.value),
    []
  );

  const handleWeightGChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setBirthWeightG(e.target.value),
    []
  );

  const handleSelectLb = useCallback(() => setWeightUnit("lb"), []);
  const handleSelectG = useCallback(() => setWeightUnit("g"), []);

  const handlePartnerEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setPartnerEmail(e.target.value),
    []
  );

  if (step === "welcome") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-6">
        <div className="animate-fade-up max-w-sm text-center">
          <p className="text-lg leading-relaxed text-neutral-500">
            Hey, you look tired.
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">
            We&apos;ve got this.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-neutral-400">
            BabyTalk tracks feeds, sleep, and diapers with just your voice. No
            typing, no tapping through menus — just talk.
          </p>

          <div className="mt-12 flex flex-col gap-3">
            <button
              className="min-h-[56px] rounded-lg bg-primary-500 px-6 py-4 text-base)] font-semibold text-white transition-[background-color,transform] duration-[var(--duration-normal)] ease-[var(--ease-out hover:bg-primary-600 active:scale-[0.98] disabled:opacity-50"
              disabled={loading}
              onClick={handleCreateHousehold}
              type="button"
            >
              {loading ? "Setting up..." : "Let\u2019s get started"}
            </button>
            <Link
              className="min-h-[44px] flex items-center justify-center text-sm font-medium text-primary-500 transition-colors hover:text-primary-600"
              href="/dashboard/join"
            >
              Join your partner&apos;s family
            </Link>
          </div>
          {errorMsg && (
            <p className="mt-4 text-sm text-danger-500">{errorMsg}</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-6">
      <div className="animate-fade-up w-full max-w-sm">
        <h1 className="text-center text-xl font-bold text-neutral-900">
          Tell us about your little one
        </h1>
        <p className="mt-2 text-center text-sm text-neutral-400">
          Just the basics — you can always update later.
        </p>

        <form className="mt-8 flex flex-col gap-3" onSubmit={handleAddBaby}>
          <div>
            <label
              htmlFor="baby-name"
              className="block text-sm font-medium text-neutral-600"
            >
              Name
            </label>
            <input
              id="baby-name"
              className="mt-1 w-full rounded-md border border-neutral-200 bg-surface-raised px-4 py-3 text-base text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
              onChange={handleBabyNameChange}
              placeholder="What do you call them?"
              required
              type="text"
              value={babyName}
            />
          </div>
          <div>
            <label
              htmlFor="birth-date"
              className="block text-sm font-medium text-neutral-600"
            >
              Birthday
            </label>
            <input
              id="birth-date"
              className="mt-1 w-full rounded-md border border-neutral-200 bg-surface-raised px-4 py-3 text-base text-neutral-800 transition-colors focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
              onChange={handleBirthDateChange}
              required
              type="date"
              value={birthDate}
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="birth-weight"
                className="block text-sm font-medium text-neutral-600"
              >
                Birth weight
                <span className="ml-1 text-neutral-300">optional</span>
              </label>
              <div className="flex rounded-md border border-neutral-200 text-xs">
                <button
                  className={`px-2.5 py-1 font-medium transition-colors ${weightUnit === "lb" ? "bg-primary-500 text-white rounded-l-md" : "text-neutral-400 hover:text-neutral-600"}`}
                  onClick={handleSelectLb}
                  type="button"
                >
                  lb
                </button>
                <button
                  className={`px-2.5 py-1 font-medium transition-colors ${weightUnit === "g" ? "bg-primary-500 text-white rounded-r-md" : "text-neutral-400 hover:text-neutral-600"}`}
                  onClick={handleSelectG}
                  type="button"
                >
                  g
                </button>
              </div>
            </div>
            {weightUnit === "lb" ? (
              <div className="mt-1 flex gap-2">
                <input
                  id="birth-weight"
                  className="w-full rounded-md border border-neutral-200 bg-surface-raised px-4 py-3 text-base text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                  onChange={handleWeightLbsChange}
                  placeholder="lbs"
                  type="number"
                  min="0"
                  max="20"
                  value={birthWeightLbs}
                />
                <input
                  id="birth-weight-oz"
                  className="w-full rounded-md border border-neutral-200 bg-surface-raised px-4 py-3 text-base text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                  onChange={handleWeightOzChange}
                  placeholder="oz"
                  type="number"
                  min="0"
                  max="15"
                  step="0.1"
                  value={birthWeightOz}
                />
              </div>
            ) : (
              <input
                id="birth-weight"
                className="mt-1 w-full rounded-md border border-neutral-200 bg-surface-raised px-4 py-3 text-base text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                onChange={handleWeightGChange}
                placeholder="Grams"
                type="number"
                value={birthWeightG}
              />
            )}
          </div>
          <div className="mt-4 border-t border-neutral-100 pt-4">
            <label
              htmlFor="partner-email"
              className="block text-sm font-medium text-neutral-600"
            >
              Invite your partner
              <span className="ml-1 text-neutral-300">optional</span>
            </label>
            <p className="mt-1 text-xs text-neutral-400">
              We&apos;ll send them a link to join your family
            </p>
            <input
              id="partner-email"
              className="mt-2 w-full rounded-md border border-neutral-200 bg-surface-raised px-4 py-3 text-base text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
              onChange={handlePartnerEmailChange}
              placeholder="partner@email.com"
              type="email"
              value={partnerEmail}
            />
          </div>
          <button
            className="mt-4 min-h-[56px] rounded-lg bg-primary-500 px-6 py-3 text-base)] font-semibold text-white transition-[background-color,transform] duration-[var(--duration-normal)] ease-[var(--ease-out hover:bg-primary-600 active:scale-[0.98] disabled:opacity-50"
            disabled={loading || !babyName || !birthDate}
            type="submit"
          >
            {loading ? "Setting up..." : "Start tracking"}
          </button>
          {errorMsg && <p className="text-sm text-danger-500">{errorMsg}</p>}
        </form>
      </div>
    </main>
  );
}
