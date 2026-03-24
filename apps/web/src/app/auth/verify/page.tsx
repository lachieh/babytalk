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
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <h1 className="text-2xl font-bold text-red-600">Error</h1>
        <p className="mt-4 text-gray-600">{error}</p>
        <Link href="/auth/login" className="mt-8 text-blue-600 hover:underline">
          Try again
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-2xl font-bold">Verifying...</h1>
      <p className="mt-4 text-gray-600">Please wait while we sign you in.</p>
    </main>
  );
};

const VerifyPage = () => (
  <Suspense
    fallback={
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <p>Loading...</p>
      </main>
    }
  >
    <VerifyContent />
  </Suspense>
);

export default VerifyPage;
