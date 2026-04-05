"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { gqlRequest } from "@/lib/tambo/graphql";

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

    const verify = async () => {
      try {
        const result = await gqlRequest<{
          verifyMagicLink: {
            token: string;
            user: { id: string; email: string };
          } | null;
        }>(VERIFY_MAGIC_LINK, { token });

        if (!result.verifyMagicLink) {
          setError("Invalid or expired link");
          return;
        }

        localStorage.setItem("babytalk_token", result.verifyMagicLink.token);
        router.push("/dashboard");
      } catch {
        setError("Something went wrong");
      }
    };

    verify();
  }, [searchParams, router]);

  if (error) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-surface px-6 safe-bottom safe-top">
        <div className="animate-fade-up max-w-sm text-center">
          <h1 className="text-xl font-bold text-danger-500">
            Something went wrong
          </h1>
          <p className="mt-2 text-base text-neutral-500">{error}</p>
          <Link
            href="/auth/login"
            className="mt-8 inline-flex min-h-[44px] items-center text-base font-medium text-primary-500 transition-colors hover:text-primary-600"
          >
            Try again
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-surface px-6 safe-bottom safe-top">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-breathe rounded-full bg-primary-200" />
        <p className="mt-6 text-base text-neutral-500">Signing you in...</p>
      </div>
    </main>
  );
};

const VerifyPage = () => (
  <Suspense
    fallback={
      <main className="flex min-h-svh flex-col items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-breathe rounded-full bg-primary-200" />
      </main>
    }
  >
    <VerifyContent />
  </Suspense>
);

export default VerifyPage;
