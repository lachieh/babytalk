"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { gqlRequest } from "@/lib/tambo/graphql";

interface UserInfo {
  email: string;
  id: string;
  name: string | null;
}

interface BabyInfo {
  birthDate: string;
  birthWeightG: number | null;
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
    myBabies { id name birthDate birthWeightG }
    householdMembers { id email name }
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

const PartnerInvite = ({
  inviteCode,
  copied,
  onShare,
}: {
  copied: boolean;
  inviteCode: string;
  onShare: () => void;
}) => (
  <div className="rounded-xl bg-primary-50 px-4 py-4 text-center">
    <p className="text-sm text-neutral-500">
      Share this code with your partner
    </p>
    <p className="mt-2 font-mono text-lg font-bold tracking-widest text-primary-500">
      {inviteCode}
    </p>
    <button
      className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-medium text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.97]"
      onClick={onShare}
      type="button"
    >
      {copied ? (
        <>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          Share invite code
        </>
      )}
    </button>
  </div>
);

const ProfileContent = ({
  me,
  household,
  babies,
  members,
  copied,
  onShare,
  onSignOut,
}: {
  babies: BabyInfo[];
  copied: boolean;
  household: HouseholdInfo | null;
  me: UserInfo | null;
  members: UserInfo[];
  onShare: () => void;
  onSignOut: () => void;
}) => {
  const partner = members.find((m) => m.id !== me?.id);

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
              <div key={baby.id} className="rounded-xl bg-neutral-50 px-4 py-3">
                <p className="text-sm font-medium text-neutral-800">
                  {baby.name}
                </p>
                <p className="mt-0.5 text-sm text-neutral-400">
                  {formatAge(baby.birthDate)}
                  {baby.birthWeightG !== null &&
                    ` · ${formatWeight(baby.birthWeightG)}`}
                </p>
              </div>
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
          <PartnerInvite
            inviteCode={household.inviteCode}
            copied={copied}
            onShare={onShare}
          />
        )}
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
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

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
      } catch {
        // Silently fail — profile is non-critical
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [open]);

  const handleCopyCode = useCallback(async () => {
    if (!household?.inviteCode) return;

    if (navigator.share) {
      try {
        await navigator.share({
          text: `Join our family on BabyTalk with code: ${household.inviteCode}`,
          title: "BabyTalk Invite",
        });
        return;
      } catch {
        // Share cancelled or failed — fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(household.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [household?.inviteCode]);

  const handleSignOut = useCallback(() => {
    localStorage.removeItem("babytalk_token");
    router.replace("/auth/login");
  }, [router]);

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
            copied={copied}
            onShare={handleCopyCode}
            onSignOut={handleSignOut}
          />
        )}
      </div>
    </div>
  );
};
