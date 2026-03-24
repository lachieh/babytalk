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

const actionColors: Record<string, string> = {
  diaper: "bg-amber-50 border-amber-200 hover:bg-amber-100",
  feed: "bg-blue-50 border-blue-200 hover:bg-blue-100",
  note: "bg-gray-50 border-gray-200 hover:bg-gray-100",
  sleep: "bg-purple-50 border-purple-200 hover:bg-purple-100",
};

const getColor = (label: string) => {
  const lower = label.toLowerCase();
  for (const [key, value] of Object.entries(actionColors)) {
    if (lower.includes(key)) return value;
  }
  return actionColors.note;
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

  return (
    <button
      className={`rounded-lg border p-3 text-left text-sm font-medium transition-colors ${getColor(action.label)}`}
      onClick={onClick}
      type="button"
    >
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
    <div className="grid grid-cols-2 gap-2">
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
