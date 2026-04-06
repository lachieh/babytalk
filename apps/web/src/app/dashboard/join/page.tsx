"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { gqlRequest } from "@/lib/tambo/graphql";

const JOIN_HOUSEHOLD = `
  mutation JoinHousehold($inviteCode: String!) {
    joinHousehold(inviteCode: $inviteCode) { id }
  }
`;

const JoinContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-fill from URL param (?code=ABC123)
  useEffect(() => {
    const urlCode = searchParams.get("code");
    if (urlCode) setCode(urlCode);
  }, [searchParams]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setErrorMsg("");
      try {
        await gqlRequest(JOIN_HOUSEHOLD, { inviteCode: code });
        router.push("/dashboard");
      } catch (error) {
        setErrorMsg(error instanceof Error ? error.message : "Failed to join");
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-6">
      <div className="animate-fade-up w-full max-w-sm text-center">
        <h1 className="text-xl font-bold text-neutral-900">
          Join your partner
        </h1>
        <p className="mt-2 text-base text-neutral-500">
          Enter the code they shared with you.
        </p>
        <form className="mt-12 flex flex-col gap-3" onSubmit={handleSubmit}>
          <label htmlFor="invite-code" className="sr-only">
            Invite code
          </label>
          <input
            id="invite-code"
            className="rounded-md border border-neutral-200 bg-surface-raised px-4 py-4 text-center font-mono text-xl tracking-[0.25em] text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
            maxLength={8}
            onChange={handleChange}
            placeholder="ABC123"
            required
            type="text"
            value={code}
          />
          <button
            className="min-h-[44px] rounded-md bg-primary-500 px-6 py-3 text-base)] font-semibold text-white transition-[background-color,transform] duration-[var(--duration-normal)] ease-[var(--ease-out hover:bg-primary-600 active:scale-[0.98] disabled:opacity-50"
            disabled={loading || !code.trim()}
            type="submit"
          >
            {loading ? "Joining..." : "Join family"}
          </button>
          {errorMsg && <p className="text-sm text-danger-500">{errorMsg}</p>}
        </form>
      </div>
    </main>
  );
};

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-surface">
          <div className="h-8 w-8 animate-breathe rounded-full bg-primary-200" />
        </main>
      }
    >
      <JoinContent />
    </Suspense>
  );
}
