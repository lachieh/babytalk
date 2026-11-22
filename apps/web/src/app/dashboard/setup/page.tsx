"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";

import { gqlRequest } from "@/lib/gql-request";
import { useAutoDarkMode } from "@/lib/use-auto-dark-mode";

const CHECK_HOUSEHOLD = `
  query { myHousehold { id } }
`;

const CREATE_HOUSEHOLD = `
  mutation { createHousehold { id } }
`;

const ADD_BABY = `
  mutation AddBaby($name: String!, $birthDate: String!, $birthWeightG: Int, $gender: Gender) {
    addBaby(name: $name, birthDate: $birthDate, birthWeightG: $birthWeightG, gender: $gender) {
      id name
    }
  }
`;

const INVITE_PARTNER = `
  mutation InvitePartner($email: String!) {
    invitePartner(email: $email)
  }
`;

const inputClass =
  "mt-1 min-h-[48px] w-full rounded-xl border border-neutral-200 bg-surface-raised px-4 py-3 text-base text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:border-primary-400";

const labelClass = "block text-sm font-medium text-neutral-600";

const primaryButtonClass =
  "min-h-[56px] w-full rounded-xl bg-primary-500 px-6 py-4 text-base font-semibold text-white transition-[background-color,transform] duration-[var(--duration-normal)] ease-[var(--ease-out)] hover:bg-primary-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-600 disabled:active:scale-100";

const Screen = ({ children }: { children: React.ReactNode }) => (
  <main className="h-dvh overflow-y-auto overscroll-contain bg-surface">
    <div className="flex min-h-full flex-col items-center justify-center px-6 safe-bottom safe-top">
      {children}
    </div>
  </main>
);

const OptionalTag = () => (
  <span className="ml-1 font-normal text-neutral-500">(optional)</span>
);

const missingFieldsHint = (name: string, birthDate: string): string => {
  if (!name.trim() && !birthDate) return "Add a name and birthday to continue.";
  if (!name.trim()) return "Add a name to continue.";
  if (!birthDate) return "Add a birthday to continue.";
  return "";
};

const unitButton = (active: boolean) =>
  `min-h-[44px] min-w-[52px] px-4 text-sm font-medium transition-colors ${
    active
      ? "rounded-lg bg-primary-500 text-white"
      : "rounded-lg text-neutral-600 hover:text-neutral-800"
  }`;

export default function SetupPage() {
  useAutoDarkMode();
  const router = useRouter();
  const hintId = useId();
  const [step, setStep] = useState<"welcome" | "baby" | "already-joined">(
    "welcome"
  );
  const [babyName, setBabyName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthWeightLbs, setBirthWeightLbs] = useState("");
  const [birthWeightOz, setBirthWeightOz] = useState("");
  const [birthWeightG, setBirthWeightG] = useState("");
  const [weightUnit, setWeightUnit] = useState<"lb" | "g">("lb");
  const [gender, setGender] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if user already belongs to a household
  useEffect(() => {
    const check = async () => {
      try {
        const data = await gqlRequest<{
          myHousehold: { id: string } | null;
        }>(CHECK_HOUSEHOLD);
        if (data.myHousehold) {
          setStep("already-joined");
        }
      } catch {
        // Not authenticated or network error — the welcome step
        // will surface its own error when the user taps "Get started"
      }
    };
    check();
  }, []);

  const handleCreateHousehold = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      await gqlRequest(CREATE_HOUSEHOLD);
      setStep("baby");
    } catch {
      setErrorMsg(
        "We couldn't set up your family just now. Check your connection and try again."
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
          weightGrams = Math.round(Number(birthWeightG));
        }
        await gqlRequest(ADD_BABY, {
          birthDate,
          birthWeightG: weightGrams,
          gender: gender || null,
          name: babyName.trim(),
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
      } catch {
        setErrorMsg(
          "We couldn't save that just now. Your details are still here, so try again in a moment."
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
      gender,
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

  const handleGenderChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setGender(e.target.value),
    []
  );

  const handlePartnerEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setPartnerEmail(e.target.value),
    []
  );

  const handleToggleMore = useCallback(() => setShowMore((v) => !v), []);

  if (step === "already-joined") {
    return (
      <Screen>
        <div className="animate-fade-up w-full max-w-sm text-center">
          <p className="text-lg leading-relaxed text-neutral-500">
            Looks like you&apos;re already home.
          </p>
          <h1 className="mt-2 font-serif text-3xl text-neutral-900">
            You&apos;re all set.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-neutral-500">
            You already belong to a family. We don&apos;t support multiple
            households yet, but we&apos;d love to hear from you if that&apos;s
            something you need.
          </p>

          <div className="mt-12 flex flex-col gap-3">
            <Link
              className="flex min-h-[56px] items-center justify-center rounded-xl bg-primary-500 px-6 py-4 text-base font-semibold text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.98]"
              href="/dashboard"
            >
              Go to dashboard
            </Link>
            <a
              className="min-h-[44px] flex items-center justify-center text-sm font-medium text-primary-ink transition-colors hover:text-primary-ink"
              href="mailto:support@bubsie.app"
            >
              Get in touch
            </a>
          </div>
        </div>
      </Screen>
    );
  }

  if (step === "welcome") {
    return (
      <Screen>
        <div className="animate-fade-up w-full max-w-sm text-center">
          <p className="text-lg leading-relaxed text-neutral-500">
            Welcome. The days are long right now.
          </p>
          <h1 className="mt-2 font-serif text-3xl text-neutral-900">
            We&apos;ve got this.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-neutral-500">
            Bubsie keeps track of feeds, sleep, and diapers. Most things are a
            single tap, and everyone in the family stays caught up.
          </p>

          <div className="mt-12 flex flex-col gap-3">
            <button
              className={primaryButtonClass}
              disabled={loading}
              onClick={handleCreateHousehold}
              type="button"
            >
              {loading ? "Setting up..." : "Let’s get started"}
            </button>
            <Link
              className="min-h-[44px] flex items-center justify-center text-sm font-medium text-primary-ink transition-colors hover:text-primary-ink"
              href="/dashboard/join"
            >
              Join your partner&apos;s family
            </Link>
          </div>
          <p aria-live="polite" className="mt-4 text-sm text-danger-500">
            {errorMsg}
          </p>
        </div>
      </Screen>
    );
  }

  const hint = missingFieldsHint(babyName, birthDate);
  return (
    <Screen>
      <div className="animate-fade-up w-full max-w-sm">
        <h1 className="text-center font-serif text-3xl text-neutral-900">
          Tell us about your little one
        </h1>
        <p className="mt-2 text-center text-sm text-neutral-500">
          Just a name and birthday to start. You can change these later.
        </p>

        <form className="mt-8 flex flex-col gap-4" onSubmit={handleAddBaby}>
          <div>
            <label htmlFor="baby-name" className={labelClass}>
              Name
            </label>
            <input
              id="baby-name"
              autoComplete="off"
              className={inputClass}
              onChange={handleBabyNameChange}
              placeholder="What do you call them?"
              required
              type="text"
              value={babyName}
            />
          </div>
          <div>
            <label htmlFor="birth-date" className={labelClass}>
              Birthday
            </label>
            <input
              id="birth-date"
              className={inputClass}
              onChange={handleBirthDateChange}
              required
              type="date"
              value={birthDate}
            />
          </div>

          <div className="mt-2 border-t border-neutral-200 pt-2">
            <button
              aria-controls="setup-more"
              aria-expanded={showMore}
              className="flex min-h-[48px] w-full items-center justify-between rounded-xl text-left text-base font-medium text-neutral-700"
              onClick={handleToggleMore}
              type="button"
            >
              <span>
                Add more
                <span className="ml-1 text-sm font-normal text-neutral-500">
                  weight, gender, partner (optional)
                </span>
              </span>
              <svg
                aria-hidden="true"
                className={`h-5 w-5 text-neutral-500 transition-transform duration-[var(--duration-normal)] motion-reduce:transition-none ${showMore ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  d="M6 9l6 6 6-6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div
              className="flex flex-col gap-4 pt-2"
              hidden={!showMore}
              id="setup-more"
            >
              <div aria-labelledby="birth-weight-label" role="group">
                <div className="flex items-center justify-between gap-3">
                  <span className={labelClass} id="birth-weight-label">
                    Birth weight
                    <OptionalTag />
                  </span>
                  <div
                    aria-label="Weight unit"
                    className="flex rounded-xl border border-neutral-200 p-0.5"
                    role="group"
                  >
                    <button
                      aria-pressed={weightUnit === "lb"}
                      className={unitButton(weightUnit === "lb")}
                      onClick={handleSelectLb}
                      type="button"
                    >
                      lb
                    </button>
                    <button
                      aria-pressed={weightUnit === "g"}
                      className={unitButton(weightUnit === "g")}
                      onClick={handleSelectG}
                      type="button"
                    >
                      g
                    </button>
                  </div>
                </div>
                {weightUnit === "lb" ? (
                  <div className="mt-2 flex gap-2">
                    <div className="flex-1">
                      <label
                        className="text-xs text-neutral-500"
                        htmlFor="birth-weight-lb"
                      >
                        Pounds
                      </label>
                      <input
                        id="birth-weight-lb"
                        className={inputClass}
                        inputMode="numeric"
                        max="20"
                        min="0"
                        onChange={handleWeightLbsChange}
                        type="number"
                        value={birthWeightLbs}
                      />
                    </div>
                    <div className="flex-1">
                      <label
                        className="text-xs text-neutral-500"
                        htmlFor="birth-weight-oz"
                      >
                        Ounces
                      </label>
                      <input
                        id="birth-weight-oz"
                        className={inputClass}
                        inputMode="decimal"
                        max="15.9"
                        min="0"
                        onChange={handleWeightOzChange}
                        step="0.1"
                        type="number"
                        value={birthWeightOz}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <label
                      className="text-xs text-neutral-500"
                      htmlFor="birth-weight-g"
                    >
                      Grams
                    </label>
                    <input
                      id="birth-weight-g"
                      className={inputClass}
                      inputMode="numeric"
                      max="9000"
                      min="0"
                      onChange={handleWeightGChange}
                      type="number"
                      value={birthWeightG}
                    />
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="gender" className={labelClass}>
                  Gender
                  <OptionalTag />
                </label>
                <select
                  id="gender"
                  className={inputClass}
                  onChange={handleGenderChange}
                  value={gender}
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Boy</option>
                  <option value="female">Girl</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="partner-email" className={labelClass}>
                  Invite your partner
                  <OptionalTag />
                </label>
                <p
                  className="mt-1 text-sm text-neutral-500"
                  id="partner-email-hint"
                >
                  We&apos;ll email them a link to join your family.
                </p>
                <input
                  id="partner-email"
                  aria-describedby="partner-email-hint"
                  autoComplete="off"
                  className={`${inputClass} mt-2`}
                  onChange={handlePartnerEmailChange}
                  placeholder="partner@email.com"
                  type="email"
                  value={partnerEmail}
                />
              </div>
            </div>
          </div>

          <div className="mt-2">
            <button
              aria-describedby={hint ? hintId : undefined}
              className={primaryButtonClass}
              disabled={loading || Boolean(hint)}
              type="submit"
            >
              {loading ? "Setting up..." : "Start tracking"}
            </button>
            <p
              aria-live="polite"
              className="mt-2 min-h-5 text-center text-sm"
              id={hintId}
            >
              {errorMsg ? (
                <span className="text-danger-500">{errorMsg}</span>
              ) : (
                <span className="text-neutral-500">{hint}</span>
              )}
            </p>
          </div>
        </form>
      </div>
    </Screen>
  );
}
