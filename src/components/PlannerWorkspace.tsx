"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  History,
  RotateCcw,
  Send,
  PanelRight,
  MessageSquare,
  Trash2,
  X,
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
    label: "Gurgaon chill · ₹1800",
    prompt:
      "I'm in Gurgaon with ₹1800 and 4 hours on Saturday afternoon. Feeling a bit tired, love photography/art, quiet walks, and vegetarian cafes — please avoid crowded malls.",
  },
  {
    label: "Sample Bangalore JSON",
    prompt: BITSCALE_SAMPLE_JSON,
  },
  {
    label: "Mumbai chill · ₹1500",
    prompt:
      "I'm in Mumbai with ₹1500 and 5 hours on Saturday. Feeling low-energy, love indie art, coffee, and vegetarian food, and want to avoid crowded places.",
  },
  {
    label: "Test edge-case guardrail",
    prompt:
      "Plan a Saturday in Gurgaon with ₹150 budget, 2 hours total, visiting 6 museums and a luxury fine-dining steakhouse.",
  },
];

function buildContextualFollowUps(plan: SaturdayPlan): string[] {
  const suggestions: string[] = [];
  const foodStop = plan.stops.find((s) => s.category === "food" || s.category === "chill");
  if (foodStop) {
    suggestions.push(`Swap ${foodStop.placeName} for a different vibe`);
  }
  if (plan.estimatedTotalCost > 0) {
    const target = Math.max(100, Math.round(plan.estimatedTotalCost * 0.75));
    suggestions.push(`Keep total spend under ${plan.currencySymbol}${target}`);
  }
  const hasOutdoor = plan.stops.some((s) => s.indoorOutdoor === "outdoor");
  if (hasOutdoor || plan.weather?.isRainRisk) {
    suggestions.push("Make it 100% indoor in case of rain");
  } else {
    suggestions.push("Add an outdoor walk or waterfront stop");
  }
  if (plan.stops[0]) {
    suggestions.push(`Why did you pick ${plan.stops[0].placeName}?`);
  }
  return suggestions.slice(0, 4);
}

const INITIAL_ASSISTANT_MSG: ClientChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hey! I'm **Saturday Studio** — your personal Saturday planner.\n\nTell me a bit about your Saturday (start casually with your **city** or **mood**, and I'll ask 1–2 quick follow-ups), or drop a full prompt / JSON below and I'll scout real OpenStreetMap spots, check Saturday's weather, and build a validated itinerary.",
  timestamp: "",
};

interface SavedSaturdaySession {
  id: string;
  title: string;
  city?: string;
  updatedAt: string;
  messages: ClientChatMessage[];
  preferences?: UserPreferences;
  currentPlan?: SaturdayPlan;
  allTraces: ToolTraceItem[];
}

const HISTORY_STORAGE_KEY = "saturday_studio_history_v1";
const ACTIVE_SESSION_KEY = "saturday_studio_active_v1";
const MAX_SAVED_SESSIONS = 15;

function readSavedSessions(): SavedSaturdaySession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedSaturdaySession[]) : [];
  } catch {
    return [];
  }
}

function writeSavedSessions(sessions: SavedSaturdaySession[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(sessions.slice(0, MAX_SAVED_SESSIONS)),
    );
  } catch {
    // Ignore storage quota / private mode errors
  }
}

function deriveSessionTitle(
  messages: ClientChatMessage[],
  plan?: SaturdayPlan,
  prefs?: UserPreferences,
): string {
  if (plan?.vibeHeadline) return plan.vibeHeadline;
  const firstUser = messages.find((m) => m.role === "user");
  if (firstUser) {
    const clean = firstUser.content.replace(/\s+/g, " ").trim();
    if (clean.startsWith("{") && prefs?.city) {
      return `${prefs.city} Saturday Plan`;
    }
    return clean.length > 48 ? `${clean.slice(0, 48)}...` : clean;
  }
  return prefs?.city ? `${prefs.city} Saturday` : "New Saturday";
}

let clientSeq = 0;
function createClientId(prefix: string): string {
  clientSeq += 1;
  return `${prefix}-${Date.now()}-${clientSeq}`;
}

export function PlannerWorkspace() {
  const [sessionId, setSessionId] = useState<string>("session-initial");
  const [savedSessions, setSavedSessions] = useState<SavedSaturdaySession[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [messages, setMessages] = useState<ClientChatMessage[]>([
    INITIAL_ASSISTANT_MSG,
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences | undefined>();
  const [currentPlan, setCurrentPlan] = useState<SaturdayPlan | undefined>();
  const [allTraces, setAllTraces] = useState<ToolTraceItem[]>([]);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);
  const [mobileView, setMobileView] = useState<"chat" | "canvas">("chat");

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d: { geminiConfigured?: boolean }) => {
        setGeminiConfigured(Boolean(d.geminiConfigured));
      })
      .catch(() => setGeminiConfigured(null));
  }, []);

  // Load saved browser history once on client mount
  useEffect(() => {
    const sessions = readSavedSessions();
    const activeId = window.localStorage.getItem(ACTIVE_SESSION_KEY);
    const active = activeId ? sessions.find((s) => s.id === activeId) : undefined;
    queueMicrotask(() => {
      setSavedSessions(sessions);
      if (active && active.messages.length > 0) {
        setSessionId(active.id);
        setMessages(active.messages);
        setPreferences(active.preferences);
        setCurrentPlan(active.currentPlan);
        setAllTraces(active.allTraces || []);
      } else {
        setSessionId(createClientId("session"));
      }
      setHydrated(true);
    });
  }, []);

  // Auto-save active session to localStorage when idle
  useEffect(() => {
    if (!hydrated || isStreaming) return;
    const hasUserMessage = messages.some((m) => m.role === "user");
    if (!hasUserMessage) return;

    const updatedSession: SavedSaturdaySession = {
      id: sessionId,
      title: deriveSessionTitle(messages, currentPlan, preferences),
      city: currentPlan?.city || preferences?.city,
      updatedAt: new Date().toISOString(),
      messages,
      preferences,
      currentPlan,
      allTraces,
    };

    queueMicrotask(() => {
      setSavedSessions((prev) => {
        const next = [
          updatedSession,
          ...prev.filter((s) => s.id !== sessionId),
        ].slice(0, MAX_SAVED_SESSIONS);
        writeSavedSessions(next);
        try {
          window.localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
        } catch {}
        return next;
      });
    });
  }, [hydrated, isStreaming, sessionId, messages, preferences, currentPlan, allTraces]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const contextualFollowUps = useMemo(
    () => (currentPlan ? buildContextualFollowUps(currentPlan) : []),
    [currentPlan],
  );

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: ClientChatMessage = {
      id: createClientId("user"),
      role: "user",
      content: trimmed,
      timestamp: "",
    };

    const assistantId = createClientId("assistant");
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

          if (ev.type === "thought_delta") {
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
                        `Sorry — I hit a snag: ${ev.message}. Please try again.`,
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
    const freshId = createClientId("session");
    setSessionId(freshId);
    setMessages([{ ...INITIAL_ASSISTANT_MSG }]);
    setPreferences(undefined);
    setCurrentPlan(undefined);
    setAllTraces([]);
    setHistoryOpen(false);
    try {
      window.localStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch {}
  };

  const handleLoadSession = (session: SavedSaturdaySession) => {
    if (isStreaming) return;
    setSessionId(session.id);
    setMessages(session.messages);
    setPreferences(session.preferences);
    setCurrentPlan(session.currentPlan);
    setAllTraces(session.allTraces || []);
    setHistoryOpen(false);
    try {
      window.localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
    } catch {}
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = savedSessions.filter((s) => s.id !== id);
    setSavedSessions(next);
    writeSavedSessions(next);
    if (id === sessionId) {
      handleReset();
    }
  };

  const handleClearAllHistory = () => {
    setSavedSessions([]);
    writeSavedSessions([]);
    handleReset();
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
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden border border-[#E7E2DA] shadow-xs bg-[#FAF8F5] shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.jpg"
              alt="Saturday Studio"
              className="w-full h-full object-cover scale-125"
            />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-semibold tracking-tight text-[#1A1917]">
              Saturday Studio
            </h1>
            <p className="text-[11px] text-[#665E54] hidden sm:block">
              Real OpenStreetMap places · Saturday weather · Conversational AI planner
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

          <div className="relative">
            <button
              type="button"
              onClick={() => setHistoryOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7E2DA] bg-white text-xs font-medium text-[#3A3631] hover:bg-[#FAF8F5] cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">History</span>
              {savedSessions.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#F3EFE8] text-[#5C5852]">
                  {savedSessions.length}
                </span>
              )}
            </button>

            {historyOpen && (
              <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl border border-[#E7E2DA] bg-white shadow-lg z-50 overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-[#E7E2DA] bg-[#FAF8F5] flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1A1917]">
                    Saved Saturdays (Browser)
                  </span>
                  <div className="flex items-center gap-2">
                    {savedSessions.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllHistory}
                        className="text-[11px] text-[#8C8377] hover:text-rose-600 cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setHistoryOpen(false)}
                      className="text-[#7A6F63] hover:text-[#1A1917] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-[#F1ECE3]">
                  {savedSessions.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-[#665E54]">
                      Your chats and Saturday plans are saved automatically in this
                      browser as you explore.
                    </div>
                  ) : (
                    savedSessions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => handleLoadSession(s)}
                        className={`px-3.5 py-2.5 flex items-start justify-between gap-2 hover:bg-[#FAF8F5] cursor-pointer ${
                          s.id === sessionId ? "bg-[#FAF8F5]" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[#1A1917] truncate">
                            {s.title}
                          </div>
                          <div className="text-[10px] text-[#665E54] flex items-center gap-1.5 mt-0.5">
                            {s.city && <span>{s.city}</span>}
                            {s.currentPlan && (
                              <>
                                <span>·</span>
                                <span>{s.currentPlan.stops.length} stops</span>
                                <span>·</span>
                                <span className="font-mono">
                                  {s.currentPlan.currencySymbol}
                                  {s.currentPlan.estimatedTotalCost}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          title="Delete saved chat"
                          className="p-1 rounded text-[#8C8377] hover:text-rose-600 hover:bg-rose-50 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
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
            No AI API key is configured on the server yet. Add{" "}
            <code>GEMINI_API_KEY</code> or <code>OPENROUTER_API_KEY</code> in{" "}
            <code>.env.local</code> (or Vercel Environment Variables) and restart.
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

          {/* Starter or Contextual Follow-Up Suggestions */}
          <div className="shrink-0 px-3 pt-2.5 pb-1.5 border-t border-[#ECE7DF] bg-white">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {currentPlan
                ? contextualFollowUps.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={isStreaming}
                      onClick={() => sendMessage(prompt)}
                      className="shrink-0 px-2.5 py-1 rounded-full border border-[#E7E2DA] bg-[#FAF8F5] hover:bg-[#EFEAE0] text-[11px] font-medium text-[#3A3631] transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))
                : STARTER_PROMPTS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      disabled={isStreaming}
                      onClick={() => sendMessage(item.prompt)}
                      className="shrink-0 px-2.5 py-1 rounded-full border border-[#E7E2DA] bg-[#FAF8F5] hover:bg-[#EFEAE0] text-[11px] font-medium text-[#3A3631] transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
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
                placeholder="Ask a question, tweak a stop, or tell me your city, mood & budget..."
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
