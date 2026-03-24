"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { gqlRequest } from "@/lib/tambo/graphql";

const JOIN_HOUSEHOLD = `
  mutation JoinHousehold($inviteCode: String!) {
    joinHousehold(inviteCode: $inviteCode) { id }
  }
`;

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setErrorMsg("");
      try {
        await gqlRequest(JOIN_HOUSEHOLD, { inviteCode: code });
        router.push("/dashboard");
      } catch (error) {
        setErrorMsg(
          error instanceof Error ? error.message : "Failed to join household"
        );
      } finally {
        setLoading(false);
      }
    },
    [code, router]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value),
    []
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold">Join a Household</h1>
      <p className="mt-4 text-gray-600">
        Enter the invite code from your partner.
      </p>
      <form
        className="mt-6 flex w-full max-w-sm flex-col gap-4"
        onSubmit={handleSubmit}
      >
        <input
          className="rounded-lg border px-4 py-2 text-center font-mono text-lg tracking-wider"
          maxLength={8}
          onChange={handleChange}
          placeholder="Invite code"
          required
          type="text"
          value={code}
        />
        <button
          className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={loading || !code.trim()}
          type="submit"
        >
          {loading ? "Joining..." : "Join"}
        </button>
        {errorMsg && <p className="text-red-500">{errorMsg}</p>}
      </form>
    </main>
  );
}
