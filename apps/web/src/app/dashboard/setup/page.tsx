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
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <h1 className="text-2xl font-bold">Welcome to BabyTalk</h1>
        <p className="mt-4 text-center text-gray-600">
          Create a household to start tracking, or join an existing one.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
            onClick={handleCreateHousehold}
            type="button"
          >
            {loading ? "Creating..." : "Create Household"}
          </button>
          <Link
            className="text-center text-sm text-blue-600 hover:underline"
            href="/dashboard/join"
          >
            Join an existing household
          </Link>
        </div>
        {errorMsg && <p className="mt-4 text-red-500">{errorMsg}</p>}
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold">Add Your Baby</h1>
      {inviteCode && (
        <div className="mt-4 rounded-lg bg-blue-50 p-3 text-center">
          <p className="text-xs text-gray-500">
            Share this code with your partner
          </p>
          <p className="font-mono text-lg font-bold text-blue-600">
            {inviteCode}
          </p>
        </div>
      )}
      <form
        className="mt-6 flex w-full max-w-sm flex-col gap-4"
        onSubmit={handleAddBaby}
      >
        <input
          className="rounded-lg border px-4 py-2"
          onChange={handleBabyNameChange}
          placeholder="Baby's name"
          required
          type="text"
          value={babyName}
        />
        <input
          className="rounded-lg border px-4 py-2"
          onChange={handleBirthDateChange}
          required
          type="date"
          value={birthDate}
        />
        <input
          className="rounded-lg border px-4 py-2"
          onChange={handleWeightChange}
          placeholder="Birth weight in grams (optional)"
          type="number"
          value={birthWeightG}
        />
        <button
          className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={loading}
          type="submit"
        >
          {loading ? "Adding..." : "Add Baby"}
        </button>
        {errorMsg && <p className="text-red-500">{errorMsg}</p>}
      </form>
    </main>
  );
}
