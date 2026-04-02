"use client";

import { useTamboThreadInput } from "@tambo-ai/react";
import { useCallback } from "react";

import { triggerFeedback } from "@/lib/haptics";

interface QuickAction {
  label: string;
  prompt: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

const actionStyles: Record<string, { bg: string; icon: string }> = {
  diaper: {
    bg: "bg-diaper-50 border-diaper-200 hover:bg-diaper-100 text-diaper-600 active:bg-diaper-200",
    icon: "\u{1F6BC}",
  },
  feed: {
    bg: "bg-feed-50 border-feed-200 hover:bg-feed-100 text-feed-600 active:bg-feed-200",
    icon: "\u{1F37C}",
  },
  note: {
    bg: "bg-note-50 border-note-200 hover:bg-note-100 text-neutral-600 active:bg-note-200",
    icon: "\u{1F4DD}",
  },
  sleep: {
    bg: "bg-sleep-50 border-sleep-200 hover:bg-sleep-100 text-sleep-600 active:bg-sleep-200",
    icon: "\u{1F634}",
  },
};

const getStyle = (label: string) => {
  const lower = label.toLowerCase();
  for (const [key, value] of Object.entries(actionStyles)) {
    if (lower.includes(key)) return value;
  }
  return actionStyles.note;
};

const QuickActionButton = ({
  action,
  handleAction,
  isPrimary,
}: {
  action: QuickAction;
  handleAction: (prompt: string) => void;
  isPrimary: boolean;
}) => {
  const onClick = useCallback(() => {
    triggerFeedback("logged");
    handleAction(action.prompt);
  }, [handleAction, action.prompt]);

  const style = getStyle(action.label);

  return (
    <button
      className={`flex items-center gap-2 rounded-lg border px-4 text-left text-sm)] font-medium transition-[background-color,transform] duration-[var(--duration-fast active:scale-[0.97] ${style.bg} ${
        isPrimary ? "min-h-[56px] py-3" : "min-h-[44px] py-2"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className={isPrimary ? "text-lg" : "text-base"}>{style.icon}</span>
      <span className="flex-1">{action.label}</span>
    </button>
  );
};

export const QuickActions = ({ actions }: QuickActionsProps) => {
  const { setValue, submit } = useTamboThreadInput();

  const handleAction = useCallback(
    (prompt: string) => {
      setValue(prompt);
      submit();
    },
    [setValue, submit]
  );

  // First two actions are primary (larger), rest are secondary
  const primary = actions.slice(0, 2);
  const secondary = actions.slice(2);

  return (
    <div className="flex flex-col gap-2">
      {/* Primary actions — large, thumb-friendly at bottom of screen */}
      <div className="grid grid-cols-2 gap-2">
        {primary.map((action) => (
          <QuickActionButton
            action={action}
            handleAction={handleAction}
            isPrimary={true}
            key={action.label}
          />
        ))}
      </div>
      {/* Secondary actions — smaller row */}
      {secondary.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {secondary.map((action) => (
            <QuickActionButton
              action={action}
              handleAction={handleAction}
              isPrimary={false}
              key={action.label}
            />
          ))}
        </div>
      )}
    </div>
  );
};
