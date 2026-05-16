"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { triggerFeedback } from "@/lib/haptics";
import { gqlRequest } from "@/lib/tambo/graphql";

const APPROVE_DEVICE_CODE = `
  mutation ApproveDeviceCode($code: String!) {
    approveDeviceCode(code: $code)
  }
`;

type Phase = "loading" | "approved" | "invalid" | "needs-login" | "error";

const ApproveContent = () => {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code") ?? "";
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const submit = useCallback(async () => {
    if (!code) {
      setPhase("invalid");
      setErrorMsg("Missing code");
      return;
    }
    const token =
      typeof window === "undefined"
        ? null
        : localStorage.getItem("babytalk_token");
    if (!token) {
      setPhase("needs-login");
      return;
    }
    setPhase("loading");
    setErrorMsg("");
    try {
      const data = await gqlRequest<{ approveDeviceCode: boolean }>(
        APPROVE_DEVICE_CODE,
        { code }
      );
      if (data.approveDeviceCode) {
        triggerFeedback("logged");
        setPhase("approved");
      } else {
        setPhase("invalid");
        setErrorMsg("That code isn't valid or has expired.");
      }
    } catch (error) {
      setPhase("error");
      setErrorMsg(
        error instanceof Error ? error.message : "Couldn't approve the device"
      );
    }
  }, [code]);

  useEffect(() => {
    submit();
  }, [submit]);

  const handleLogin = useCallback(() => {
    const redirect = `/auth/approve?code=${encodeURIComponent(code)}`;
    router.replace(`/auth/login?redirect=${encodeURIComponent(redirect)}`);
  }, [code, router]);

  if (phase === "loading") {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-surface px-6 safe-bottom safe-top">
        <div className="h-8 w-8 animate-breathe rounded-full bg-primary-200" />
        <p className="mt-6 text-sm text-neutral-500">Approving device...</p>
      </main>
    );
  }

  if (phase === "approved") {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-surface px-6 safe-bottom safe-top">
        <div className="animate-fade-up max-w-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-100">
            <svg
              aria-hidden="true"
              className="h-8 w-8 text-success-600"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M5 13l4 4L19 7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="mt-6 text-xl font-bold text-neutral-900">
            Device signed in
          </h1>
          <p className="mt-2 text-base text-neutral-500">
            The other device will switch to station mode automatically.
          </p>
          <Link
            className="mt-8 inline-flex min-h-[44px] items-center text-base font-medium text-primary-500 transition-colors hover:text-primary-600"
            href="/dashboard"
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (phase === "needs-login") {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-surface px-6 safe-bottom safe-top">
        <div className="animate-fade-up max-w-sm text-center">
          <h1 className="text-xl font-bold text-neutral-900">Sign in first</h1>
          <p className="mt-2 text-base text-neutral-500">
            You need to be signed in to approve a new device.
          </p>
          <button
            className="mt-8 inline-flex min-h-[48px] items-center rounded-md bg-primary-500 px-6 py-3 text-base font-semibold text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.98]"
            onClick={handleLogin}
            type="button"
          >
            Sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-surface px-6 safe-bottom safe-top">
      <div className="animate-fade-up max-w-sm text-center">
        <h1 className="text-xl font-bold text-danger-500">
          {phase === "invalid" ? "Code not valid" : "Something went wrong"}
        </h1>
        <p className="mt-2 text-base text-neutral-500">
          {errorMsg || "Try requesting a new code on the other device."}
        </p>
        <Link
          className="mt-8 inline-flex min-h-[44px] items-center text-base font-medium text-primary-500 transition-colors hover:text-primary-600"
          href="/dashboard"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
};

const ApprovePage = () => (
  <Suspense
    fallback={
      <main className="flex min-h-svh flex-col items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-breathe rounded-full bg-primary-200" />
      </main>
    }
  >
    <ApproveContent />
  </Suspense>
);

export default ApprovePage;
