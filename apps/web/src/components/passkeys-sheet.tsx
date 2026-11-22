"use client";

import { useCallback, useEffect, useState } from "react";

import { gqlRequest } from "@/lib/gql-request";
import { enrollPasskey, isPasskeySupported } from "@/lib/passkey";
import type { PasskeyInfo } from "@/lib/passkey";

import { Sheet } from "./sheet";

const MY_PASSKEYS = `
  query MyPasskeys {
    myPasskeys {
      id
      nickname
      deviceType
      backedUp
      createdAt
      lastUsedAt
    }
  }
`;

const REVOKE_PASSKEY = `
  mutation PasskeyRevoke($id: String!) {
    passkeyRevoke(id: $id)
  }
`;

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const describeKey = (p: PasskeyInfo): string => {
  if (p.deviceType === "multiDevice") {
    return p.backedUp ? "Synced across devices" : "Multi-device";
  }
  return "This device only";
};

const PasskeyRow = ({
  passkey,
  pendingRevoke,
  onAskRevoke,
  onConfirmRevoke,
  onCancelRevoke,
}: {
  passkey: PasskeyInfo;
  pendingRevoke: boolean;
  onAskRevoke: (id: string) => void;
  onConfirmRevoke: (id: string) => void;
  onCancelRevoke: () => void;
}) => {
  const handleAsk = useCallback(
    () => onAskRevoke(passkey.id),
    [passkey.id, onAskRevoke]
  );
  const handleConfirm = useCallback(
    () => onConfirmRevoke(passkey.id),
    [passkey.id, onConfirmRevoke]
  );

  if (pendingRevoke) {
    return (
      <li className="rounded-xl bg-danger-50 px-4 py-3">
        <p className="text-sm text-neutral-700">
          Remove “{passkey.nickname ?? "this passkey"}”? You&apos;ll need a
          magic link to add a new one.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            className="min-h-[44px] flex-1 rounded-lg bg-danger-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-danger-600"
            onClick={handleConfirm}
            type="button"
          >
            Remove
          </button>
          <button
            className="min-h-[44px] flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
            onClick={onCancelRevoke}
            type="button"
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-xl bg-neutral-50 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-800">
          {passkey.nickname ?? "Unnamed passkey"}
        </p>
        <p className="mt-0.5 text-xs text-neutral-400">
          {describeKey(passkey)} · Added {formatDate(passkey.createdAt)}
          {passkey.lastUsedAt
            ? ` · Last used ${formatDate(passkey.lastUsedAt)}`
            : ""}
        </p>
      </div>
      <button
        aria-label={`Remove ${passkey.nickname ?? "passkey"}`}
        className="min-h-[44px] rounded-lg px-3 py-1.5 text-sm font-medium text-danger-500 transition-colors hover:bg-danger-50"
        onClick={handleAsk}
        type="button"
      >
        Remove
      </button>
    </li>
  );
};

const PasskeyList = ({
  loading,
  passkeys,
  pendingRevokeId,
  onAskRevoke,
  onConfirmRevoke,
  onCancelRevoke,
}: {
  loading: boolean;
  passkeys: PasskeyInfo[];
  pendingRevokeId: string | null;
  onAskRevoke: (id: string) => void;
  onConfirmRevoke: (id: string) => void;
  onCancelRevoke: () => void;
}) => {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="h-6 w-6 animate-breathe rounded-full bg-primary-200" />
      </div>
    );
  }
  if (passkeys.length === 0) {
    return (
      <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
        No passkeys yet. Add one above for faster sign in.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {passkeys.map((p) => (
        <PasskeyRow
          key={p.id}
          onAskRevoke={onAskRevoke}
          onCancelRevoke={onCancelRevoke}
          onConfirmRevoke={onConfirmRevoke}
          passkey={p}
          pendingRevoke={pendingRevokeId === p.id}
        />
      ))}
    </ul>
  );
};

export const PasskeysSheet = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [nickname, setNickname] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [supported, setSupported] = useState(false);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);

  useEffect(() => {
    setSupported(isPasskeySupported());
  }, []);

  const fetchPasskeys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gqlRequest<{ myPasskeys: PasskeyInfo[] }>(MY_PASSKEYS);
      setPasskeys(data.myPasskeys);
    } catch {
      // ignore — empty list is fine
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setNickname("");
    setErrorMsg("");
    setPendingRevokeId(null);
    fetchPasskeys();
  }, [open, fetchPasskeys]);

  const handleNicknameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setNickname(e.target.value),
    []
  );

  const handleEnroll = useCallback(async () => {
    setErrorMsg("");
    setEnrolling(true);
    try {
      await enrollPasskey(nickname.trim() || null);
      setNickname("");
      await fetchPasskeys();
    } catch (error) {
      if (error instanceof Error && error.name !== "NotAllowedError") {
        setErrorMsg(error.message);
      }
    } finally {
      setEnrolling(false);
    }
  }, [nickname, fetchPasskeys]);

  const handleAskRevoke = useCallback((id: string) => {
    setPendingRevokeId(id);
  }, []);

  const handleCancelRevoke = useCallback(() => {
    setPendingRevokeId(null);
  }, []);

  const handleConfirmRevoke = useCallback(
    async (id: string) => {
      setPendingRevokeId(null);
      try {
        await gqlRequest(REVOKE_PASSKEY, { id });
        await fetchPasskeys();
      } catch (error) {
        setErrorMsg(error instanceof Error ? error.message : "Couldn't remove");
      }
    },
    [fetchPasskeys]
  );

  return (
    <Sheet onClose={onClose} open={open} title="Passkeys">
      <div className="space-y-5 px-5 pb-4">
        {!supported && (
          <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
            Passkeys aren&apos;t supported on this device. Try a recent version
            of Safari, Chrome, or Firefox.
          </p>
        )}

        {supported && (
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
              Add a passkey
            </h3>
            <div className="rounded-xl bg-neutral-50 px-4 py-4">
              <label
                className="block text-xs font-medium text-neutral-500"
                htmlFor="passkey-nickname"
              >
                Name (optional)
              </label>
              <input
                className="mt-1 min-h-[44px] w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2 text-base text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:border-primary-300"
                disabled={enrolling}
                id="passkey-nickname"
                maxLength={40}
                onChange={handleNicknameChange}
                placeholder="e.g. iPhone, 1Password"
                type="text"
                value={nickname}
              />
              <button
                className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.97] disabled:opacity-40"
                disabled={enrolling}
                onClick={handleEnroll}
                type="button"
              >
                {enrolling ? "Setting up..." : "Add passkey"}
              </button>
              <p className="mt-2 text-xs text-neutral-400">
                Use Face ID, Touch ID, Windows Hello, or a password manager like
                1Password.
              </p>
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
            Your passkeys
          </h3>
          <PasskeyList
            loading={loading}
            onAskRevoke={handleAskRevoke}
            onCancelRevoke={handleCancelRevoke}
            onConfirmRevoke={handleConfirmRevoke}
            passkeys={passkeys}
            pendingRevokeId={pendingRevokeId}
          />
        </section>

        {errorMsg && (
          <p className="text-center text-sm text-danger-500" role="alert">
            {errorMsg}
          </p>
        )}
      </div>
    </Sheet>
  );
};
