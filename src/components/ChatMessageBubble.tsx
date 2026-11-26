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
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  const tokens = text.split(pattern);

  return tokens.map((tok, i) => {
    if (!tok) return null;
    if (tok.startsWith("**") && tok.endsWith("**") && tok.length > 4) {
      return (
        <strong key={i} className="font-semibold text-[#1A1917]">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith("*") && tok.endsWith("*") && tok.length > 2) {
      return (
        <em key={i} className="italic text-[#3A3631]">
          {tok.slice(1, -1)}
        </em>
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
    const linkMatch = tok.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={i}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="text-[#D95D39] underline hover:text-[#B84827]"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return <React.Fragment key={i}>{tok}</React.Fragment>;
  });
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/.test(line);
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function MarkdownText({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={`sp-${i}`} className="h-1.5" />);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(<hr key={`hr-${i}`} className="my-2.5 border-[#E7E2DA]" />);
      i++;
      continue;
    }

    // Markdown table block
    if (
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const headers = splitTableRow(trimmed);
      i += 2; // skip header & separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes("|")) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      elements.push(
        <div
          key={`tbl-${i}`}
          className="my-2 overflow-x-auto rounded-xl border border-[#E7E2DA] bg-[#FAF8F5]"
        >
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#E7E2DA] bg-[#F3EFE8] text-[#1A1917]">
                {headers.map((h, hi) => (
                  <th key={hi} className="px-2.5 py-2 font-semibold whitespace-nowrap">
                    {renderInlineMarkdown(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DF] bg-white">
              {rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-[#FAF8F5]">
                  {headers.map((_, ci) => (
                    <td key={ci} className="px-2.5 py-2 align-top text-[#2A2723]">
                      {renderInlineMarkdown(row[ci] || "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Headings (#, ##, ###, ####)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const cls =
        level <= 2
          ? "font-semibold text-[#1A1917] text-[14px] mt-2.5 mb-1"
          : "font-semibold text-[#1A1917] text-[13px] mt-2 mb-0.5";
      elements.push(
        <h3 key={`h-${i}`} className={cls}>
          {renderInlineMarkdown(headingMatch[2])}
        </h3>,
      );
      i++;
      continue;
    }

    // Unordered list
    if (/^\s*[-*•]\s+(.+)$/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*[-*•]\s+(.+)$/);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc pl-5 space-y-1 my-1.5">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+(.+)$/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*\d+\.\s+(.+)$/);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal pl-5 space-y-1 my-1.5">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="leading-relaxed">
        {renderInlineMarkdown(trimmed)}
      </p>,
    );
    i++;
  }

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
