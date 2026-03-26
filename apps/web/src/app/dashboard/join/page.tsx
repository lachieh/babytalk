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
          error instanceof Error ? error.message : "Failed to join"
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-spacing-xl">
      <div className="animate-fade-up w-full max-w-sm text-center">
        <h1 className="text-[var(--font-size-xl)] font-bold text-neutral-900">
          Join your partner
        </h1>
        <p className="mt-spacing-sm text-[var(--font-size-base)] text-neutral-500">
          Enter the code they shared with you.
        </p>
        <form
          className="mt-spacing-3xl flex flex-col gap-spacing-md"
          onSubmit={handleSubmit}
        >
          <label htmlFor="invite-code" className="sr-only">Invite code</label>
          <input
            id="invite-code"
            className="rounded-radius-md border border-neutral-200 bg-surface-raised px-spacing-lg py-spacing-lg text-center font-mono text-[var(--font-size-xl)] tracking-[0.25em] text-neutral-800 placeholder:text-neutral-300 transition-colors focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
            maxLength={8}
            onChange={handleChange}
            placeholder="ABC123"
            required
            type="text"
            value={code}
          />
          <button
            className="min-h-[44px] rounded-radius-md bg-primary-500 px-spacing-xl py-spacing-md text-[var(--font-size-base)] font-semibold text-white transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)] hover:bg-primary-600 active:scale-[0.98] disabled:opacity-50"
            disabled={loading || !code.trim()}
            type="submit"
          >
            {loading ? "Joining..." : "Join family"}
          </button>
          {errorMsg && (
            <p className="text-[var(--font-size-sm)] text-danger-500">{errorMsg}</p>
          )}
        </form>
      </div>
    </main>
  );
}
