import { z } from "zod";

export type CrowdLevel = "low" | "moderate" | "high";
export type IndoorOutdoor = "indoor" | "outdoor" | "hybrid";
export type PlaceSource =
  | "openstreetmap"
  | "wikipedia"
  | "ai_research"
  | "curated_fallback";

export type StopCategory =
  | "activity"
  | "food"
  | "walk"
  | "music"
  | "culture"
  | "chill";

export interface UserPreferences {
  city?: string;
  budget?: number;
  currency: string;
  currencySymbol: string;
  availableHours?: number;
  startTime?: string;
  mood?: string;
  interests: string[];
  constraints: string[];
  rawInput?: string;
}

export interface WeatherSnapshot {
  date: string;
  tempMinC: number;
  tempMaxC: number;
  precipProbMax: number;
  weatherLabel: string;
  isRainRisk: boolean;
  outdoorAdvice: string;
  source: "open-meteo" | "fallback";
}

export interface CityGeoContext {
  city: string;
  displayName: string;
  lat: number;
  lon: number;
  countryCode: string;
  currency: string;
  currencySymbol: string;
  source: "nominatim" | "fallback";
}

export interface PlaceCandidate {
  id: string;
  name: string;
  category: string;
  neighborhood: string;
  lat: number;
  lon: number;
  address?: string;
  cuisine?: string;
  dietTags: string[];
  openingHours?: string;
  estimatedCost: number;
  estimatedDurationMin: number;
  crowdLevel: CrowdLevel;
  indoorOutdoor: IndoorOutdoor;
  description: string;
  source: PlaceSource;
  mapUrl: string;
}

export const PlanStopSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  startTime: z.string(),
  endTime: z.string(),
  durationMin: z.number().int().positive(),
  travelFromPrevMin: z.number().int().min(0),
  title: z.string(),
  category: z.enum(["activity", "food", "walk", "music", "culture", "chill"]),
  placeName: z.string(),
  neighborhood: z.string(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  mapUrl: z.string().optional(),
  estimatedCost: z.number().min(0),
  crowdLevel: z.enum(["low", "moderate", "high"]),
  indoorOutdoor: z.enum(["indoor", "outdoor", "hybrid"]),
  whyItFits: z.string(),
  tradeoffNote: z.string().optional(),
  source: z.enum([
    "openstreetmap",
    "wikipedia",
    "ai_research",
    "curated_fallback",
  ]),
});

export type PlanStop = z.infer<typeof PlanStopSchema>;

export interface SaturdayPlan {
  id: string;
  city: string;
  currency: string;
  currencySymbol: string;
  totalBudget: number;
  estimatedTotalCost: number;
  budgetStatus: "within" | "slightly_over" | "over";
  availableHours: number;
  plannedHours: number;
  weather?: WeatherSnapshot;
  vibeHeadline: string;
  summaryNote: string;
  stops: PlanStop[];
  validationNotes: string[];
  fallbackUsed: boolean;
  lastUpdatedAt: string;
}

export interface ToolTraceItem {
  id: string;
  name: string;
  label: string;
  status: "running" | "success" | "fallback" | "error";
  args: Record<string, unknown>;
  resultSummary?: string;
  rawResult?: unknown;
  durationMs?: number;
  sourceBadge?: string;
}

export interface ClientChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thoughts?: string;
  toolCalls?: ToolTraceItem[];
  plan?: SaturdayPlan;
  timestamp: string;
}

export type StreamEvent =
  | { type: "thought_delta"; delta: string }
  | { type: "tool_start"; tool: ToolTraceItem }
  | { type: "tool_result"; tool: ToolTraceItem }
  | { type: "preferences_updated"; preferences: UserPreferences }
  | { type: "plan_updated"; plan: SaturdayPlan }
  | { type: "text_delta"; delta: string }
  | { type: "model_info"; model: string; fallbackFrom?: string }
  | { type: "error"; message: string }
  | { type: "done" };
