"use client";

import { useCallback, useState } from "react";

const REQUEST_MAGIC_LINK = `
  mutation RequestMagicLink($email: String!) {
    requestMagicLink(email: $email)
  }
`;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/graphql";

      const res = await fetch(apiUrl, {
        body: JSON.stringify({
          query: REQUEST_MAGIC_LINK,
          variables: { email },
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const data = await res.json();
      if (data.errors) {
        setError(data.errors[0].message);
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
      <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-spacing-xl">
        <div className="animate-fade-up max-w-sm text-center">
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
          <h1 className="mt-spacing-xl text-[var(--font-size-xl)] font-bold text-neutral-900">
            Check your email
          </h1>
          <p className="mt-spacing-sm text-[var(--font-size-base)] text-neutral-500">
            We sent a sign-in link to{" "}
            <span className="font-medium text-neutral-700">{email}</span>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-spacing-xl">
      <div className="animate-fade-up w-full max-w-sm">
        <h1 className="text-center text-[var(--font-size-xl)] font-bold text-neutral-900">
          Welcome back
        </h1>
        <p className="mt-spacing-xs text-center text-[var(--font-size-sm)] text-neutral-400">
          Sign in with a magic link — no password needed
        </p>
        <form
          onSubmit={handleSubmit}
          className="mt-spacing-3xl flex flex-col gap-spacing-md"
        >
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
            className="rounded-radius-md border border-neutral-200 bg-surface-raised px-spacing-lg py-spacing-md text-[var(--font-size-base)] text-neutral-800 placeholder:text-neutral-400 transition-colors duration-[var(--duration-fast)] focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
          />
          <button
            type="submit"
            className="rounded-radius-md bg-primary-500 px-spacing-xl py-spacing-md text-[var(--font-size-base)] font-semibold text-white transition-[background-color,transform] duration-[var(--duration-normal)] ease-[var(--ease-out)] hover:bg-primary-600 active:scale-[0.98]"
          >
            Send magic link
          </button>
          {error && (
            <p className="text-center text-[var(--font-size-sm)] text-danger-500">
              {error}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
