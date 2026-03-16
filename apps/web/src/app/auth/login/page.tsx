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
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="mt-4 text-gray-600">We sent a sign-in link to {email}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-2xl font-bold">Sign In</h1>
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <input
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="you@example.com"
          required
          className="rounded-lg border px-4 py-2"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
        >
          Send Magic Link
        </button>
        {error && <p className="text-red-500">{error}</p>}
      </form>
    </main>
  );
}
