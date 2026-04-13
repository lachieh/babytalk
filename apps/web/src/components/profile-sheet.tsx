"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { gqlRequest } from "@/lib/tambo/graphql";
import { useMeasurementUnit } from "@/lib/use-measurement-unit";
import { useVolumeUnit } from "@/lib/use-volume-unit";

import { EditBabySheet } from "./edit-baby-sheet";

interface UserInfo {
  email: string;
  id: string;
  name: string | null;
}

interface BabyInfo {
  birthDate: string;
  birthWeightG: number | null;
  gender: string | null;
  id: string;
  name: string;
}

interface HouseholdInfo {
  id: string;
  inviteCode: string;
}

const PROFILE_QUERY = `
  query ProfileData {
    me { id email name }
    myHousehold { id inviteCode }
    myBabies { id name birthDate birthWeightG gender }
    householdMembers { id email name }
  }
`;

const GET_LATEST_MEASUREMENT = `
  query LatestMeasurement($babyId: String!) {
    measurements(babyId: $babyId, limit: 1) {
      weightG measuredAt
    }
  }
`;

const pluralize = (count: number, singular: string): string =>
  count === 1 ? `${count} ${singular}` : `${count} ${singular}s`;

const formatAge = (birthDate: string): string => {
  const birth = new Date(birthDate);
  const now = new Date();
  const days = Math.floor(
    (now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (days < 7) return `${pluralize(days, "day")} old`;
  if (days < 30) return `${pluralize(Math.floor(days / 7), "week")} old`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${pluralize(months, "month")} old`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${pluralize(years, "year")} old`;
  return `${years}y ${rem}m old`;
};

const formatWeight = (grams: number): string => {
  const lbs = Math.floor(grams / 453.592);
  const oz = Math.round((grams % 453.592) / 28.3495);
  return `${lbs} lb ${oz} oz`;
};

const UserAvatar = ({
  name,
  email,
  variant = "primary",
}: {
  email: string;
  name: string | null;
  variant?: "primary" | "success";
}) => {
  const colors =
    variant === "success"
      ? "bg-success-100 text-success-600"
      : "bg-primary-100 text-primary-600";
  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${colors}`}
    >
      {(name?.[0] ?? email[0] ?? "?").toUpperCase()}
    </div>
  );
};

const INVITE_PARTNER = `
  mutation InvitePartner($email: String!) {
    invitePartner(email: $email)
  }
`;

const PartnerInvite = ({
  copied,
  onShare,
}: {
  copied: boolean;
  onShare: () => void;
}) => {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value),
    []
  );

  const handleSendInvite = useCallback(async () => {
    if (!email.trim()) return;
    setSending(true);
    setErrorMsg("");
    try {
      await gqlRequest(INVITE_PARTNER, { email: email.trim() });
      setSent(true);
    } catch {
      setErrorMsg("Failed to send invite");
    } finally {
      setSending(false);
    }
  }, [email]);

  if (sent) {
    return (
      <div className="rounded-xl bg-success-50 px-4 py-4 text-center">
        <p className="text-sm font-medium text-success-600">
          Invite sent to {email}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          They&apos;ll get a link to join your family
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Email invite — primary */}
      <div className="rounded-xl bg-neutral-50 px-4 py-4">
        <p className="text-sm font-medium text-neutral-700">Invite by email</p>
        <div className="mt-2 flex gap-2">
          <input
            className="min-h-[44px] flex-1 rounded-lg border border-neutral-200 bg-surface px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
            onChange={handleEmailChange}
            placeholder="partner@email.com"
            type="email"
            value={email}
          />
          <button
            className="min-h-[44px] rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.97] disabled:opacity-40"
            disabled={sending || !email.trim()}
            onClick={handleSendInvite}
            type="button"
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
        {errorMsg && <p className="mt-2 text-xs text-danger-500">{errorMsg}</p>}
      </div>

      {/* Share link fallback — secondary */}
      <div className="rounded-xl bg-neutral-50 px-4 py-3 text-center">
        <p className="text-xs text-neutral-400">Or share this link</p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <button
            className="min-h-[36px] rounded-md px-3 py-1 text-xs font-medium text-primary-500 transition-colors hover:bg-primary-50"
            onClick={onShare}
            type="button"
          >
            {copied ? "Link copied!" : "Copy invite link"}
          </button>
        </div>
      </div>
    </div>
  );
};

const GENDER_LABELS: Record<string, string> = {
  female: "Girl",
  male: "Boy",
  other: "Other",
};

function formatGender(gender: string | null): string | null {
  if (!gender) return null;
  return GENDER_LABELS[gender] ?? null;
}

function getWeightLabel(
  latest: { weightG: number; measuredAt: string } | null | undefined,
  birthWeightG: number | null
): string | null {
  if (latest) return formatWeight(latest.weightG);
  if (birthWeightG !== null) return `${formatWeight(birthWeightG)} at birth`;
  return null;
}

const BabyCard = ({
  baby,
  weightLabel,
  onEdit,
}: {
  baby: BabyInfo;
  weightLabel: string | null;
  onEdit: (baby: BabyInfo) => void;
}) => {
  const handleClick = useCallback(() => onEdit(baby), [onEdit, baby]);
  const genderLabel = formatGender(baby.gender);

  return (
    <button
      className="flex w-full items-center rounded-xl bg-neutral-50 px-4 py-3 text-left transition-colors hover:bg-neutral-100 active:bg-neutral-100"
      onClick={handleClick}
      type="button"
    >
      <div className="flex-1">
        <p className="text-sm font-medium text-neutral-800">
          {baby.name}
          {genderLabel !== null && (
            <span className="ml-1.5 text-xs font-normal text-neutral-400">
              {genderLabel}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-sm text-neutral-400">
          {formatAge(baby.birthDate)}
          {weightLabel !== null && ` · ${weightLabel}`}
        </p>
      </div>
      <svg
        className="h-4 w-4 text-neutral-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
};

const ProfileContent = ({
  me,
  household,
  babies,
  members,
  latestWeights,
  copied,
  onShare,
  onEditBaby,
  onSignOut,
}: {
  babies: BabyInfo[];
  copied: boolean;
  household: HouseholdInfo | null;
  latestWeights: Record<string, { weightG: number; measuredAt: string } | null>;
  me: UserInfo | null;
  members: UserInfo[];
  onEditBaby: (baby: BabyInfo) => void;
  onShare: () => void;
  onSignOut: () => void;
}) => {
  const partner = members.find((m) => m.id !== me?.id);
  const { unit, toggle: toggleUnit } = useVolumeUnit();
  const { unit: measurementUnit, toggle: toggleMeasurementUnit } =
    useMeasurementUnit();

  return (
    <div className="space-y-5 px-5 pb-6">
      {/* Your Account */}
      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
          Your account
        </h3>
        <div className="flex items-center gap-3 rounded-xl bg-neutral-50 px-4 py-3">
          <UserAvatar name={me?.name ?? null} email={me?.email ?? "?"} />
          <div className="min-w-0 flex-1">
            {me?.name && (
              <p className="truncate text-sm font-medium text-neutral-800">
                {me.name}
              </p>
            )}
            <p className="truncate text-sm text-neutral-500">{me?.email}</p>
          </div>
        </div>
      </section>

      {/* Baby */}
      {babies.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
            {babies.length === 1 ? "Baby" : "Babies"}
          </h3>
          <div className="space-y-2">
            {babies.map((baby) => (
              <BabyCard
                baby={baby}
                key={baby.id}
                onEdit={onEditBaby}
                weightLabel={getWeightLabel(
                  latestWeights[baby.id],
                  baby.birthWeightG
                )}
              />
            ))}
          </div>
        </section>
      )}

      {/* Partner */}
      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
          Partner
        </h3>
        {partner && (
          <div className="flex items-center gap-3 rounded-xl bg-neutral-50 px-4 py-3">
            <UserAvatar
              name={partner.name}
              email={partner.email}
              variant="success"
            />
            <div className="min-w-0 flex-1">
              {partner.name && (
                <p className="truncate text-sm font-medium text-neutral-800">
                  {partner.name}
                </p>
              )}
              <p className="truncate text-sm text-neutral-500">
                {partner.email}
              </p>
            </div>
          </div>
        )}
        {!partner && household?.inviteCode && (
          <PartnerInvite copied={copied} onShare={onShare} />
        )}
      </section>

      {/* Preferences */}
      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
          Preferences
        </h3>
        <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
          <span className="text-sm text-neutral-700">Volume unit</span>
          <button
            className="flex rounded-lg border border-neutral-200 text-xs"
            onClick={toggleUnit}
            type="button"
          >
            <span
              className={`min-h-[32px] rounded-l-lg px-3 py-1.5 font-medium transition-colors ${unit === "oz" ? "bg-primary-500 text-white" : "text-neutral-400"}`}
            >
              oz
            </span>
            <span
              className={`min-h-[32px] rounded-r-lg px-3 py-1.5 font-medium transition-colors ${unit === "ml" ? "bg-primary-500 text-white" : "text-neutral-400"}`}
            >
              ml
            </span>
          </button>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
          <span className="text-sm text-neutral-700">
            Height &amp; weight unit
          </span>
          <button
            className="flex rounded-lg border border-neutral-200 text-xs"
            onClick={toggleMeasurementUnit}
            type="button"
          >
            <span
              className={`min-h-[32px] rounded-l-lg px-3 py-1.5 font-medium transition-colors ${measurementUnit === "imperial" ? "bg-primary-500 text-white" : "text-neutral-400"}`}
            >
              lb / in
            </span>
            <span
              className={`min-h-[32px] rounded-r-lg px-3 py-1.5 font-medium transition-colors ${measurementUnit === "metric" ? "bg-primary-500 text-white" : "text-neutral-400"}`}
            >
              kg / cm
            </span>
          </button>
        </div>
      </section>

      {/* Sign Out */}
      <button
        className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-700"
        onClick={onSignOut}
        type="button"
      >
        Sign out
      </button>
    </div>
  );
};

export const ProfileSheet = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const router = useRouter();
  const [me, setMe] = useState<UserInfo | null>(null);
  const [household, setHousehold] = useState<HouseholdInfo | null>(null);
  const [babies, setBabies] = useState<BabyInfo[]>([]);
  const [members, setMembers] = useState<UserInfo[]>([]);
  const [latestWeights, setLatestWeights] = useState<
    Record<string, { weightG: number; measuredAt: string } | null>
  >({});
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingBaby, setEditingBaby] = useState<BabyInfo | null>(null);
  const [editBabyOpen, setEditBabyOpen] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    const fetchProfile = async () => {
      try {
        const data = await gqlRequest<{
          householdMembers: UserInfo[];
          me: UserInfo;
          myBabies: BabyInfo[];
          myHousehold: HouseholdInfo;
        }>(PROFILE_QUERY);

        setMe(data.me);
        setHousehold(data.myHousehold);
        setBabies(data.myBabies);
        setMembers(data.householdMembers);

        // Fetch latest measurement for each baby
        const weightMap: Record<
          string,
          { weightG: number; measuredAt: string } | null
        > = {};
        for (const baby of data.myBabies) {
          try {
            const mData = await gqlRequest<{
              measurements: { weightG: number | null; measuredAt: string }[];
            }>(GET_LATEST_MEASUREMENT, { babyId: baby.id });
            const [latest] = mData.measurements;
            weightMap[baby.id] =
              latest?.weightG !== null && latest?.weightG !== undefined
                ? { weightG: latest.weightG, measuredAt: latest.measuredAt }
                : null;
          } catch {
            weightMap[baby.id] = null;
          }
        }
        setLatestWeights(weightMap);
      } catch {
        // Silently fail — profile is non-critical
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [open, fetchKey]);

  const handleShareLink = useCallback(async () => {
    if (!household?.inviteCode) return;

    const inviteUrl = `${window.location.origin}/dashboard/join?code=${household.inviteCode}`;

    if (navigator.share) {
      try {
        await navigator.share({
          text: "Join our family on BabyTalk",
          title: "BabyTalk Invite",
          url: inviteUrl,
        });
        return;
      } catch {
        // Share cancelled or failed — fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [household?.inviteCode]);

  const handleSignOut = useCallback(() => {
    localStorage.removeItem("babytalk_token");
    router.replace("/auth/login");
  }, [router]);

  const handleEditBaby = useCallback((baby: BabyInfo) => {
    setEditingBaby(baby);
    setEditBabyOpen(true);
  }, []);

  const handleEditBabyClose = useCallback(() => {
    setEditBabyOpen(false);
    setEditingBaby(null);
  }, []);

  const handleEditBabySaved = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

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
      className="fixed inset-0 z-40 flex items-end justify-center bg-neutral-900/30 transition-opacity"
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Profile"
    >
      <div className="animate-slide-up w-full max-w-lg rounded-t-2xl bg-surface-raised shadow-lg safe-bottom">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <h2 className="text-base font-semibold text-neutral-700">Profile</h2>
          <button
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            onClick={onClose}
            type="button"
            aria-label="Close profile"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center px-5 py-12">
            <div className="h-8 w-8 animate-breathe rounded-full bg-primary-200" />
          </div>
        ) : (
          <ProfileContent
            me={me}
            household={household}
            babies={babies}
            members={members}
            latestWeights={latestWeights}
            copied={copied}
            onEditBaby={handleEditBaby}
            onShare={handleShareLink}
            onSignOut={handleSignOut}
          />
        )}

        <EditBabySheet
          baby={editingBaby}
          onClose={handleEditBabyClose}
          onSaved={handleEditBabySaved}
          open={editBabyOpen}
        />
      </div>
    </div>
  );
};
