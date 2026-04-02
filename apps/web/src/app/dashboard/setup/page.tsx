"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { gqlRequest } from "@/lib/tambo/graphql";

const CREATE_HOUSEHOLD = `
  mutation { createHousehold { id inviteCode } }
`;

const ADD_BABY = `
  mutation AddBaby($name: String!, $birthDate: String!, $birthWeightG: Int) {
    addBaby(name: $name, birthDate: $birthDate, birthWeightG: $birthWeightG) {
      id name
    }
  }
`;

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"welcome" | "baby">("welcome");
  const [inviteCode, setInviteCode] = useState("");
  const [babyName, setBabyName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthWeightG, setBirthWeightG] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateHousehold = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await gqlRequest<{
        createHousehold: { id: string; inviteCode: string };
      }>(CREATE_HOUSEHOLD);
      setInviteCode(data.createHousehold.inviteCode);
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
        await gqlRequest(ADD_BABY, {
          birthDate,
          birthWeightG: birthWeightG ? Number(birthWeightG) : null,
          name: babyName,
        });
        router.push("/dashboard");
      } catch (error) {
        setErrorMsg(
          error instanceof Error ? error.message : "Failed to add baby"
        );
      } finally {
        setLoading(false);
      }
    },
    [babyName, birthDate, birthWeightG, router]
  );

  const handleBabyNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setBabyName(e.target.value),
    []
  );

  const handleBirthDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setBirthDate(e.target.value),
    []
  );

  const handleWeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setBirthWeightG(e.target.value),
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

        {inviteCode && (
          <div className="mt-6 rounded-md bg-primary-50 p-4 text-center">
            <p className="text-xs font-medium text-neutral-400">
              Share this code with your partner
            </p>
            <p className="mt-1 font-mono text-lg font-bold tracking-widest text-primary-500">
              {inviteCode}
            </p>
          </div>
        )}

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
            <label
              htmlFor="birth-weight"
              className="block text-sm font-medium text-neutral-600"
            >
              Birth weight
              <span className="ml-1 text-neutral-300">optional</span>
            </label>
            <input
              id="birth-weight"
              className="mt-1 w-full rounded-md border border-neutral-200 bg-surface-raised px-4 py-3 text-base text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
              onChange={handleWeightChange}
              placeholder="Grams"
              type="number"
              value={birthWeightG}
            />
          </div>
          <button
            className="mt-2 min-h-[56px] rounded-lg bg-primary-500 px-6 py-3 text-base)] font-semibold text-white transition-[background-color,transform] duration-[var(--duration-normal)] ease-[var(--ease-out hover:bg-primary-600 active:scale-[0.98] disabled:opacity-50"
            disabled={loading || !babyName || !birthDate}
            type="submit"
          >
            {loading ? "Adding..." : "Start tracking"}
          </button>
          {errorMsg && <p className="text-sm text-danger-500">{errorMsg}</p>}
        </form>
      </div>
    </main>
  );
}
