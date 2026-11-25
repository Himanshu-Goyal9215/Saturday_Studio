"use client";

import React from "react";
import { Sparkles, User } from "lucide-react";
import { ClientChatMessage } from "@/types/planner";
import { ThinkingTraceAccordion } from "./ThinkingTraceAccordion";

interface ChatMessageBubbleProps {
  message: ClientChatMessage;
  isStreaming?: boolean;
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith("**") && tok.endsWith("**") && tok.length > 4) {
      return (
        <strong key={i} className="font-semibold text-[#1A1917]">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith("`") && tok.endsWith("`") && tok.length > 2) {
      return (
        <code
          key={i}
          className="px-1 py-0.5 rounded bg-[#EFEAE0] text-[#2A2723] font-mono text-[11px]"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={i}>{tok}</React.Fragment>;
  });
}

function MarkdownText({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (keyPrefix: string) => {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={`${keyPrefix}-ul`} className="list-disc pl-4 space-y-1 my-1.5">
        {listItems.map((item, idx) => (
          <li key={idx} className="leading-relaxed">
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trimEnd();
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (bulletMatch) {
      listItems.push(bulletMatch[1]);
      return;
    }

    flushList(`l-${idx}`);

    if (!line.trim()) {
      elements.push(<div key={`sp-${idx}`} className="h-1.5" />);
      return;
    }

    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={idx} className="font-semibold text-[#1A1917] text-sm mt-2 mb-1">
          {renderInlineMarkdown(line.slice(4))}
        </h4>,
      );
      return;
    }

    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={idx} className="font-semibold text-[#1A1917] text-sm mt-2.5 mb-1">
          {renderInlineMarkdown(line.slice(3))}
        </h3>,
      );
      return;
    }

    elements.push(
      <p key={idx} className="leading-relaxed">
        {renderInlineMarkdown(line)}
      </p>,
    );
  });

  flushList("end");
  return <div className="space-y-1 text-[13px] text-[#2A2723]">{elements}</div>;
}

export function ChatMessageBubble({
  message,
  isStreaming = false,
}: ChatMessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end gap-2.5">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#1A1917] text-white px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap shadow-xs">
          {message.content}
        </div>
        <div className="w-7 h-7 rounded-full bg-[#E7E2DA] text-[#3A3631] flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-3.5 h-3.5" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-full bg-[#D95D39]/12 border border-[#D95D39]/25 text-[#D95D39] flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <ThinkingTraceAccordion
          thoughts={message.thoughts}
          toolCalls={message.toolCalls}
          isStreaming={isStreaming}
        />
        {message.content ? (
          <div className="rounded-2xl rounded-tl-sm bg-white border border-[#E7E2DA] px-4 py-3 shadow-xs">
            <MarkdownText content={message.content} />
          </div>
        ) : isStreaming ? (
          <div className="text-xs text-[#7A6F63] px-1">
            Crafting your Saturday plan...
          </div>
        ) : null}
      </div>
    </div>
  );
}
