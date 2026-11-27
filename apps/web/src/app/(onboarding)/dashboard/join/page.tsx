"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { gqlRequest } from "@/lib/gql-request";

const JOIN_HOUSEHOLD = `
  mutation JoinHousehold($inviteCode: String!) {
    joinHousehold(inviteCode: $inviteCode) { id }
  }
`;

const INVITE_CODE_LENGTH = 8;
const normalizeCode = (value: string) =>
  value.replaceAll(/[^0-9a-f]/giu, "").toLowerCase();

const joinErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : "";
  if (message === "Invalid invite code") {
    return "We couldn't find a family with that code. Check it with your partner, or ask them to share the invite link again.";
  }
  if (message === "Already in a household") {
    return "You're already part of a family on Bubsie. Head to your dashboard.";
  }
  return "We couldn't join just now. Check your connection and try again.";
};

const codeHint = (length: number, remaining: number): string => {
  if (remaining <= 0) return "";
  if (length === 0) return "The code is 8 letters and numbers.";
  return `${remaining} more character${remaining === 1 ? "" : "s"} to go.`;
};

const JoinContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-fill from URL param (?code=ABC123)
  useEffect(() => {
    const urlCode = searchParams.get("code");
    if (urlCode) setCode(normalizeCode(urlCode).slice(0, INVITE_CODE_LENGTH));
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
        setErrorMsg(joinErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [code, router]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setCode(normalizeCode(e.target.value).slice(0, INVITE_CODE_LENGTH)),
    []
  );

  const remaining = INVITE_CODE_LENGTH - code.length;
  const hint = codeHint(code.length, remaining);

  return (
    <main className="h-dvh overflow-y-auto bg-surface">
      <div className="flex min-h-full flex-col items-center justify-center px-6 safe-bottom safe-top">
        <div className="animate-fade-up w-full max-w-sm text-center">
          <h1 className="font-serif text-3xl text-neutral-900">
            Join your partner
          </h1>
          <p className="mt-2 text-base text-neutral-500">
            Enter the code from their invite. If they sent you a link, opening
            it fills this in for you.
          </p>
          <form className="mt-10 flex flex-col gap-3" onSubmit={handleSubmit}>
            <label
              htmlFor="invite-code"
              className="text-sm font-medium text-neutral-600"
            >
              Invite code
            </label>
            <input
              id="invite-code"
              aria-describedby="invite-code-hint"
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              className="min-h-[56px] rounded-xl border border-neutral-200 bg-surface-raised px-4 py-4 text-center font-mono text-xl tracking-[0.25em] text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:border-primary-400"
              maxLength={INVITE_CODE_LENGTH}
              onChange={handleChange}
              placeholder="a1b2c3d4"
              required
              spellCheck={false}
              type="text"
              value={code}
            />
            <button
              aria-describedby="invite-code-hint"
              className="min-h-[56px] rounded-xl bg-primary-500 px-6 py-3 text-base font-semibold text-white transition-[background-color,transform] duration-[var(--duration-normal)] ease-[var(--ease-out)] hover:bg-primary-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-600 disabled:active:scale-100"
              disabled={loading || remaining > 0}
              type="submit"
            >
              {loading ? "Joining..." : "Join family"}
            </button>
            <p
              aria-live="polite"
              className="min-h-5 text-sm"
              id="invite-code-hint"
            >
              {errorMsg ? (
                <span className="text-danger-500">{errorMsg}</span>
              ) : (
                <span className="text-neutral-500">{hint}</span>
              )}
            </p>
          </form>
          <Link
            className="mt-6 inline-flex min-h-[44px] items-center justify-center text-sm font-medium text-primary-ink transition-colors hover:text-primary-ink"
            href="/dashboard/setup"
          >
            No code? Set up a new family instead
          </Link>
        </div>
      </div>
    </main>
  );
};

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="flex h-dvh items-center justify-center bg-surface">
          <div className="h-8 w-8 animate-breathe rounded-full bg-primary-200" />
        </main>
      }
    >
      <JoinContent />
    </Suspense>
  );
}
