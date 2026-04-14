"use client";

import { useTamboThreadInput } from "@tambo-ai/react";
import { useCallback } from "react";

import { EventIcon, EVENT_STYLES } from "@/lib/event-styles";
import type { EventType } from "@/lib/event-styles";
import { triggerFeedback } from "@/lib/haptics";

interface QuickAction {
  label: string;
  prompt: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

const EVENT_KEYS: EventType[] = ["feed", "sleep", "diaper", "note"];

function getEventType(label: string): EventType {
  const lower = label.toLowerCase();
  for (const key of EVENT_KEYS) {
    if (lower.includes(key)) return key;
  }
  return "note";
}

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

  const eventType = getEventType(action.label);
  const style = EVENT_STYLES[eventType];

  return (
    <button
      className={`flex items-center gap-2 rounded-lg border px-4 text-left text-sm font-medium transition-[background-color,transform] active:scale-[0.97] ${style.buttonBg} ${
        isPrimary ? "min-h-[56px] py-3" : "min-h-[44px] py-2"
      }`}
      onClick={onClick}
      type="button"
    >
      <EventIcon type={eventType} />
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
