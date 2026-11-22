"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { gqlRequest, storeSession } from "@/lib/gql-request";
import { useAutoDarkMode } from "@/lib/use-auto-dark-mode";
import { disableDeviceMode } from "@/lib/use-device-mode";

const VERIFY_MAGIC_LINK = `
  mutation VerifyMagicLink($token: String!) {
    verifyMagicLink(token: $token) {
      token
      refreshToken
      user {
        id
        email
      }
    }
  }
`;

const JOIN_HOUSEHOLD = `
  mutation JoinHousehold($inviteCode: String!) {
    joinHousehold(inviteCode: $inviteCode) { id }
  }
`;

type Failure = "incomplete" | "expired" | "network";

const FAILURE_COPY: Record<Failure, { title: string; body: string }> = {
  expired: {
    body: "Sign-in links work once and last 15 minutes. Send yourself a new one.",
    title: "This link has expired",
  },
  incomplete: {
    body: "Part of the link is missing. Try opening it from the email again, or send a new one.",
    title: "This link didn't open properly",
  },
  network: {
    body: "We couldn't reach Bubsie to sign you in. Check your connection and try again.",
    title: "We couldn't sign you in",
  },
};

const primaryButton =
  "inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary-500 px-6 py-3 text-base font-semibold text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.98]";

const VerifyContent = () => {
  useAutoDarkMode();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [failure, setFailure] = useState<Failure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const joinCode = searchParams.get("join");

  useEffect(() => {
    const token = searchParams.get("token");
    const redirectTo = searchParams.get("redirect");
    if (!token) {
      setFailure("incomplete");
      return;
    }

    const verify = async () => {
      try {
        const result = await gqlRequest<{
          verifyMagicLink: {
            token: string;
            refreshToken: string;
            user: { id: string; email: string };
          } | null;
        }>(VERIFY_MAGIC_LINK, { token });

        if (!result.verifyMagicLink) {
          setFailure("expired");
          return;
        }

        storeSession(
          result.verifyMagicLink.token,
          result.verifyMagicLink.refreshToken
        );
        disableDeviceMode();

        // If this is a partner invite link, auto-join the household
        if (joinCode) {
          try {
            await gqlRequest(JOIN_HOUSEHOLD, { inviteCode: joinCode });
          } catch {
            // Already in a household or invalid code — still proceed to dashboard
          }
        }

        // Check for redirect: URL param first, then localStorage (set by login page)
        let storedRedirect: string | null = null;
        if (typeof window === "undefined") {
          storedRedirect = null;
        } else {
          storedRedirect = localStorage.getItem("bubsie_auth_redirect");
          if (storedRedirect) {
            localStorage.removeItem("bubsie_auth_redirect");
          }
        }
        router.push(redirectTo ?? storedRedirect ?? "/dashboard");
      } catch {
        setFailure("network");
      }
    };

    setFailure(null);
    verify();
  }, [searchParams, router, joinCode, attempt]);

  const handleRetry = useCallback(() => setAttempt((n) => n + 1), []);

  if (failure) {
    const copy =
      failure === "expired" && joinCode
        ? {
            body: "Invite links work once and last 24 hours. Send yourself a sign-in link and you'll join the family straight after.",
            title: "This invite link has expired",
          }
        : FAILURE_COPY[failure];
    const loginHref = joinCode
      ? `/auth/login?redirect=${encodeURIComponent(`/dashboard/join?code=${joinCode}`)}`
      : "/auth/login";
    return (
      <main className="h-dvh overflow-y-auto bg-surface">
        <div className="flex min-h-full flex-col items-center justify-center px-6 safe-bottom safe-top">
          <div className="animate-fade-up w-full max-w-sm text-center">
            <h1 className="font-serif text-2xl text-neutral-900">
              {copy.title}
            </h1>
            <p className="mt-2 text-base text-neutral-500">{copy.body}</p>
            <div className="mt-8 flex flex-col gap-3">
              {failure === "network" ? (
                <>
                  <button
                    className={primaryButton}
                    onClick={handleRetry}
                    type="button"
                  >
                    Try again
                  </button>
                  <Link
                    className="inline-flex min-h-[44px] items-center justify-center text-base font-medium text-primary-ink transition-colors hover:text-primary-ink"
                    href={loginHref}
                  >
                    Send a new link
                  </Link>
                </>
              ) : (
                <Link className={primaryButton} href={loginHref}>
                  Send a new link
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col items-center justify-center bg-surface px-6 safe-bottom safe-top">
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
      <main className="flex h-dvh flex-col items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-breathe rounded-full bg-primary-200" />
      </main>
    }
  >
    <VerifyContent />
  </Suspense>
);

export default VerifyPage;
