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
  const [step, setStep] = useState<"household" | "baby">("household");
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

  if (step === "household") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-spacing-xl">
        <div className="animate-fade-up max-w-sm text-center">
          <p className="text-[var(--font-size-sm)] font-medium text-neutral-400">
            You look like you could use a hand
          </p>
          <h1 className="mt-spacing-xs text-[var(--font-size-2xl)] font-bold tracking-tight text-neutral-900">
            Welcome to BabyTalk
          </h1>
          <p className="mt-spacing-lg text-[var(--font-size-base)] leading-relaxed text-neutral-500">
            Let&apos;s set up your family so you can start tracking with just your voice.
          </p>
          <div className="mt-spacing-3xl flex flex-col gap-spacing-md">
            <button
              className="min-h-[44px] rounded-radius-md bg-primary-500 px-spacing-xl py-spacing-md text-[var(--font-size-base)] font-semibold text-white transition-[background-color,transform] duration-[var(--duration-normal)] ease-[var(--ease-out)] hover:bg-primary-600 active:scale-[0.98] disabled:opacity-50"
              disabled={loading}
              onClick={handleCreateHousehold}
              type="button"
            >
              {loading ? "Setting up..." : "Create your family"}
            </button>
            <Link
              className="min-h-[44px] flex items-center justify-center text-[var(--font-size-sm)] font-medium text-primary-500 transition-colors hover:text-primary-600"
              href="/dashboard/join"
            >
              Join your partner&apos;s family
            </Link>
          </div>
          {errorMsg && (
            <p className="mt-spacing-lg text-[var(--font-size-sm)] text-danger-500">{errorMsg}</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-spacing-xl">
      <div className="animate-fade-up w-full max-w-sm">
        <h1 className="text-center text-[var(--font-size-xl)] font-bold text-neutral-900">
          Tell us about your baby
        </h1>

        {inviteCode && (
          <div className="mt-spacing-xl rounded-radius-md bg-primary-50 p-spacing-lg text-center">
            <p className="text-[var(--font-size-xs)] font-medium text-neutral-400">
              Share this code with your partner
            </p>
            <p className="mt-spacing-xs font-mono text-[var(--font-size-lg)] font-bold tracking-widest text-primary-500">
              {inviteCode}
            </p>
          </div>
        )}

        <form
          className="mt-spacing-2xl flex flex-col gap-spacing-md"
          onSubmit={handleAddBaby}
        >
          <div>
            <label
              htmlFor="baby-name"
              className="block text-[var(--font-size-sm)] font-medium text-neutral-600"
            >
              Name
            </label>
            <input
              id="baby-name"
              className="mt-spacing-xs w-full rounded-radius-md border border-neutral-200 bg-surface-raised px-spacing-lg py-spacing-md text-[var(--font-size-base)] text-neutral-800 placeholder:text-neutral-300 transition-colors focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
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
              className="block text-[var(--font-size-sm)] font-medium text-neutral-600"
            >
              Birthday
            </label>
            <input
              id="birth-date"
              className="mt-spacing-xs w-full rounded-radius-md border border-neutral-200 bg-surface-raised px-spacing-lg py-spacing-md text-[var(--font-size-base)] text-neutral-800 transition-colors focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
              onChange={handleBirthDateChange}
              required
              type="date"
              value={birthDate}
            />
          </div>
          <div>
            <label
              htmlFor="birth-weight"
              className="block text-[var(--font-size-sm)] font-medium text-neutral-600"
            >
              Birth weight
              <span className="ml-spacing-xs text-neutral-300">optional</span>
            </label>
            <input
              id="birth-weight"
              className="mt-spacing-xs w-full rounded-radius-md border border-neutral-200 bg-surface-raised px-spacing-lg py-spacing-md text-[var(--font-size-base)] text-neutral-800 placeholder:text-neutral-300 transition-colors focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
              onChange={handleWeightChange}
              placeholder="Grams"
              type="number"
              value={birthWeightG}
            />
          </div>
          <button
            className="mt-spacing-sm min-h-[44px] rounded-radius-md bg-primary-500 px-spacing-xl py-spacing-md text-[var(--font-size-base)] font-semibold text-white transition-[background-color,transform] duration-[var(--duration-normal)] ease-[var(--ease-out)] hover:bg-primary-600 active:scale-[0.98] disabled:opacity-50"
            disabled={loading}
            type="submit"
          >
            {loading ? "Adding..." : "Continue"}
          </button>
          {errorMsg && (
            <p className="text-[var(--font-size-sm)] text-danger-500">{errorMsg}</p>
          )}
        </form>
      </div>
    </main>
  );
}
