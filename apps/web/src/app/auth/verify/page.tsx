"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const VERIFY_MAGIC_LINK = `
  mutation VerifyMagicLink($token: String!) {
    verifyMagicLink(token: $token) {
      token
      user {
        id
        email
      }
    }
  }
`;

const VerifyContent = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("Missing token");
      return;
    }

    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/graphql";

    const verify = async () => {
      try {
        const res = await fetch(apiUrl, {
          body: JSON.stringify({
            query: VERIFY_MAGIC_LINK,
            variables: { token },
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        const data = await res.json();
        if (data.errors) {
          setError(data.errors[0].message);
          return;
        }

        const result = data.data.verifyMagicLink;
        if (!result) {
          setError("Invalid or expired link");
          return;
        }

        localStorage.setItem("babytalk_token", result.token);
        router.push("/dashboard");
      } catch {
        setError("Something went wrong");
      }
    };

    verify();
  }, [searchParams, router]);

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-spacing-xl">
        <div className="animate-fade-up max-w-sm text-center">
          <h1 className="text-[var(--font-size-xl)] font-bold text-danger-500">
            Something went wrong
          </h1>
          <p className="mt-spacing-sm text-[var(--font-size-base)] text-neutral-500">{error}</p>
          <Link
            href="/auth/login"
            className="mt-spacing-2xl inline-block text-[var(--font-size-base)] font-medium text-primary-500 transition-colors hover:text-primary-600"
          >
            Try again
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-spacing-xl">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-breathe rounded-full bg-primary-200" />
        <p className="mt-spacing-xl text-[var(--font-size-base)] text-neutral-500">
          Signing you in...
        </p>
      </div>
    </main>
  );
};

const VerifyPage = () => (
  <Suspense
    fallback={
      <main className="flex min-h-screen flex-col items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-breathe rounded-full bg-primary-200" />
      </main>
    }
  >
    <VerifyContent />
  </Suspense>
);

export default VerifyPage;
