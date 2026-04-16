"use client";

import { useBabyContext } from "@/lib/baby-context";
import { useTamboReady } from "@/lib/tambo/provider";
import { useInsightThread } from "@/lib/use-insight-thread";

/** Inner component — only mounted when TamboProvider is active */
const InsightCardInner = () => {
  const { events, baby, loading } = useBabyContext();
  const { insight, refreshing } = useInsightThread(events);

  if (loading || !baby) return null;

  if (!insight) {
    if (refreshing) {
      return (
        <div className="px-4">
          <div className="flex items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <div className="h-2 w-2 animate-breathe rounded-full bg-neutral-300" />
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="px-4">
      <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="flex-1 text-sm leading-snug text-neutral-600">
          {insight}
        </p>
      </div>
    </div>
  );
};

/**
 * AI-generated insight card on the home tab.
 * Uses a persistent background thread for contextual one-line insights.
 */
export const AIInsightCard = () => {
  const tamboReady = useTamboReady();

  if (!tamboReady) return null;

  return <InsightCardInner />;
};
