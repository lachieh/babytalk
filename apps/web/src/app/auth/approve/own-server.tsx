"use client";

import { useCallback, useEffect, useId, useState } from "react";

import { gqlRequest } from "@/lib/gql-request";

import { ownServerTarget } from "./own-server-target";

const REDIRECT_DEVICE_CODE = `
  mutation RedirectDeviceCode($code: String!, $webUrl: String!) {
    redirectDeviceCode(code: $code, webUrl: $webUrl)
  }
`;

const DEVICE_CODE_REDIRECT = `
  query DeviceCodeRedirect($code: String!) {
    deviceCodeRedirect(code: $code) { webUrl confirmed }
  }
`;

const POLL_MS = 2000;
const WAIT_MS = 2 * 60 * 1000;
/** A device that can't reach the address gives up within about a minute
 * (three tries with a 15 s timeout). */
const DEVICE_CHECK_WAIT_MS = 75 * 1000;

/** `deviceChecks`: the browser couldn't check the address (http from an https
 * page), so only the device can tell whether it's Bubsie and reachable. */
type State =
  | { kind: "form"; error: string }
  | { kind: "checking" }
  | { kind: "waiting"; host: string; deviceChecks: boolean }
  | { kind: "timed-out"; host: string; deviceChecks: boolean }
  | { kind: "expired" };

const NOT_BUBSIE = "We couldn't find Bubsie at that address.";

/** Whether `origin` serves a Bubsie web app: its public config names an API. */
const isBubsie = async (origin: string): Promise<boolean> => {
  try {
    const res = await fetch(`${origin}/.well-known/config`);
    if (!res.ok) return false;
    const config: unknown = await res.json();
    return (
      typeof config === "object" &&
      config !== null &&
      "apiUrl" in config &&
      typeof config.apiUrl === "string"
    );
  } catch {
    return false;
  }
};

const timedOutCopy = (
  state: Extract<State, { kind: "timed-out" | "expired" }>
): { title: string; body: string } => {
  if (state.kind === "expired") {
    return {
      body: "It may have expired or already been used. On the device, get a new code and scan it again.",
      title: "This code can't move now",
    };
  }
  if (state.deviceChecks) {
    return {
      body: `Check the address, and that ${state.host} is on a network the device can reach. If the device shows a new code, scan that one.`,
      title: "The device couldn't reach that server",
    };
  }
  return {
    body: `Check the device is on and connected, then try again. It's heading to ${state.host}.`,
    title: "Your device hasn't arrived yet",
  };
};

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    aria-hidden="true"
    className={`h-5 w-5 text-neutral-500 transition-transform duration-[var(--duration-normal)] motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Sends a pairing device to a self-hosted Bubsie instead of this one. The
 * device moves its code there; once it confirms, the phone follows. No
 * account here is needed, and no tokens pass through this instance. */
export const OwnServer = ({ code }: { code: string }) => {
  const panelId = useId();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("https://");
  const [state, setState] = useState<State>({ error: "", kind: "form" });

  const toggle = useCallback(() => setOpen((value) => !value), []);
  const handleAddressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value),
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const target = ownServerTarget(address, window.location.origin);
      if (target.kind === "invalid") {
        setState({
          error: "Enter the full address, like https://bubsie.example.com.",
          kind: "form",
        });
        return;
      }
      if (target.kind === "this-server") {
        setState({
          error: "That's this server. Use the steps above instead.",
          kind: "form",
        });
        return;
      }
      const { origin } = target;
      setState({ kind: "checking" });
      if (target.kind === "check" && !(await isBubsie(origin))) {
        setState({ error: NOT_BUBSIE, kind: "form" });
        return;
      }
      try {
        const data = await gqlRequest<{ redirectDeviceCode: boolean }>(
          REDIRECT_DEVICE_CODE,
          { code, webUrl: origin }
        );
        if (!data.redirectDeviceCode) {
          setState({ kind: "expired" });
          return;
        }
      } catch {
        setState({
          error:
            "We couldn't reach Bubsie. Check your connection and try again.",
          kind: "form",
        });
        return;
      }
      setState({
        deviceChecks: target.kind === "device-checks",
        host: new URL(origin).host,
        kind: "waiting",
      });
    },
    [address, code]
  );

  const waitingHost = state.kind === "waiting" ? state.host : null;
  const deviceChecks = state.kind === "waiting" && state.deviceChecks;

  useEffect(() => {
    if (!waitingHost) return;
    let stopped = false;
    const deadline =
      Date.now() + (deviceChecks ? DEVICE_CHECK_WAIT_MS : WAIT_MS);
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      try {
        const data = await gqlRequest<{
          deviceCodeRedirect: { confirmed: boolean; webUrl: string } | null;
        }>(DEVICE_CODE_REDIRECT, { code });
        if (stopped) return;
        const redirect = data.deviceCodeRedirect;
        if (!redirect) {
          setState({ kind: "expired" });
          return;
        }
        if (redirect.confirmed) {
          window.location.assign(
            `${redirect.webUrl}/auth/approve?code=${encodeURIComponent(code)}`
          );
          return;
        }
      } catch {
        // A missed check is retried on the next tick.
      }
      if (stopped) return;
      if (Date.now() >= deadline) {
        setState({ deviceChecks, host: waitingHost, kind: "timed-out" });
        return;
      }
      timer = setTimeout(check, POLL_MS);
    };
    timer = setTimeout(check, POLL_MS);

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [code, deviceChecks, waitingHost]);

  const keepWaiting = useCallback(() => {
    if (state.kind === "timed-out") {
      setState({ ...state, kind: "waiting" });
    }
  }, [state]);

  if (state.kind === "waiting") {
    return (
      <section
        aria-live="polite"
        className="fixed inset-0 flex flex-col items-center justify-center bg-surface px-6 text-center safe-bottom safe-top"
      >
        <div className="h-8 w-8 animate-breathe rounded-full bg-primary-200" />
        <p className="mt-6 text-base text-neutral-700">
          Sending your device to {state.host}…
        </p>
        <p className="mt-2 max-w-sm text-sm text-neutral-500">
          Keep this page open. It moves on by itself once the device is there.
        </p>
      </section>
    );
  }

  if (state.kind === "timed-out" || state.kind === "expired") {
    return (
      <section
        aria-live="polite"
        className="fixed inset-0 flex flex-col items-center justify-center bg-surface px-6 text-center safe-bottom safe-top"
      >
        <div className="w-full max-w-sm animate-fade-up">
          <h1 className="font-serif text-2xl text-neutral-900">
            {timedOutCopy(state).title}
          </h1>
          <p className="mt-2 text-base text-neutral-500">
            {timedOutCopy(state).body}
          </p>
          {state.kind === "timed-out" && (
            <button
              className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary-500 px-6 py-3 text-base font-semibold text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.98]"
              onClick={keepWaiting}
              type="button"
            >
              Try again
            </button>
          )}
        </div>
      </section>
    );
  }

  const checking = state.kind === "checking";
  const error = state.kind === "form" ? state.error : "";

  return (
    <div className="mt-10 border-t border-neutral-200 pt-2 text-left">
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="flex min-h-[48px] w-full items-center justify-between rounded-xl text-left text-base text-neutral-500"
        onClick={toggle}
        type="button"
      >
        <span>Using your own server?</span>
        <ChevronIcon open={open} />
      </button>
      <form
        className="flex flex-col gap-3 pt-2"
        hidden={!open}
        id={panelId}
        noValidate
        onSubmit={handleSubmit}
      >
        <label className="text-sm text-neutral-500" htmlFor={inputId}>
          Your Bubsie address
        </label>
        <input
          aria-describedby={error ? `${inputId}-error` : undefined}
          aria-invalid={error ? true : undefined}
          autoCapitalize="none"
          autoComplete="url"
          autoCorrect="off"
          className="min-h-[48px] rounded-xl border border-neutral-200 bg-surface-raised px-4 py-3 text-base text-neutral-800 placeholder:text-neutral-400 transition-colors duration-[var(--duration-fast)] focus-visible:border-primary-400"
          id={inputId}
          inputMode="url"
          onChange={handleAddressChange}
          spellCheck={false}
          type="url"
          value={address}
        />
        {error && (
          <p
            className="text-sm text-danger-500"
            id={`${inputId}-error`}
            role="alert"
          >
            {error}
          </p>
        )}
        <button
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-neutral-200 px-6 py-3 text-base font-medium text-neutral-800 transition-[background-color,transform] hover:bg-neutral-100 active:scale-[0.98] disabled:opacity-60"
          disabled={checking}
          type="submit"
        >
          {checking ? "Checking…" : "Send device there"}
        </button>
      </form>
    </div>
  );
};
