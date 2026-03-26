"use client";

import { useTambo, useTamboThreadInput } from "@tambo-ai/react";
import { useCallback, useEffect, useRef } from "react";

import { VoiceButton } from "@/components/voice-button";

const MessageList = () => {
  const { messages, isStreaming } = useTambo();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 space-y-spacing-md overflow-y-auto px-spacing-lg py-spacing-xl">
      {messages.length === 0 && !isStreaming && (
        <div className="animate-fade-up flex h-full flex-col items-center justify-center text-center">
          <p className="text-[var(--font-size-lg)] font-semibold text-neutral-800">
            Hi there
          </p>
          <p className="mt-spacing-xs max-w-[280px] text-[var(--font-size-sm)] leading-relaxed text-neutral-400">
            Tell me what happened — &quot;baby just ate&quot; or &quot;diaper change&quot; — or tap the mic to talk.
          </p>
        </div>
      )}
      {messages.map((msg) => {
        const isUser = msg.role === "user";

        return (
          <div
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            key={msg.id}
          >
            <div
              className={`max-w-[80%] rounded-radius-xl px-spacing-lg py-spacing-md ${
                isUser
                  ? "bg-primary-500 text-white"
                  : "bg-neutral-100 text-neutral-800"
              }`}
            >
              {msg.content.map((block) => {
                if (block.type === "text") {
                  return (
                    <p
                      className="text-[var(--font-size-sm)] leading-relaxed whitespace-pre-wrap"
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
                    <div className="my-spacing-sm" key={componentBlock.id}>
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
          <div className="flex items-center gap-spacing-sm rounded-radius-xl bg-neutral-100 px-spacing-lg py-spacing-md">
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
  );
};

const ChatInput = () => {
  const { value, setValue, submit, isPending } = useTamboThreadInput();

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
        if (value.trim() && !isPending) {
          submit();
        }
      }
    },
    [value, isPending, submit]
  );

  return (
    <form
      className="border-t border-neutral-100 bg-surface-raised px-spacing-lg py-spacing-md"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center gap-spacing-sm">
        <input
          className="min-h-[44px] flex-1 rounded-radius-full border border-neutral-200 bg-surface px-spacing-lg py-spacing-md text-[var(--font-size-sm)] text-neutral-800 placeholder:text-neutral-300 transition-colors duration-[var(--duration-fast)] focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
          disabled={isPending}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Tell me about the baby..."
          type="text"
          value={value}
        />
        <VoiceButton />
        <button
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-radius-full bg-primary-500 px-spacing-lg py-spacing-sm text-[var(--font-size-sm)] font-medium text-white transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)] hover:bg-primary-600 active:scale-[0.96] disabled:opacity-40"
          disabled={isPending || !value.trim()}
          type="submit"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </div>
    </form>
  );
};

export default function DashboardPage() {
  return (
    <div className="flex h-screen flex-col bg-surface">
      <header className="border-b border-neutral-100 bg-surface-raised px-spacing-lg py-spacing-md">
        <h1 className="text-[var(--font-size-base)] font-semibold text-neutral-600">
          BabyTalk
        </h1>
      </header>
      <MessageList />
      <ChatInput />
    </div>
  );
}
