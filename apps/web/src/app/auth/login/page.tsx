"use client";

import { useCallback, useState } from "react";

import { gqlRequest } from "@/lib/tambo/graphql";
import { useRedirectIfLoggedIn } from "@/lib/use-redirect-if-logged-in";

const REQUEST_MAGIC_LINK = `
  mutation RequestMagicLink($email: String!) {
    requestMagicLink(email: $email)
  }
`;

export default function LoginPage() {
  useRedirectIfLoggedIn();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg("");

      const result = await gqlRequest<{ requestMagicLink: boolean }>(
        REQUEST_MAGIC_LINK,
        { email }
      ).catch((error: unknown) =>
        error instanceof Error ? error.message : "Something went wrong"
      );
      if (typeof result === "string") {
        setErrorMsg(result);
      } else {
        setSent(true);
      }
    },
    [email]
  );

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value);
    },
    []
  );

  if (sent) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-surface px-6 safe-bottom safe-top">
        <div className="animate-fade-up w-full max-w-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-100">
            <svg
              className="h-8 w-8 text-success-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="mt-6 text-xl font-bold text-neutral-900">
            Check your email
          </h1>
          <p className="mt-2 text-base text-neutral-500">
            We sent a sign-in link to{" "}
            <span className="font-medium text-neutral-700">{email}</span>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-surface px-6 safe-bottom safe-top">
      <div className="animate-fade-up w-full max-w-sm">
        <h1 className="text-center text-xl font-bold text-neutral-900">
          Welcome back
        </h1>
        <p className="mt-1 text-center text-sm text-neutral-400">
          Sign in with a magic link — no password needed
        </p>
        <form onSubmit={handleSubmit} className="mt-12 flex flex-col gap-3">
          <label htmlFor="login-email" className="sr-only">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={handleEmailChange}
            placeholder="you@example.com"
            required
            className="min-h-[48px] rounded-md border border-neutral-200 bg-surface-raised px-4 py-3 text-base)] text-neutral-800 placeholder:text-neutral-400 transition-colors duration-[var(--duration-fast focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
          />
          <button
            type="submit"
            className="min-h-[48px] rounded-md bg-primary-500 px-6 py-3 text-base)] font-semibold text-white transition-[background-color,transform] duration-[var(--duration-normal)] ease-[var(--ease-out hover:bg-primary-600 active:scale-[0.98]"
          >
            Send magic link
          </button>
          {errorMsg && (
            <p className="text-center text-sm text-danger-500">{errorMsg}</p>
          )}
        </form>
      </div>
    </main>
  );
}
