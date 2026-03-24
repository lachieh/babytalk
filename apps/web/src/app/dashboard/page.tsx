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
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      {messages.map((msg) => {
        const isUser = msg.role === "user";

        return (
          <div
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            key={msg.id}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                isUser ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
              }`}
            >
              {msg.content.map((block) => {
                if (block.type === "text") {
                  return (
                    <p
                      className="text-sm whitespace-pre-wrap"
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
          <div className="rounded-2xl bg-gray-100 px-4 py-2">
            <p className="text-sm text-gray-400">Thinking...</p>
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
    <form className="border-t bg-white p-4" onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          disabled={isPending}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Tell me about the baby..."
          type="text"
          value={value}
        />
        <VoiceButton />
        <button
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={isPending || !value.trim()}
          type="submit"
        >
          Send
        </button>
      </div>
    </form>
  );
};

export default function DashboardPage() {
  return (
    <div className="flex h-screen flex-col bg-white">
      <header className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold">BabyLog</h1>
      </header>
      <MessageList />
      <ChatInput />
    </div>
  );
}
