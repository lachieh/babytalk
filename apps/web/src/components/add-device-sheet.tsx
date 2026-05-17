"use client";

import { useCallback, useEffect, useState } from "react";

import { triggerFeedback } from "@/lib/haptics";
import { gqlRequest } from "@/lib/tambo/graphql";

const APPROVE_DEVICE_CODE = `
  mutation ApproveDeviceCode($code: String!) {
    approveDeviceCode(code: $code)
  }
`;

type Status = "idle" | "submitting" | "approved" | "error";

const formatCode = (raw: string): string => {
  const clean = raw
    .replaceAll(/[^A-Z2-9]/gi, "")
    .toUpperCase()
    .slice(0, 8);
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
};

export const AddDeviceSheet = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [deviceUrl, setDeviceUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    setCode("");
    setStatus("idle");
    setErrorMsg("");
    if (typeof window !== "undefined") {
      setDeviceUrl(`${window.location.origin}/auth/device`);
    }
  }, [open]);

  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCode(formatCode(e.target.value));
      setErrorMsg("");
      if (status === "error") setStatus("idle");
    },
    [status]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const cleaned = code.replaceAll(/[^A-Z2-9]/gi, "").toUpperCase();
      if (cleaned.length !== 8) {
        setErrorMsg("Enter the full 8-character code");
        setStatus("error");
        return;
      }
      setStatus("submitting");
      setErrorMsg("");
      try {
        const result = await gqlRequest<{ approveDeviceCode: boolean }>(
          APPROVE_DEVICE_CODE,
          { code: cleaned }
        );
        if (result.approveDeviceCode) {
          triggerFeedback("logged");
          setStatus("approved");
        } else {
          setStatus("error");
          setErrorMsg("That code isn't valid or has expired");
        }
      } catch (error) {
        setStatus("error");
        setErrorMsg(
          error instanceof Error ? error.message : "Couldn't approve the device"
        );
      }
    },
    [code]
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleBackdropKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  if (!open) return null;

  return (
    <div
      aria-label="Add a station device"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/30 transition-opacity"
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
      role="dialog"
    >
      <div className="animate-slide-up w-full max-w-lg rounded-t-2xl bg-surface-raised shadow-lg safe-bottom">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>

        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <h2 className="text-base font-semibold text-neutral-700">
            Add a device
          </h2>
          <button
            aria-label="Close"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            onClick={onClose}
            type="button"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {status === "approved" ? (
          <div className="px-5 pb-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-100">
              <svg
                className="h-7 w-7 text-success-600"
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
            <p className="mt-4 text-base font-medium text-neutral-800">
              Device signed in
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              The other device will switch to station mode in a moment.
            </p>
            <button
              className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-medium text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.97]"
              onClick={onClose}
              type="button"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-5 px-5 pb-6">
            <ol className="space-y-3 rounded-xl bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-600">
                  1
                </span>
                <span>
                  On your other device, open{" "}
                  <span className="font-medium text-neutral-800">
                    {deviceUrl || "/auth/device"}
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-600">
                  2
                </span>
                <span>
                  Or scan the QR code shown there with this phone — it&apos;ll
                  approve automatically.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-600">
                  3
                </span>
                <span>Type the 8-character code shown on the new device.</span>
              </li>
            </ol>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <label
                className="block text-xs font-medium uppercase tracking-wider text-neutral-400"
                htmlFor="device-code-input"
              >
                Device code
              </label>
              <input
                aria-describedby="device-code-help"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                className="min-h-[56px] w-full rounded-xl border border-neutral-200 bg-surface px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-neutral-800 uppercase placeholder:text-neutral-300 transition-colors focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                disabled={status === "submitting"}
                id="device-code-input"
                inputMode="text"
                onChange={handleCodeChange}
                placeholder="XXXX-XXXX"
                spellCheck={false}
                type="text"
                value={code}
              />
              <p
                className="text-center text-xs text-neutral-400"
                id="device-code-help"
              >
                Codes expire 15 minutes after the new device requests one.
              </p>

              <button
                className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary-500 px-5 py-3 text-sm font-medium text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.97] disabled:opacity-40"
                disabled={status === "submitting"}
                type="submit"
              >
                {status === "submitting" ? "Approving..." : "Approve device"}
              </button>
              {errorMsg && (
                <p className="text-center text-sm text-danger-500">
                  {errorMsg}
                </p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
