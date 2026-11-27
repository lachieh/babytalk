"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { gqlRequest, storeSession } from "@/lib/gql-request";
import { isPasskeySupported, signInWithPasskey } from "@/lib/passkey";
import { disableDeviceMode } from "@/lib/use-device-mode";
import { useRedirectIfLoggedIn } from "@/lib/use-redirect-if-logged-in";

const REQUEST_MAGIC_LINK = `
  mutation RequestMagicLink($email: String!) {
    requestMagicLink(email: $email)
  }
`;

const LINK_LIFETIME_MINUTES = 15;
const RESEND_COOLDOWN_SECONDS = 30;

const SEND_FAILED =
  "We couldn't send the link. Check your connection and try again.";
const PASSKEY_FAILED =
  "That passkey didn't work. Try again, or send yourself an email link.";

const Wordmark = () => (
  <Link
    aria-label="Bubsie home"
    className="mx-auto flex min-h-11 w-fit items-center gap-3 rounded-xl"
    href="/"
  >
    <Image
      alt=""
      className="h-9 w-9 rounded-[10px]"
      height={36}
      priority
      src="/icons/icon.svg"
      width={36}
    />
    <span className="font-serif text-2xl tracking-tight text-neutral-900">
      Bubsie
    </span>
  </Link>
);

const EmailAddress = ({ email }: { email: string }) => {
  const at = email.indexOf("@");
  if (at === -1) return email;
  return (
    <>
      {email.slice(0, at + 1)}
      <wbr />
      {email.slice(at + 1)}
    </>
  );
};

export default function LoginPage() {
  const checkingAuth = useRedirectIfLoggedIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resendNote, setResendNote] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [signingInWithPasskey, setSigningInWithPasskey] = useState(false);

  useEffect(() => {
    setPasskeySupported(isPasskeySupported());
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Try conditional-mediation (autofill) sign in. Browsers that support it
  // will let the user pick a passkey from their password manager UI.
  useEffect(() => {
    if (!passkeySupported) return;
    let cancelled = false;

    const tryAutofill = async () => {
      try {
        const PKC = window.PublicKeyCredential as
          | (typeof PublicKeyCredential & {
              isConditionalMediationAvailable?: () => Promise<boolean>;
            })
          | undefined;
        const available = await PKC?.isConditionalMediationAvailable?.();
        if (!available || cancelled) return;
        const result = await signInWithPasskey(null, { conditional: true });
        if (cancelled) return;
        storeSession(result.token, result.refreshToken);
        disableDeviceMode();
        const stored = localStorage.getItem("bubsie_auth_redirect");
        if (stored) localStorage.removeItem("bubsie_auth_redirect");
        router.replace(stored ?? "/dashboard");
      } catch {
        // Autofill cancelled or unsupported — fall through silently.
      }
    };
    tryAutofill();
    return () => {
      cancelled = true;
    };
  }, [passkeySupported, router]);

  const handlePasskeyClick = useCallback(async () => {
    setErrorMsg("");
    setSigningInWithPasskey(true);
    try {
      const result = await signInWithPasskey(email.trim() || null);
      storeSession(result.token, result.refreshToken);
      disableDeviceMode();
      const stored = localStorage.getItem("bubsie_auth_redirect");
      if (stored) localStorage.removeItem("bubsie_auth_redirect");
      router.replace(stored ?? "/dashboard");
    } catch (error) {
      if (error instanceof Error && error.name !== "NotAllowedError") {
        setErrorMsg(PASSKEY_FAILED);
      }
    } finally {
      setSigningInWithPasskey(false);
    }
  }, [email, router]);

  // Store any redirect param so the verify page can use it after auth
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    if (redirect) {
      localStorage.setItem("bubsie_auth_redirect", redirect);
    }
  }

  const sendLink = useCallback(async (): Promise<boolean> => {
    setSending(true);
    try {
      await gqlRequest<{ requestMagicLink: boolean }>(REQUEST_MAGIC_LINK, {
        email: email.trim(),
      });
      setCooldown(RESEND_COOLDOWN_SECONDS);
      return true;
    } catch {
      return false;
    } finally {
      setSending(false);
    }
  }, [email]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg("");
      setResendNote("");
      if (await sendLink()) {
        setSent(true);
      } else {
        setErrorMsg(SEND_FAILED);
      }
    },
    [sendLink]
  );

  const handleResend = useCallback(async () => {
    setErrorMsg("");
    setResendNote("");
    if (await sendLink()) {
      setResendNote("Sent. Use the newest email.");
    } else {
      setErrorMsg(SEND_FAILED);
    }
  }, [sendLink]);

  const handleChangeEmail = useCallback(() => {
    setSent(false);
    setErrorMsg("");
    setResendNote("");
  }, []);

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value);
    },
    []
  );

  if (checkingAuth) {
    return (
      <main className="flex h-dvh items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-breathe rounded-full bg-primary-200" />
      </main>
    );
  }

  if (sent) {
    let resendLabel = "Resend link";
    if (sending) resendLabel = "Sending...";
    else if (cooldown > 0) resendLabel = `Resend link in ${cooldown}s`;
    return (
      <main className="h-dvh overflow-y-auto bg-surface">
        <div className="flex min-h-full flex-col items-center justify-center px-6 safe-bottom safe-top">
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
            <h1 className="mt-6 font-serif text-2xl text-neutral-900">
              Check your email
            </h1>
            <p className="mt-2 text-base text-neutral-500">
              We sent a sign-in link to
            </p>
            <p className="mt-1 break-words text-base font-medium text-neutral-800">
              <EmailAddress email={email.trim()} />
            </p>
            <p className="mt-4 text-sm text-neutral-500">
              {`The link works once and lasts ${LINK_LIFETIME_MINUTES} minutes. If it isn't there in a minute, check your spam folder.`}
            </p>

            <div className="mt-10 flex flex-col gap-3">
              <button
                className="min-h-[48px] rounded-xl border border-neutral-200 bg-surface-raised px-6 py-3 text-base font-semibold text-neutral-700 transition-[background-color,transform] duration-[var(--duration-normal)] hover:bg-neutral-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 disabled:active:scale-100"
                disabled={sending || cooldown > 0}
                onClick={handleResend}
                type="button"
              >
                {resendLabel}
              </button>
              <button
                className="min-h-[44px] text-base font-medium text-primary-ink transition-colors hover:text-primary-ink"
                onClick={handleChangeEmail}
                type="button"
              >
                Use a different email
              </button>
            </div>
            <p aria-live="polite" className="mt-3 min-h-5 text-sm">
              {errorMsg ? (
                <span className="text-danger-500">{errorMsg}</span>
              ) : (
                <span className="text-neutral-600">{resendNote}</span>
              )}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-dvh overflow-y-auto bg-surface">
      <div className="flex min-h-full flex-col items-center justify-center px-6 safe-bottom safe-top">
        <div className="animate-fade-up w-full max-w-sm">
          <Wordmark />
          <h1 className="mt-10 text-center font-serif text-2xl text-neutral-900">
            Sign in or get started
          </h1>
          <p className="mt-1 text-center text-sm text-neutral-400">
            Enter your email and we&apos;ll send you a link. No password needed.
          </p>
          <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-3">
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
              // oxlint-disable-next-line jsx-a11y/autocomplete-valid
              autoComplete="username webauthn"
              className="min-h-[48px] rounded-xl border border-neutral-200 bg-surface-raised px-4 py-3 text-base text-neutral-800 placeholder:text-neutral-400 transition-colors duration-[var(--duration-fast)] focus-visible:border-primary-400"
            />
            <button
              type="submit"
              disabled={sending}
              className="min-h-[48px] rounded-xl bg-primary-500 px-6 py-3 text-base font-semibold text-white transition-[background-color,transform] duration-[var(--duration-normal)] ease-[var(--ease-out)] hover:bg-primary-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-600 disabled:active:scale-100"
            >
              {sending ? "Sending..." : "Send magic link"}
            </button>
            {passkeySupported && (
              <>
                <div className="my-1 flex items-center gap-3 text-xs text-neutral-500">
                  <span className="h-px flex-1 bg-neutral-200" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-neutral-200" />
                </div>
                <button
                  type="button"
                  onClick={handlePasskeyClick}
                  disabled={signingInWithPasskey}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-surface-raised px-6 py-3 text-base font-semibold text-neutral-700 transition-[background-color,transform] duration-[var(--duration-normal)] hover:bg-neutral-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 disabled:active:scale-100"
                >
                  <Icon className="h-5 w-5" name="passkey" />
                  {signingInWithPasskey
                    ? "Verifying..."
                    : "Sign in with a passkey"}
                </button>
              </>
            )}
            <p
              aria-live="polite"
              className="min-h-5 text-center text-sm text-danger-500"
            >
              {errorMsg}
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
