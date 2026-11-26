"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Compass,
  RotateCcw,
  Send,
  Sparkles,
  PanelRight,
  MessageSquare,
} from "lucide-react";
import {
  ClientChatMessage,
  PlanStop,
  SaturdayPlan,
  StreamEvent,
  ToolTraceItem,
  UserPreferences,
} from "@/types/planner";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { ItineraryCanvas } from "./ItineraryCanvas";

const BITSCALE_SAMPLE_JSON = JSON.stringify(
  {
    city: "Bangalore",
    budget: 2000,
    available_time: "4 hours",
    mood: "tired but wants to do something fun",
    interests: ["food", "music", "walks"],
    constraints: ["vegetarian", "avoid crowded places"],
  },
  null,
  2,
);

const STARTER_PROMPTS = [
  {
    label: "Chat step-by-step",
    prompt: "Hey! Help me plan a fun Saturday.",
  },
  {
    label: "Bitscale Bangalore JSON",
    prompt: BITSCALE_SAMPLE_JSON,
  },
  {
    label: "Mumbai rainy chill · ₹1500",
    prompt:
      "I'm in Mumbai with ₹1500 and 5 hours on Saturday. Feeling low-energy, love indie art, coffee, and vegetarian food, and want to avoid crowded places.",
  },
  {
    label: "Test edge-case guardrail",
    prompt:
      "Plan a Saturday in Bangalore with ₹150 budget, 2 hours total, visiting 6 museums and a luxury fine-dining steakhouse.",
  },
];

const QUICK_EDITS = [
  "Make this plan 25% cheaper",
  "Swap the food spot for a quieter cafe",
  "Less walking — I'm more tired now",
  "Add a chill live-music or vinyl vibe",
];

const INITIAL_ASSISTANT_MSG: ClientChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hey! I'm **Saturday Studio** — your personal Saturday planner.\n\nTell me a bit about your Saturday (start casually with your **city** or **mood**, and I'll ask 1–2 quick follow-ups), or drop a full prompt / JSON below and I'll scout real OpenStreetMap spots, check Saturday's weather, and build a validated itinerary.",
  timestamp: "",
};

export function PlannerWorkspace() {
  const [messages, setMessages] = useState<ClientChatMessage[]>([
    INITIAL_ASSISTANT_MSG,
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences | undefined>();
  const [currentPlan, setCurrentPlan] = useState<SaturdayPlan | undefined>();
  const [allTraces, setAllTraces] = useState<ToolTraceItem[]>([]);
  const [activeModel, setActiveModel] = useState<string>("gemini-3.5-flash-lite");
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);
  const [mobileView, setMobileView] = useState<"chat" | "canvas">("chat");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);
  const nextId = (prefix: string) => {
    seqRef.current += 1;
    return `${prefix}-${seqRef.current}`;
  };

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d: { geminiConfigured?: boolean }) => {
        setGeminiConfigured(Boolean(d.geminiConfigured));
      })
      .catch(() => setGeminiConfigured(null));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: ClientChatMessage = {
      id: nextId("user"),
      role: "user",
      content: trimmed,
      timestamp: "",
    };

    const assistantId = nextId("assistant");
    const assistantMsg: ClientChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      thoughts: "",
      toolCalls: [],
      timestamp: "",
    };

    const nextHistory = [...messages.filter((m) => m.id !== "welcome"), userMsg];
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          })),
          preferences,
          currentPlan,
        }),
      });

      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          (errData as { error?: string }).error ||
            `Request failed with HTTP ${response.status}`,
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const clean = line.trim();
          if (!clean) continue;
          let ev: StreamEvent;
          try {
            ev = JSON.parse(clean) as StreamEvent;
          } catch {
            continue;
          }

          if (ev.type === "model_info") {
            setActiveModel(ev.model);
          } else if (ev.type === "thought_delta") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, thoughts: (m.thoughts || "") + ev.delta }
                  : m,
              ),
            );
          } else if (ev.type === "text_delta") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + ev.delta }
                  : m,
              ),
            );
          } else if (ev.type === "tool_start") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, toolCalls: [...(m.toolCalls || []), ev.tool] }
                  : m,
              ),
            );
          } else if (ev.type === "tool_result") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      toolCalls: (m.toolCalls || []).map((t) =>
                        t.id === ev.tool.id ? ev.tool : t,
                      ),
                    }
                  : m,
              ),
            );
            setAllTraces((prev) => [...prev, ev.tool]);
          } else if (ev.type === "preferences_updated") {
            setPreferences(ev.preferences);
          } else if (ev.type === "plan_updated") {
            setCurrentPlan(ev.plan);
          } else if (ev.type === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content:
                        m.content ||
                        `Sorry — I hit a snag: ${ev.message}. You can retry or check your GEMINI_API_KEY configuration.`,
                    }
                  : m,
              ),
            );
          }
        }
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Network error during planning.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: `Unable to reach the planner agent: ${msg}`,
              }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleReset = () => {
    if (isStreaming) return;
    setMessages([{ ...INITIAL_ASSISTANT_MSG }]);
    setPreferences(undefined);
    setCurrentPlan(undefined);
    setAllTraces([]);
  };

  const handleSwapStop = (stop: PlanStop) => {
    sendMessage(
      `Please swap stop #${stop.order} (${stop.placeName}) for a different ${stop.category} option that still fits my constraints and budget.`,
    );
  };

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-[#FAF8F5]">
      {/* Top Navbar */}
      <header className="shrink-0 border-b border-[#E7E2DA] bg-white/90 backdrop-blur px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#D95D39] text-white flex items-center justify-center shadow-xs">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-semibold tracking-tight text-[#1A1917]">
                Saturday Studio
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#F3EFE8] border border-[#E7E2DA] text-[#5C5852]">
                <Sparkles className="w-2.5 h-2.5 text-[#D95D39]" />
                {activeModel}
              </span>
            </div>
            <p className="text-[11px] text-[#665E54] hidden sm:block">
              Real OSM places · Open-Meteo Saturday forecast · Multi-agent trace
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Pane Switcher */}
          <div className="flex lg:hidden rounded-lg bg-[#F3EFE8] p-0.5 border border-[#E7E2DA]">
            <button
              type="button"
              onClick={() => setMobileView("chat")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 cursor-pointer ${
                mobileView === "chat"
                  ? "bg-white text-[#1A1917] shadow-2xs"
                  : "text-[#5C5852]"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </button>
            <button
              type="button"
              onClick={() => setMobileView("canvas")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 cursor-pointer ${
                mobileView === "canvas"
                  ? "bg-white text-[#1A1917] shadow-2xs"
                  : "text-[#5C5852]"
              }`}
            >
              <PanelRight className="w-3.5 h-3.5" />
              Plan {currentPlan ? `(${currentPlan.stops.length})` : ""}
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            disabled={isStreaming}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7E2DA] bg-white text-xs font-medium text-[#3A3631] hover:bg-[#FAF8F5] disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Saturday</span>
          </button>
        </div>
      </header>

      {/* Missing API Key Banner */}
      {geminiConfigured === false && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2 flex items-center gap-2 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <code>GEMINI_API_KEY</code> is not configured on the server yet. Add a
            free Google AI Studio key in <code>.env.local</code> (or Vercel
            Environment Variables) and restart to chat.
          </span>
        </div>
      )}

      {/* Split Workspace */}
      <main className="flex-1 min-h-0 max-w-[1440px] w-full mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Chat Pane */}
        <section
          className={`lg:col-span-6 flex flex-col min-h-0 bg-white border border-[#E7E2DA] rounded-2xl shadow-xs overflow-hidden ${
            mobileView === "chat" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF8F5]/60">
            {messages.map((msg, idx) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                isStreaming={isStreaming && idx === messages.length - 1}
              />
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Starter or Refinement Chips */}
          <div className="shrink-0 px-3 pt-2.5 pb-1.5 border-t border-[#ECE7DF] bg-white">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(currentPlan ? QUICK_EDITS : STARTER_PROMPTS).map((item) => {
                const label = typeof item === "string" ? item : item.label;
                const prompt = typeof item === "string" ? item : item.prompt;
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={isStreaming}
                    onClick={() => sendMessage(prompt)}
                    className="shrink-0 px-2.5 py-1 rounded-full border border-[#E7E2DA] bg-[#FAF8F5] hover:bg-[#EFEAE0] text-[11px] font-medium text-[#3A3631] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="shrink-0 p-3 pt-1.5 bg-white"
          >
            <div className="flex items-end gap-2 rounded-xl border border-[#DDD6CA] bg-[#FAF8F5] px-3 py-2 focus-within:border-[#D95D39] focus-within:bg-white transition-colors">
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder="Tell me your city, mood, budget & hours — or paste JSON..."
                className="flex-1 resize-none bg-transparent text-[13px] text-[#1A1917] placeholder:text-[#8C8377] focus:outline-none leading-relaxed"
              />
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#D95D39] text-white hover:bg-[#C24D2B] disabled:opacity-40 transition-colors shrink-0 cursor-pointer"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </section>

        {/* Right: Itinerary & Trace Canvas */}
        <section
          className={`lg:col-span-6 min-h-0 flex flex-col ${
            mobileView === "canvas" ? "flex" : "hidden lg:flex"
          }`}
        >
          <ItineraryCanvas
            plan={currentPlan}
            preferences={preferences}
            allTraces={allTraces}
            onSwapStop={handleSwapStop}
            disabled={isStreaming}
          />
        </section>
      </main>
    </div>
  );
}
