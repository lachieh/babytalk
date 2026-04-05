"use client";

import { useTambo, useTamboThreadInput } from "@tambo-ai/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AIInsightCard } from "@/components/ai-insight-card";
import { PersistentTimeline } from "@/components/persistent-timeline";
import { StatusWidget } from "@/components/status-widget";
import { SuggestionZone } from "@/components/suggestion-zone";
import { UndoToast } from "@/components/undo-toast";
import { VoiceButton } from "@/components/voice-button";
import { useAutoDarkMode } from "@/lib/use-auto-dark-mode";

/* ── Collapsible Chat Panel ──────────────────────────────── */

const ChatPanel = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const { messages, isStreaming } = useTambo();
  const { value, setValue, submit, isPending } = useTamboThreadInput();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Filter out system messages — they're configuration, not conversation
  const visibleMessages = useMemo(
    () => messages.filter((msg) => msg.role !== "system"),
    [messages]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!value.trim() || isPending) return;
      submit();
    },
    [value, isPending, submit]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
    },
    [setValue]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !isPending) submit();
      }
    },
    [value, isPending, submit]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-surface">
      {/* Chat header with close */}
      <header className="flex items-center justify-between border-b border-neutral-100 bg-surface-raised px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-600">Chat</h2>
        <button
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          onClick={onClose}
          type="button"
          aria-label="Close chat"
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
      </header>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-6">
        {visibleMessages.length === 0 && !isStreaming && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold text-neutral-800">
              Ask me anything
            </p>
            <p className="mt-1 max-w-[280px] text-sm leading-relaxed text-neutral-400">
              &quot;What&apos;s her sleep pattern this week?&quot; or &quot;How
              many feeds today?&quot;
            </p>
          </div>
        )}
        {visibleMessages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              key={msg.id}
            >
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 ${
                  isUser
                    ? "bg-primary-500 text-white"
                    : "bg-neutral-100 text-neutral-800"
                }`}
              >
                {msg.content.map((block) => {
                  if (block.type === "text") {
                    return (
                      <p
                        className="text-sm leading-relaxed whitespace-pre-wrap"
                        key={`${msg.id}-${block.text.slice(0, 32)}`}
                      >
                        {block.text}
                      </p>
                    );
                  }
                  if (
                    block.type === "component" &&
                    "renderedComponent" in block &&
                    block.renderedComponent
                  ) {
                    const componentBlock = block as {
                      id: string;
                      renderedComponent: React.ReactNode;
                    };
                    return (
                      <div className="my-2" key={componentBlock.id}>
                        {componentBlock.renderedComponent}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          );
        })}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-xl bg-neutral-100 px-4 py-3">
              <div className="flex gap-1">
                <span className="inline-block h-1.5 w-1.5 animate-breathe rounded-full bg-neutral-400" />
                <span className="inline-block h-1.5 w-1.5 animate-breathe rounded-full bg-neutral-400 [animation-delay:200ms]" />
                <span className="inline-block h-1.5 w-1.5 animate-breathe rounded-full bg-neutral-400 [animation-delay:400ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Chat input */}
      <form
        className="border-t border-neutral-100 bg-surface-raised px-4 py-3 safe-bottom"
        onSubmit={handleSubmit}
      >
        <div className="flex items-center gap-2">
          <input
            aria-label="Message"
            className="min-h-[44px] flex-1 rounded-full border border-neutral-200 bg-surface px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
            disabled={isPending}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            type="text"
            value={value}
          />
          <button
            aria-label="Send message"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-[background-color,transform,opacity] hover:bg-primary-600 active:scale-[0.96] disabled:opacity-40"
            disabled={isPending || !value.trim()}
            type="submit"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

/* ── Last Assistant Response ──────────────────────────────── */

const LastResponse = () => {
  const { messages, isStreaming } = useTambo();

  // Find the last assistant message (skip system messages)
  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return messages[i];
    }
    return null;
  }, [messages]);

  if (!lastAssistant && !isStreaming) return null;

  return (
    <div className="px-4 py-2">
      {isStreaming && !lastAssistant && (
        <div className="flex items-center gap-2 rounded-xl bg-neutral-50 px-4 py-3">
          <div className="flex gap-1">
            <span className="inline-block h-1.5 w-1.5 animate-breathe rounded-full bg-neutral-400" />
            <span className="inline-block h-1.5 w-1.5 animate-breathe rounded-full bg-neutral-400 [animation-delay:200ms]" />
            <span className="inline-block h-1.5 w-1.5 animate-breathe rounded-full bg-neutral-400 [animation-delay:400ms]" />
          </div>
        </div>
      )}
      {lastAssistant && (
        <div className="animate-fade-up rounded-xl bg-neutral-50 px-4 py-3">
          {lastAssistant.content.map((block) => {
            if (block.type === "text") {
              return (
                <p
                  className="text-sm leading-relaxed text-neutral-600"
                  key={`last-${block.text.slice(0, 32)}`}
                >
                  {block.text}
                </p>
              );
            }
            if (
              block.type === "component" &&
              "renderedComponent" in block &&
              block.renderedComponent
            ) {
              const componentBlock = block as {
                id: string;
                renderedComponent: React.ReactNode;
              };
              return (
                <div className="my-2" key={componentBlock.id}>
                  {componentBlock.renderedComponent}
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
};

/* ── Bottom Action Bar ───────────────────────────────────── */

const BottomBar = ({ onOpenChat }: { onOpenChat: () => void }) => (
  <div className="border-t border-neutral-100 bg-surface-raised px-4 py-3 safe-bottom">
    <div className="flex items-center justify-center gap-3">
      <VoiceButton />
      <button
        className="flex min-h-[44px] flex-1 items-center rounded-full border border-neutral-200 bg-surface px-4 py-3 text-sm text-neutral-400 transition-colors hover:border-neutral-300 hover:text-neutral-500"
        onClick={onOpenChat}
        type="button"
      >
        Tell me more...
      </button>
    </div>
  </div>
);

/* ── Main Dashboard ──────────────────────────────────────── */

export default function DashboardPage() {
  useAutoDarkMode();
  const [chatOpen, setChatOpen] = useState(false);
  const openChat = useCallback(() => setChatOpen(true), []);
  const closeChat = useCallback(() => setChatOpen(false), []);

  return (
    <div className="flex h-screen flex-col bg-surface">
      {/* Header */}
      <header className="border-b border-neutral-100 bg-surface-raised">
        <div className="px-4 py-3">
          <h1 className="text-base font-semibold text-neutral-600">BabyTalk</h1>
        </div>
        <StatusWidget />
      </header>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        {/* AI Insight — proactive, contextual */}
        <div className="pt-3">
          <AIInsightCard />
        </div>

        {/* Suggestion Zone — primary interaction surface */}
        <SuggestionZone />

        {/* Last AI response — only the most recent, not full history */}
        <LastResponse />

        {/* Divider */}
        <div className="mx-4 border-t border-neutral-100" />

        {/* Persistent Timeline — always visible */}
        <PersistentTimeline />
      </div>

      {/* Bottom bar — voice + chat entry */}
      <BottomBar onOpenChat={openChat} />

      {/* Undo toast — floating */}
      <UndoToast />

      {/* Chat panel — full-screen overlay when open */}
      <ChatPanel open={chatOpen} onClose={closeChat} />
    </div>
  );
}
