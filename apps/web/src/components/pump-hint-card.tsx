"use client";

import type { PumpHint } from "@/lib/pump-hint-bus";

export const PumpHintCard = ({ hint }: { hint: PumpHint | null }) => {
  if (!hint) return null;
  return (
    <div
      aria-live="polite"
      className="rounded-xl border border-pump-100 bg-pump-50/60 px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-pump-500"
        />
        <p className="text-sm leading-snug text-neutral-700">{hint.hint}</p>
      </div>
    </div>
  );
};
