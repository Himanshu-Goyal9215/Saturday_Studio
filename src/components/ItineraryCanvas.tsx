"use client";

import React, { useState } from "react";
import {
  Calendar,
  Clock,
  CloudRain,
  Compass,
  ExternalLink,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  Utensils,
  Wallet,
  Music,
  Footprints,
  Palette,
  Coffee,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import {
  PlanStop,
  SaturdayPlan,
  ToolTraceItem,
  UserPreferences,
} from "@/types/planner";

interface ItineraryCanvasProps {
  plan?: SaturdayPlan;
  preferences?: UserPreferences;
  allTraces: ToolTraceItem[];
  onSwapStop: (stop: PlanStop) => void;
  disabled?: boolean;
}

function categoryIcon(cat: PlanStop["category"]) {
  switch (cat) {
    case "food":
      return <Utensils className="w-3.5 h-3.5" />;
    case "music":
      return <Music className="w-3.5 h-3.5" />;
    case "walk":
      return <Footprints className="w-3.5 h-3.5" />;
    case "culture":
      return <Palette className="w-3.5 h-3.5" />;
    case "chill":
      return <Coffee className="w-3.5 h-3.5" />;
    default:
      return <Compass className="w-3.5 h-3.5" />;
  }
}

function sourceLabel(src: PlanStop["source"]) {
  switch (src) {
    case "openstreetmap":
      return { text: "OpenStreetMap Live", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "wikipedia":
      return { text: "Wikipedia Local", cls: "bg-sky-50 text-sky-700 border-sky-200" };
    case "ai_research":
      return { text: "AI Scout Sub-Agent", cls: "bg-violet-50 text-violet-700 border-violet-200" };
    case "curated_fallback":
      return { text: "Curated Fallback", cls: "bg-amber-50 text-amber-800 border-amber-200" };
  }
}

export function ItineraryCanvas({
  plan,
  preferences,
  allTraces,
  onSwapStop,
  disabled,
}: ItineraryCanvasProps) {
  const [activeTab, setActiveTab] = useState<"itinerary" | "trace" | "prefs">(
    "itinerary",
  );

  const budgetPct = plan
    ? Math.min(100, Math.round((plan.estimatedTotalCost / Math.max(1, plan.totalBudget)) * 100))
    : 0;

  return (
    <div className="h-full flex flex-col bg-white border border-[#E7E2DA] rounded-2xl shadow-xs overflow-hidden">
      {/* Tab Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E7E2DA] bg-[#FAF8F5]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("itinerary")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === "itinerary"
                ? "bg-[#1A1917] text-white"
                : "text-[#5C5852] hover:bg-[#EFEAE0]"
            }`}
          >
            Itinerary {plan ? `(${plan.stops.length})` : ""}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("trace")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "trace"
                ? "bg-[#1A1917] text-white"
                : "text-[#5C5852] hover:bg-[#EFEAE0]"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Agent Trace
            {allTraces.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === "trace"
                    ? "bg-white/20 text-white"
                    : "bg-[#E7E2DA] text-[#3A3631]"
                }`}
              >
                {allTraces.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("prefs")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "prefs"
                ? "bg-[#1A1917] text-white"
                : "text-[#5C5852] hover:bg-[#EFEAE0]"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            State & Guardrails
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {activeTab === "itinerary" && (
          <>
            {!plan ? (
              <div className="h-full min-h-[340px] flex flex-col items-center justify-center text-center px-6 py-10">
                <div className="w-12 h-12 rounded-2xl bg-[#F3EFE8] border border-[#E7E2DA] flex items-center justify-center mb-4">
                  <Compass className="w-6 h-6 text-[#D95D39]" />
                </div>
                <h3 className="text-base font-semibold text-[#1A1917] mb-1.5">
                  Your Saturday canvas is ready
                </h3>
                <p className="text-xs text-[#5C5852] max-w-sm leading-relaxed mb-6">
                  Chat on the left — tell the planner your mood step-by-step or
                  paste a full JSON prompt. Once validated, your real-place
                  timeline, budget meter, and weather notes appear here.
                </p>
                <div className="grid grid-cols-2 gap-2.5 w-full max-w-md text-left">
                  <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E7E2DA]">
                    <div className="text-[11px] font-semibold text-[#1A1917] mb-0.5">
                      Real Places & Weather
                    </div>
                    <div className="text-[11px] text-[#665E54]">
                      OpenStreetMap Nominatim + Overpass + Open-Meteo + Wikipedia
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E7E2DA]">
                    <div className="text-[11px] font-semibold text-[#1A1917] mb-0.5">
                      Sub-Agent & Validator
                    </div>
                    <div className="text-[11px] text-[#665E54]">
                      Local Vibe Scout + Haversine transit & budget checks
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Plan Header */}
                <div className="rounded-xl bg-[#FAF8F5] border border-[#E7E2DA] p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-[#665E54] mb-1">
                        <MapPin className="w-3.5 h-3.5 text-[#D95D39]" />
                        <span className="font-medium">{plan.city}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {plan.weather?.date || "This Saturday"}
                        </span>
                      </div>
                      <h2 className="text-lg font-semibold text-[#1A1917] leading-snug">
                        {plan.vibeHeadline}
                      </h2>
                    </div>
                    {plan.fallbackUsed && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                        Includes Curated Fallback
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#4C4740] leading-relaxed">
                    {plan.summaryNote}
                  </p>

                  {/* Weather + Budget + Time Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    {plan.weather && (
                      <div className="rounded-lg bg-white border border-[#E7E2DA] p-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#5C5852] mb-1">
                          {plan.weather.isRainRisk ? (
                            <CloudRain className="w-3.5 h-3.5 text-sky-600" />
                          ) : (
                            <Sun className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          <span>Saturday Weather</span>
                        </div>
                        <div className="text-xs font-semibold text-[#1A1917]">
                          {plan.weather.tempMinC}–{plan.weather.tempMaxC}°C ·{" "}
                          {plan.weather.weatherLabel}
                        </div>
                        <div className="text-[10px] text-[#665E54] mt-0.5">
                          Rain chance: {plan.weather.precipProbMax}%
                        </div>
                      </div>
                    )}

                    <div className="rounded-lg bg-white border border-[#E7E2DA] p-2.5">
                      <div className="flex items-center justify-between text-[11px] font-medium text-[#5C5852] mb-1">
                        <span className="inline-flex items-center gap-1">
                          <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                          Est. Spend
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                            plan.budgetStatus === "within"
                              ? "bg-emerald-50 text-emerald-700"
                              : plan.budgetStatus === "slightly_over"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {plan.budgetStatus.replace("_", " ")}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[#1A1917] font-mono">
                        {plan.currencySymbol}
                        {plan.estimatedTotalCost} / {plan.currencySymbol}
                        {plan.totalBudget}
                      </div>
                      <div className="w-full h-1.5 bg-[#EFEAE0] rounded-full mt-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            plan.budgetStatus === "within"
                              ? "bg-emerald-600"
                              : plan.budgetStatus === "slightly_over"
                                ? "bg-amber-500"
                                : "bg-rose-500"
                          }`}
                          style={{ width: `${budgetPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg bg-white border border-[#E7E2DA] p-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#5C5852] mb-1">
                        <Clock className="w-3.5 h-3.5 text-[#D95D39]" />
                        <span>Time Budget</span>
                      </div>
                      <div className="text-xs font-semibold text-[#1A1917] font-mono">
                        {plan.plannedHours}h / {plan.availableHours}h
                      </div>
                      <div className="text-[10px] text-[#665E54] mt-0.5">
                        Includes transit buffers
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline Stops */}
                <div className="space-y-3">
                  {plan.stops.map((stop, idx) => {
                    const src = sourceLabel(stop.source);
                    return (
                      <div key={stop.id} className="space-y-2">
                        {idx > 0 && stop.travelFromPrevMin > 0 && (
                          <div className="flex items-center gap-2 pl-4 text-[11px] text-[#7A6F63]">
                            <div className="w-px h-4 bg-[#D8D1C5]" />
                            <span className="px-2 py-0.5 rounded-full bg-[#F3EFE8] border border-[#E7E2DA] font-mono text-[10px]">
                              ~{stop.travelFromPrevMin} min transit
                            </span>
                          </div>
                        )}

                        <div className="rounded-xl border border-[#E7E2DA] bg-white p-3.5 hover:border-[#CFC7BA] transition-colors">
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-[#1A1917] text-white text-xs font-mono flex items-center justify-center shrink-0">
                                {stop.order}
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#665E54]">
                                  <span>
                                    {stop.startTime} – {stop.endTime}
                                  </span>
                                  <span>·</span>
                                  <span>{stop.durationMin}m</span>
                                </div>
                                <h4 className="text-sm font-semibold text-[#1A1917]">
                                  {stop.placeName}
                                </h4>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md bg-[#F3EFE8] text-[#1A1917] font-mono text-xs font-medium">
                                {stop.estimatedCost === 0
                                  ? "Free"
                                  : `${plan.currencySymbol}${stop.estimatedCost}`}
                              </span>
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => onSwapStop(stop)}
                                title="Ask agent to swap or modify this stop"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#E7E2DA] text-[11px] text-[#5C5852] hover:bg-[#FAF8F5] hover:text-[#1A1917] disabled:opacity-50 cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                                Swap
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FAF8F5] border border-[#E7E2DA] text-[#3A3631]">
                              {categoryIcon(stop.category)}
                              {stop.category}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-[#FAF8F5] border border-[#E7E2DA] text-[#5C5852]">
                              <MapPin className="w-3 h-3" />
                              {stop.neighborhood}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-[#FAF8F5] border border-[#E7E2DA] text-[#5C5852]">
                              <Users className="w-3 h-3" />
                              {stop.crowdLevel} crowd · {stop.indoorOutdoor}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] border ${src.cls}`}
                            >
                              {src.text}
                            </span>
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div className="rounded-lg bg-[#FAF8F5] px-2.5 py-2 text-[#2A2723]">
                              <span className="font-semibold text-[#1A1917]">
                                Why it fits:{" "}
                              </span>
                              {stop.whyItFits}
                            </div>
                            {stop.tradeoffNote && (
                              <div className="rounded-lg bg-amber-50/70 border border-amber-200/70 px-2.5 py-1.5 text-[11px] text-amber-900">
                                <span className="font-semibold">Trade-off: </span>
                                {stop.tradeoffNote}
                              </div>
                            )}
                          </div>

                          <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#665E54]">
                            <span className="truncate max-w-[70%]">
                              {stop.address || stop.title}
                            </span>
                            {stop.mapUrl && (
                              <a
                                href={stop.mapUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-[#D95D39] hover:underline shrink-0"
                              >
                                Google Maps
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {plan.validationNotes.length > 0 && (
                  <div className="rounded-xl border border-[#E7E2DA] bg-[#FAF8F5] p-3 text-xs space-y-1">
                    <div className="font-semibold text-[#1A1917] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#D95D39]" />
                      Planner Validation Notes
                    </div>
                    <ul className="list-disc pl-4 text-[#5C5852] space-y-0.5">
                      {plan.validationNotes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === "trace" && (
          <div className="space-y-2.5">
            {allTraces.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#665E54]">
                No tool calls recorded yet. Send a message to inspect live Gemini
                function-calling traces, real API latencies, and sub-agent outputs.
              </div>
            ) : (
              allTraces.map((trace, i) => (
                <div
                  key={`${trace.id}-${i}`}
                  className="rounded-xl border border-[#E7E2DA] bg-[#FAF8F5] p-3 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {trace.status === "success" && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      {trace.status === "fallback" && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      )}
                      {trace.status === "error" && (
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      )}
                      <span className="font-semibold text-[#1A1917]">
                        {i + 1}. {trace.label}
                      </span>
                      <code className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-[#E7E2DA] text-[#5C5852]">
                        {trace.name}
                      </code>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#665E54]">
                      {trace.sourceBadge && (
                        <span className="px-1.5 py-0.5 rounded bg-white border border-[#E7E2DA]">
                          {trace.sourceBadge}
                        </span>
                      )}
                      {trace.durationMs !== undefined && (
                        <span>{trace.durationMs}ms</span>
                      )}
                    </div>
                  </div>
                  {trace.resultSummary && (
                    <div className="text-[#4C4740]">{trace.resultSummary}</div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "prefs" && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-[#E7E2DA] bg-[#FAF8F5] p-3.5 space-y-2">
              <div className="font-semibold text-[#1A1917]">
                Extracted User Preferences
              </div>
              <pre className="p-3 rounded-lg bg-white border border-[#E7E2DA] font-mono text-[11px] overflow-x-auto text-[#2A2723]">
                {JSON.stringify(
                  preferences || {
                    status: "Waiting for user input...",
                  },
                  null,
                  2,
                )}
              </pre>
            </div>

            <div className="rounded-xl border border-[#E7E2DA] bg-[#FAF8F5] p-3.5 space-y-2">
              <div className="font-semibold text-[#1A1917]">
                Active Agent Architecture & Guardrails
              </div>
              <ul className="space-y-1.5 text-[#5C5852] list-disc pl-4 leading-relaxed">
                <li>
                  <strong>Real Data First:</strong> Nominatim geocoding,
                  Open-Meteo Saturday weather forecast, OpenStreetMap Overpass
                  POIs, and Wikipedia GeoSearch.
                </li>
                <li>
                  <strong>Multi-Agent Tooling:</strong> Dedicated{" "}
                  <code>research_local_vibe_subagent</code> clusters
                  neighborhoods and surfaces acoustic/chill spots.
                </li>
                <li>
                  <strong>Realism Validator:</strong> Enforces budget caps,
                  Haversine travel durations, rain risk checks, and crowd/diet
                  constraints before publishing.
                </li>
                <li>
                  <strong>Graceful Fallbacks:</strong> Overpass mirror rotation +
                  curated city fallback + Gemini model fallback chain
                  (<code>gemini-4-hydrogen</code> →{" "}
                  <code>gemini-3.8-flash</code> → <code>gemini-2.5-flash</code>).
                </li>
                <li>
                  <strong>Scope Guardrail:</strong> Politely declines
                  off-topic or prompt-injection requests and steers back to
                  Saturday planning.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
