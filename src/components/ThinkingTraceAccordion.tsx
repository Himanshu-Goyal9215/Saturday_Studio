"use client";

import React, { useState } from "react";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Wrench,
  XCircle,
} from "lucide-react";
import { ToolTraceItem } from "@/types/planner";

interface ThinkingTraceAccordionProps {
  thoughts?: string;
  toolCalls?: ToolTraceItem[];
  isStreaming?: boolean;
}

function renderThoughtLine(line: string, idx: number) {
  const tokens = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <p key={idx} className="leading-relaxed">
      {tokens.map((tok, i) => {
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
      })}
    </p>
  );
}

function FormattedThoughts({ raw }: { raw: string }) {
  const cleanedLines = raw
    .split("\n")
    .filter(
      (line) =>
        !/^\s*(Switching to fallback|Switching to |Gemini unavailable)/i.test(
          line.trim(),
        ),
    );

  const blocks: React.ReactNode[] = [];
  cleanedLines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      blocks.push(<div key={`sp-${idx}`} className="h-1.5" />);
      return;
    }
    blocks.push(renderThoughtLine(trimmed, idx));
  });

  return (
    <div className="rounded-lg bg-white/90 border border-[#ECE7DF] p-3 text-[#4C4740] text-xs space-y-0.5">
      {blocks}
    </div>
  );
}

export function ThinkingTraceAccordion({
  thoughts,
  toolCalls = [],
  isStreaming = false,
}: ThinkingTraceAccordionProps) {
  const [open, setOpen] = useState(isStreaming);
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);

  const hasThoughts = Boolean(thoughts && thoughts.trim().length > 0);
  const hasTools = toolCalls.length > 0;
  if (!hasThoughts && !hasTools && !isStreaming) return null;

  const runningTool = toolCalls.find((t) => t.status === "running");

  return (
    <div className="mb-3 rounded-xl border border-[#E7E2DA] bg-[#F7F4EE] text-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[#EFEAE0] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isStreaming ? (
            <Loader2 className="w-3.5 h-3.5 text-[#D95D39] animate-spin shrink-0" />
          ) : (
            <Brain className="w-3.5 h-3.5 text-[#7A6F63] shrink-0" />
          )}
          <span className="font-medium text-[#3A3631] truncate">
            {isStreaming
              ? runningTool
                ? `${runningTool.label}...`
                : "Agent is thinking..."
              : `Thought process · ${toolCalls.length} tool${
                  toolCalls.length === 1 ? "" : "s"
                } used`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-[#7A6F63]">
          {open ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-[#E7E2DA] px-3 py-2.5 space-y-2.5 bg-[#FAF8F4]">
          {hasThoughts && <FormattedThoughts raw={thoughts!} />}

          {hasTools && (
            <div className="space-y-1.5">
              {toolCalls.map((tool) => {
                const isExpanded = expandedToolId === tool.id;
                return (
                  <div
                    key={tool.id}
                    className="rounded-lg border border-[#E7E2DA] bg-white overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedToolId(isExpanded ? null : tool.id)
                      }
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-[#FAF8F5] cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {tool.status === "running" && (
                          <Loader2 className="w-3.5 h-3.5 text-[#D95D39] animate-spin shrink-0" />
                        )}
                        {tool.status === "success" && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        )}
                        {tool.status === "fallback" && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        )}
                        {tool.status === "error" && (
                          <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        )}
                        <Wrench className="w-3 h-3 text-[#8C8377] shrink-0" />
                        <span className="font-medium text-[#2A2723] truncate">
                          {tool.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {tool.sourceBadge && (
                          <span className="px-1.5 py-0.5 rounded bg-[#F3EFE8] text-[#665E54] text-[10px] font-mono">
                            {tool.sourceBadge}
                          </span>
                        )}
                        {tool.durationMs !== undefined && (
                          <span className="text-[10px] font-mono text-[#8C8377]">
                            {tool.durationMs}ms
                          </span>
                        )}
                      </div>
                    </button>

                    {tool.resultSummary && (
                      <div className="px-2.5 pb-1.5 text-[11px] text-[#5C5852]">
                        {tool.resultSummary}
                      </div>
                    )}

                    {isExpanded && (
                      <div className="border-t border-[#EFEAE0] bg-[#FAF8F5] p-2 space-y-1.5 font-mono text-[10px] text-[#4C4740]">
                        <div>
                          <div className="uppercase tracking-wider text-[9px] text-[#8C8377] mb-0.5">
                            Tool: {tool.name} — Arguments
                          </div>
                          <pre className="overflow-x-auto max-h-28 p-1.5 rounded bg-white border border-[#E7E2DA]">
                            {JSON.stringify(tool.args, null, 2)}
                          </pre>
                        </div>
                        {tool.rawResult !== undefined && (
                          <div>
                            <div className="uppercase tracking-wider text-[9px] text-[#8C8377] mb-0.5">
                              Output
                            </div>
                            <pre className="overflow-x-auto max-h-40 p-1.5 rounded bg-white border border-[#E7E2DA]">
                              {JSON.stringify(tool.rawResult, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
