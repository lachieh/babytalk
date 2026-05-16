"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";

import { loadRuntimeConfig } from "@/lib/runtime-config";
import { gqlRequest } from "@/lib/tambo/graphql";

const REQUEST_DEVICE_CODE = `
  mutation RequestDeviceCode {
    requestDeviceCode { code expiresAt }
  }
`;

const POLL_DEVICE_CODE = `
  mutation PollDeviceCode($code: String!) {
    pollDeviceCode(code: $code) {
      status
      token
    }
  }
`;

const POLL_INTERVAL_MS = 2500;

const formatCodeDisplay = (code: string): string =>
  code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;

const formatRemaining = (ms: number): string => {
  if (ms <= 0) return "expired";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

type Phase = "loading" | "waiting" | "approved" | "expired" | "error";

const DevicePage = () => {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [code, setCode] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const requestCode = useCallback(async () => {
    setPhase("loading");
    setErrorMsg("");
    try {
      await loadRuntimeConfig();
      const data = await gqlRequest<{
        requestDeviceCode: { code: string; expiresAt: string };
      }>(REQUEST_DEVICE_CODE);
      const { code: newCode, expiresAt: newExpiresAt } = data.requestDeviceCode;
      setCode(newCode);
      setExpiresAt(new Date(newExpiresAt).getTime());

      const approveUrl = `${window.location.origin}/auth/approve?code=${newCode}`;
      const svg = await QRCode.toString(approveUrl, {
        color: { dark: "#1f2937", light: "#ffffff00" },
        errorCorrectionLevel: "M",
        margin: 1,
        type: "svg",
        width: 240,
      });
      setQrDataUrl(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);

      setPhase("waiting");
    } catch (error) {
      setPhase("error");
      setErrorMsg(
        error instanceof Error ? error.message : "Couldn't request a code"
      );
    }
  }, []);

  useEffect(() => {
    requestCode();
    return stopPolling;
  }, [requestCode, stopPolling]);

  useEffect(() => {
    if (phase !== "waiting" || !code) return;

    const tick = async () => {
      try {
        const data = await gqlRequest<{
          pollDeviceCode: { status: string; token: string | null };
        }>(POLL_DEVICE_CODE, { code });
        const { status, token } = data.pollDeviceCode;

        if (status === "approved" && token) {
          stopPolling();
          localStorage.setItem("babytalk_token", token);
          setPhase("approved");
          setTimeout(() => router.replace("/station"), 600);
          return;
        }
        if (status === "expired") {
          stopPolling();
          setPhase("expired");
          return;
        }
      } catch {
        // transient failure — keep polling
      }
      pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    };

    pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    return stopPolling;
  }, [phase, code, router, stopPolling]);

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const ms = expiresAt - Date.now();
      setRemaining(formatRemaining(ms));
      if (ms <= 0) setPhase("expired");
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (phase === "loading") {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-surface px-6 safe-bottom safe-top">
        <div className="h-8 w-8 animate-breathe rounded-full bg-primary-200" />
        <p className="mt-6 text-sm text-neutral-500">Requesting a code...</p>
      </main>
    );
  }

  if (phase === "approved") {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-surface px-6 safe-bottom safe-top">
        <div className="animate-fade-up flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-100">
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
            You&apos;re in
          </h1>
          <p className="mt-2 text-base text-neutral-500">
            Opening station mode...
          </p>
        </div>
      </main>
    );
  }

  if (phase === "expired" || phase === "error") {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-surface px-6 safe-bottom safe-top">
        <div className="animate-fade-up max-w-sm text-center">
          <h1 className="text-xl font-bold text-neutral-900">
            {phase === "expired" ? "Code expired" : "Something went wrong"}
          </h1>
          <p className="mt-2 text-base text-neutral-500">
            {errorMsg || "Request a fresh code to try again."}
          </p>
          <button
            className="mt-8 inline-flex min-h-[48px] items-center rounded-md bg-primary-500 px-6 py-3 text-base font-semibold text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.98]"
            onClick={requestCode}
            type="button"
          >
            New code
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-surface px-6 safe-bottom safe-top">
      <div className="animate-fade-up w-full max-w-sm text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
          Pair this device
        </p>
        <h1 className="mt-2 font-serif text-2xl text-neutral-800">
          Approve on your phone
        </h1>

        <div className="mt-8 flex items-center justify-center">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="QR code for approving this device"
              className="h-60 w-60 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-100"
              src={qrDataUrl}
            />
          ) : (
            <div className="h-60 w-60 animate-breathe rounded-2xl bg-neutral-100" />
          )}
        </div>

        <p className="mt-6 text-xs font-medium uppercase tracking-wider text-neutral-400">
          Or enter this code
        </p>
        <p className="mt-2 select-all font-mono text-3xl tracking-[0.3em] text-neutral-800">
          {formatCodeDisplay(code)}
        </p>

        <p className="mt-3 text-xs text-neutral-400">Expires in {remaining}</p>

        <p className="mt-8 text-sm text-neutral-500">
          On your signed-in phone, open{" "}
          <span className="font-medium text-neutral-700">
            Profile → Add a station device
          </span>{" "}
          and enter the code, or scan the QR with your camera.
        </p>

        <Link
          className="mt-8 inline-flex min-h-[44px] items-center text-sm font-medium text-primary-500 transition-colors hover:text-primary-600"
          href="/auth/login"
        >
          Use email magic link instead
        </Link>
      </div>
    </main>
  );
};

export default DevicePage;
