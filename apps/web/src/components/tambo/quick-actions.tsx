"use client";

import { useTamboThreadInput } from "@tambo-ai/react";
import { useCallback } from "react";

interface QuickAction {
  label: string;
  prompt: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

const actionStyles: Record<string, { bg: string; icon: string }> = {
  diaper: {
    bg: "bg-diaper-50 border-diaper-200 hover:bg-diaper-100 text-diaper-600",
    icon: "\u{1F6BC}",
  },
  feed: {
    bg: "bg-feed-50 border-feed-200 hover:bg-feed-100 text-feed-600",
    icon: "\u{1F37C}",
  },
  note: {
    bg: "bg-note-50 border-note-200 hover:bg-note-100 text-neutral-600",
    icon: "\u{1F4DD}",
  },
  sleep: {
    bg: "bg-sleep-50 border-sleep-200 hover:bg-sleep-100 text-sleep-600",
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
}: {
  action: QuickAction;
  handleAction: (prompt: string) => void;
}) => {
  const onClick = useCallback(
    () => handleAction(action.prompt),
    [handleAction, action.prompt]
  );

  const style = getStyle(action.label);

  return (
    <button
      className={`flex min-h-[44px] items-center gap-spacing-sm rounded-radius-md border px-spacing-lg py-spacing-md text-left text-[var(--font-size-sm)] font-medium transition-[background-color,transform] duration-[var(--duration-fast)] active:scale-[0.97] ${style.bg}`}
      onClick={onClick}
      type="button"
    >
      <span className="text-base">{style.icon}</span>
      {action.label}
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

  return (
    <div className="grid grid-cols-2 gap-spacing-sm">
      {actions.map((action) => (
        <QuickActionButton
          action={action}
          handleAction={handleAction}
          key={action.label}
        />
      ))}
    </div>
  );
};
