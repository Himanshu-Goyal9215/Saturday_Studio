import {
  CityGeoContext,
  PlaceCandidate,
  PlanStop,
  PlanStopSchema,
  SaturdayPlan,
  UserPreferences,
  WeatherSnapshot,
} from "@/types/planner";
import {
  fetchSaturdayWeather,
  fetchWikipediaLocalHighlights,
  geocodeCity,
  haversineKm,
  lookupPlaceCoords,
  queryActivityPlaces,
  queryFoodPlaces,
} from "@/lib/services/external-apis";
import { inferCurrencyFromCountry } from "@/lib/services/curated-fallbacks";
import { runLocalVibeResearchSubagent } from "./subagent-research";

export interface AgentSessionState {
  preferences: UserPreferences;
  geo?: CityGeoContext;
  weather?: WeatherSnapshot;
  wikiHighlights: Array<{ title: string; distMeters: number; url: string }>;
  candidates: PlaceCandidate[];
  currentPlan?: SaturdayPlan;
  fallbackUsed: boolean;
}

export function createInitialSessionState(
  prevPrefs?: UserPreferences,
  prevPlan?: SaturdayPlan,
): AgentSessionState {
  const seededCandidates: PlaceCandidate[] = (prevPlan?.stops || [])
    .filter((s) => s.lat !== undefined && s.lon !== undefined)
    .map((s) => ({
      id: s.id,
      name: s.placeName,
      category: s.category,
      neighborhood: s.neighborhood,
      lat: s.lat!,
      lon: s.lon!,
      address: s.address,
      dietTags: [],
      estimatedCost: s.estimatedCost,
      estimatedDurationMin: s.durationMin,
      crowdLevel: s.crowdLevel,
      indoorOutdoor: s.indoorOutdoor,
      description: s.whyItFits,
      source: s.source,
      mapUrl:
        s.mapUrl ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${s.placeName}, ${prevPlan?.city || ""}`,
        )}`,
    }));

  return {
    preferences: prevPrefs || {
      currency: "INR",
      currencySymbol: "₹",
      interests: [],
      constraints: [],
    },
    weather: prevPlan?.weather,
    currentPlan: prevPlan,
    wikiHighlights: [],
    candidates: seededCandidates,
    fallbackUsed: prevPlan?.fallbackUsed || false,
  };
}

export const PLANNER_TOOL_DECLARATIONS = [
  {
    type: "function" as const,
    name: "parse_user_preferences",
    description:
      "Parse and normalize the user's Saturday preferences from either natural language or JSON (city, budget, available_time/hours, start_time, mood, interests, constraints). Call this whenever the user supplies new preferences or updates constraints.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "Target city name, e.g. Bangalore, Mumbai, London" },
        budget: { type: "number", description: "Numeric budget amount in local currency" },
        currency: { type: "string", description: "ISO currency code if explicitly given, e.g. INR, USD, GBP" },
        availableHours: {
          type: "number",
          description: "Available hours as a number, e.g. 4 for '4 hours'",
        },
        startTime: {
          type: "string",
          description: "Preferred start time like '10:00 AM' or '15:00'",
        },
        mood: { type: "string", description: "User mood/energy level" },
        interests: {
          type: "array",
          items: { type: "string" },
          description: "List of interests like food, music, walks, art, books",
        },
        constraints: {
          type: "array",
          items: { type: "string" },
          description: "List of constraints like vegetarian, vegan, avoid crowded places, wheelchair accessible",
        },
      },
    },
  },
  {
    type: "function" as const,
    name: "get_city_weather_and_context",
    description:
      "Geocode the city via OpenStreetMap Nominatim, fetch this Saturday's real weather forecast via Open-Meteo, and fetch nearby cultural highlights from Wikipedia.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "City to look up" },
      },
      required: ["city"],
    },
  },
  {
    type: "function" as const,
    name: "get_activity_options",
    description:
      "Fetch real activities, parks, galleries, music venues, and bookstores in the city from OpenStreetMap Overpass API (with graceful fallback if Overpass is sparse or offline).",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string" },
        interests: {
          type: "array",
          items: { type: "string" },
        },
        avoidCrowds: {
          type: "boolean",
          description: "True if user wants to avoid crowded places or wants a chill outing",
        },
      },
      required: ["city", "interests"],
    },
  },
  {
    type: "function" as const,
    name: "get_food_options",
    description:
      "Fetch real cafes and restaurants in the city from OpenStreetMap Overpass API filtered by dietary constraints (vegetarian, vegan, etc.) and budget.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string" },
        maxMealBudget: {
          type: "number",
          description: "Maximum amount to spend on food/cafe stops combined or per stop",
        },
        constraints: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["city", "maxMealBudget", "constraints"],
    },
  },
  {
    type: "function" as const,
    name: "research_local_vibe_subagent",
    description:
      "Invoke an internal Gemini Local Culture & Route-Clustering Sub-Agent to analyze real map candidates, suggest neighborhood clustering, uncover acoustic/indie/chill local vibes, and identify realistic trade-offs.",
    parameters: {
      type: "object",
      properties: {
        focusNote: {
          type: "string",
          description: "Optional specific angle to scout, e.g. 'low-crowd live music near South Bangalore'",
        },
      },
    },
  },
  {
    type: "function" as const,
    name: "estimate_cost_and_validate_plan",
    description:
      "Deterministically validate a proposed Saturday itinerary against budget, available hours, travel distances between stops, weather rain risk, dietary constraints, and crowd limits. Always call this before finalizing or updating a plan.",
    parameters: {
      type: "object",
      properties: {
        stops: {
          type: "array",
          description: "Ordered list of proposed stops",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              order: { type: "number" },
              startTime: { type: "string" },
              endTime: { type: "string" },
              durationMin: { type: "number" },
              travelFromPrevMin: { type: "number" },
              title: { type: "string" },
              category: {
                type: "string",
                enum: ["activity", "food", "walk", "music", "culture", "chill"],
              },
              placeName: { type: "string" },
              neighborhood: { type: "string" },
              estimatedCost: { type: "number" },
              crowdLevel: { type: "string", enum: ["low", "moderate", "high"] },
              indoorOutdoor: { type: "string", enum: ["indoor", "outdoor", "hybrid"] },
              whyItFits: { type: "string" },
              tradeoffNote: { type: "string" },
              source: {
                type: "string",
                enum: ["openstreetmap", "wikipedia", "ai_research", "curated_fallback"],
              },
            },
            required: [
              "order",
              "startTime",
              "endTime",
              "durationMin",
              "title",
              "category",
              "placeName",
              "neighborhood",
              "estimatedCost",
              "crowdLevel",
              "indoorOutdoor",
              "whyItFits",
              "source",
            ],
          },
        },
      },
      required: ["stops"],
    },
  },
  {
    type: "function" as const,
    name: "save_or_update_plan",
    description:
      "Publish or update the structured Saturday itinerary shown in the user's live Itinerary Canvas. Use this after validation passes (or when modifying/swapping stops on an existing plan).",
    parameters: {
      type: "object",
      properties: {
        vibeHeadline: {
          type: "string",
          description: "Short punchy title for the Saturday plan, e.g. 'Unhurried South Bangalore Green & Acoustic Loop'",
        },
        summaryNote: {
          type: "string",
          description: "2-sentence overview of why this plan fits the user's mood and constraints, including key trade-offs",
        },
        stops: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              order: { type: "number" },
              startTime: { type: "string" },
              endTime: { type: "string" },
              durationMin: { type: "number" },
              travelFromPrevMin: { type: "number" },
              title: { type: "string" },
              category: {
                type: "string",
                enum: ["activity", "food", "walk", "music", "culture", "chill"],
              },
              placeName: { type: "string" },
              neighborhood: { type: "string" },
              address: { type: "string" },
              mapUrl: { type: "string" },
              estimatedCost: { type: "number" },
              crowdLevel: { type: "string", enum: ["low", "moderate", "high"] },
              indoorOutdoor: { type: "string", enum: ["indoor", "outdoor", "hybrid"] },
              whyItFits: { type: "string" },
              tradeoffNote: { type: "string" },
              source: {
                type: "string",
                enum: ["openstreetmap", "wikipedia", "ai_research", "curated_fallback"],
              },
            },
            required: [
              "order",
              "startTime",
              "endTime",
              "durationMin",
              "title",
              "category",
              "placeName",
              "neighborhood",
              "estimatedCost",
              "crowdLevel",
              "indoorOutdoor",
              "whyItFits",
              "source",
            ],
          },
        },
        validationNotes: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["vibeHeadline", "summaryNote", "stops"],
    },
  },
];

export const TOOL_LABELS: Record<string, string> = {
  parse_user_preferences: "Parsing Preferences & Constraints",
  get_city_weather_and_context: "Geocoding & Saturday Weather",
  get_activity_options: "Scanning OpenStreetMap Activities",
  get_food_options: "Searching OpenStreetMap Dining",
  research_local_vibe_subagent: "Running Local Vibe Sub-Agent",
  estimate_cost_and_validate_plan: "Validating Budget, Transit & Realism",
  save_or_update_plan: "Publishing Live Saturday Itinerary",
};

function inferCurrencyForCityText(city: string): {
  currency: string;
  currencySymbol: string;
} {
  const c = city.toLowerCase();
  if (
    c.includes("bangalore") ||
    c.includes("bengaluru") ||
    c.includes("mumbai") ||
    c.includes("delhi") ||
    c.includes("pune") ||
    c.includes("hyderabad") ||
    c.includes("chennai") ||
    c.includes("kolkata") ||
    c.includes("goa") ||
    c.includes("jaipur") ||
    c.includes("india")
  ) {
    return inferCurrencyFromCountry("IN");
  }
  if (c.includes("london") || c.includes("manchester") || c.includes("uk")) {
    return inferCurrencyFromCountry("GB");
  }
  if (c.includes("tokyo") || c.includes("kyoto") || c.includes("osaka")) {
    return inferCurrencyFromCountry("JP");
  }
  if (
    c.includes("paris") ||
    c.includes("berlin") ||
    c.includes("amsterdam") ||
    c.includes("barcelona") ||
    c.includes("rome")
  ) {
    return inferCurrencyFromCountry("FR");
  }
  return inferCurrencyFromCountry("US");
}

function findMatchingCandidate(
  placeName: string,
  candidates: PlaceCandidate[],
): PlaceCandidate | undefined {
  const target = placeName.toLowerCase().trim();
  return candidates.find((c) => {
    const cname = c.name.toLowerCase();
    return (
      cname === target ||
      cname.includes(target) ||
      target.includes(cname)
    );
  });
}

function normalizeStops(
  rawStops: Array<Record<string, unknown>>,
  candidates: PlaceCandidate[],
  city: string,
): PlanStop[] {
  return rawStops.map((raw, idx) => {
    const placeName = String(raw.placeName || raw.title || `Stop ${idx + 1}`);
    const match = findMatchingCandidate(placeName, candidates);
    const id = String(raw.id || match?.id || `stop-${idx + 1}`);
    const mapUrl =
      typeof raw.mapUrl === "string" && raw.mapUrl.startsWith("http")
        ? raw.mapUrl
        : match?.mapUrl ||
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${placeName}, ${city}`,
          )}`;

    const candidateObj = {
      id,
      order: Number(raw.order || idx + 1),
      startTime: String(raw.startTime || "11:00 AM"),
      endTime: String(raw.endTime || "12:00 PM"),
      durationMin: Math.max(15, Math.round(Number(raw.durationMin || 60))),
      travelFromPrevMin: Math.max(
        0,
        Math.round(Number(raw.travelFromPrevMin ?? (idx === 0 ? 0 : 15))),
      ),
      title: String(raw.title || placeName),
      category: (["activity", "food", "walk", "music", "culture", "chill"].includes(
        String(raw.category),
      )
        ? String(raw.category)
        : "activity") as PlanStop["category"],
      placeName,
      neighborhood: String(raw.neighborhood || match?.neighborhood || city),
      address:
        typeof raw.address === "string" ? raw.address : match?.address,
      lat: match?.lat,
      lon: match?.lon,
      mapUrl,
      estimatedCost: Math.max(0, Math.round(Number(raw.estimatedCost ?? 0))),
      crowdLevel: (["low", "moderate", "high"].includes(String(raw.crowdLevel))
        ? String(raw.crowdLevel)
        : match?.crowdLevel || "low") as PlanStop["crowdLevel"],
      indoorOutdoor: (["indoor", "outdoor", "hybrid"].includes(
        String(raw.indoorOutdoor),
      )
        ? String(raw.indoorOutdoor)
        : match?.indoorOutdoor || "hybrid") as PlanStop["indoorOutdoor"],
      whyItFits: String(
        raw.whyItFits || "Aligned with your mood, budget, and interests.",
      ),
      tradeoffNote:
        typeof raw.tradeoffNote === "string" && raw.tradeoffNote.trim()
          ? raw.tradeoffNote
          : undefined,
      source: ([
        "openstreetmap",
        "wikipedia",
        "ai_research",
        "curated_fallback",
      ].includes(String(raw.source))
        ? String(raw.source)
        : match?.source || "ai_research") as PlanStop["source"],
    };

    return PlanStopSchema.parse(candidateObj);
  });
}

export interface ToolExecutionOutcome {
  result: unknown;
  status: "success" | "fallback" | "error";
  summary: string;
  sourceBadge: string;
  preferencesUpdated?: UserPreferences;
  planUpdated?: SaturdayPlan;
}

export async function executePlannerTool(params: {
  name: string;
  args: Record<string, unknown>;
  state: AgentSessionState;
  apiKey: string;
  openrouterApiKey?: string;
  groqApiKey?: string;
}): Promise<ToolExecutionOutcome> {
  const { name, args, state, apiKey, openrouterApiKey, groqApiKey } = params;

  const compactPlaces = (list: PlaceCandidate[]) =>
    list.slice(0, 7).map((p) => ({
      name: p.name,
      category: p.category,
      neighborhood: p.neighborhood,
      estimatedCost: p.estimatedCost,
      estimatedDurationMin: p.estimatedDurationMin,
      crowdLevel: p.crowdLevel,
      indoorOutdoor: p.indoorOutdoor,
      ...(p.dietTags.length ? { dietTags: p.dietTags } : {}),
      source: p.source,
    }));

  switch (name) {
    case "parse_user_preferences": {
      const city =
        typeof args.city === "string" && args.city.trim()
          ? args.city.trim()
          : state.preferences.city;

      const inferred = city
        ? inferCurrencyForCityText(city)
        : {
            currency: state.preferences.currency,
            currencySymbol: state.preferences.currencySymbol,
          };

      const explicitCurrency =
        typeof args.currency === "string" && args.currency.trim()
          ? args.currency.toUpperCase()
          : undefined;

      const currencySymbolMap: Record<string, string> = {
        INR: "₹",
        USD: "$",
        EUR: "€",
        GBP: "£",
        JPY: "¥",
      };

      const currency = explicitCurrency || inferred.currency;
      const currencySymbol =
        currencySymbolMap[currency] || inferred.currencySymbol;

      const updated: UserPreferences = {
        city,
        budget:
          typeof args.budget === "number" && args.budget >= 0
            ? args.budget
            : state.preferences.budget,
        currency,
        currencySymbol,
        availableHours:
          typeof args.availableHours === "number" && args.availableHours > 0
            ? args.availableHours
            : state.preferences.availableHours,
        startTime:
          typeof args.startTime === "string" && args.startTime.trim()
            ? args.startTime.trim()
            : state.preferences.startTime,
        mood:
          typeof args.mood === "string" && args.mood.trim()
            ? args.mood.trim()
            : state.preferences.mood,
        interests: Array.isArray(args.interests)
          ? args.interests.map(String).filter(Boolean)
          : state.preferences.interests,
        constraints: Array.isArray(args.constraints)
          ? args.constraints.map(String).filter(Boolean)
          : state.preferences.constraints,
      };

      state.preferences = updated;

      const missingFields: string[] = [];
      if (!updated.city) missingFields.push("city");
      if (updated.budget === undefined) missingFields.push("budget");
      if (!updated.availableHours) missingFields.push("availableHours");

      return {
        status: "success",
        sourceBadge: "Parser",
        summary: updated.city
          ? `Captured ${updated.city} · ${updated.currencySymbol}${
              updated.budget ?? "?"
            } · ${updated.availableHours ?? "?"}h`
          : "Extracted partial preferences",
        preferencesUpdated: updated,
        result: {
          preferences: updated,
          missingEssentialFields: missingFields,
          readyToPlan: missingFields.length === 0,
        },
      };
    }

    case "get_city_weather_and_context": {
      const city = String(args.city || state.preferences.city || "").trim();
      if (!city) {
        return {
          status: "error",
          sourceBadge: "Nominatim + Open-Meteo",
          summary: "No city provided for weather & geocoding.",
          result: { error: "City name is required." },
        };
      }

      try {
        const { geo, warning } = await geocodeCity(city);
        state.geo = geo;
        state.preferences = {
          ...state.preferences,
          city: geo.city,
          currency: geo.currency,
          currencySymbol: geo.currencySymbol,
        };

        const [weather, wikiHighlights] = await Promise.all([
          fetchSaturdayWeather(geo.lat, geo.lon),
          fetchWikipediaLocalHighlights(geo.lat, geo.lon),
        ]);

        state.weather = weather;
        state.wikiHighlights = wikiHighlights;
        if (geo.source === "fallback" || weather.source === "fallback") {
          state.fallbackUsed = true;
        }

        return {
          status:
            geo.source === "fallback" || weather.source === "fallback"
              ? "fallback"
              : "success",
          sourceBadge: "Nominatim · Open-Meteo · Wikipedia",
          summary: `${geo.city}: ${weather.weatherLabel}, ${weather.tempMinC}–${weather.tempMaxC}°C (${weather.precipProbMax}% rain)`,
          preferencesUpdated: state.preferences,
          result: {
            geo: {
              city: geo.city,
              currency: geo.currency,
              currencySymbol: geo.currencySymbol,
            },
            weather,
            wikiHighlights: wikiHighlights.slice(0, 4).map((w) => ({
              title: w.title,
              distMeters: w.distMeters,
            })),
            warning,
          },
        };
      } catch (err) {
        state.fallbackUsed = true;
        return {
          status: "error",
          sourceBadge: "Geocoding Error",
          summary: `Could not locate "${city}" — ask user to verify the city name.`,
          result: {
            error: err instanceof Error ? err.message : "Geocoding failed",
          },
        };
      }
    }

    case "get_activity_options": {
      const city = String(args.city || state.preferences.city || "");
      const interests = Array.isArray(args.interests)
        ? args.interests.map(String)
        : state.preferences.interests;
      const avoidCrowds = Boolean(
        args.avoidCrowds ??
          state.preferences.constraints.some((c) =>
            c.toLowerCase().includes("crowd"),
          ),
      );

      if (!state.geo && city) {
        try {
          const { geo } = await geocodeCity(city);
          state.geo = geo;
        } catch {
          // handled below
        }
      }

      if (!state.geo) {
        return {
          status: "error",
          sourceBadge: "OpenStreetMap",
          summary: `Missing coordinates for "${city}".`,
          result: { error: "Run get_city_weather_and_context first or supply a valid city." },
        };
      }

      const res = await queryActivityPlaces({
        city,
        lat: state.geo.lat,
        lon: state.geo.lon,
        currency: state.geo.currency,
        interests,
        avoidCrowds,
      });

      if (res.usedFallback) state.fallbackUsed = true;
      state.candidates.push(...res.places);

      return {
        status: res.usedFallback ? "fallback" : "success",
        sourceBadge: res.usedFallback ? "Curated Fallback" : "OpenStreetMap Live",
        summary: res.note,
        result: {
          count: res.places.length,
          usedFallback: res.usedFallback,
          note: res.note,
          places: compactPlaces(res.places),
        },
      };
    }

    case "get_food_options": {
      const city = String(args.city || state.preferences.city || "");
      const maxMealBudget = Number(
        args.maxMealBudget ||
          (state.preferences.budget ? Math.round(state.preferences.budget * 0.65) : 1000),
      );
      const constraints = Array.isArray(args.constraints)
        ? args.constraints.map(String)
        : state.preferences.constraints;

      if (!state.geo && city) {
        try {
          const { geo } = await geocodeCity(city);
          state.geo = geo;
        } catch {
          // handled below
        }
      }

      if (!state.geo) {
        return {
          status: "error",
          sourceBadge: "OpenStreetMap",
          summary: `Missing coordinates for "${city}".`,
          result: { error: "Could not resolve city coordinates." },
        };
      }

      const res = await queryFoodPlaces({
        city,
        lat: state.geo.lat,
        lon: state.geo.lon,
        currency: state.geo.currency,
        maxMealBudget,
        constraints,
      });

      if (res.usedFallback) state.fallbackUsed = true;
      state.candidates.push(...res.places);

      return {
        status: res.usedFallback ? "fallback" : "success",
        sourceBadge: res.usedFallback ? "Curated Fallback" : "OpenStreetMap Live",
        summary: res.note,
        result: {
          count: res.places.length,
          usedFallback: res.usedFallback,
          note: res.note,
          places: compactPlaces(res.places),
        },
      };
    }

    case "research_local_vibe_subagent": {
      const report = await runLocalVibeResearchSubagent({
        apiKey,
        openrouterApiKey,
        groqApiKey,
        city: state.preferences.city || "your city",
        mood: state.preferences.mood || "relaxed and curious",
        interests: state.preferences.interests,
        constraints: state.preferences.constraints,
        budget: state.preferences.budget ?? 2000,
        currencySymbol: state.preferences.currencySymbol,
        availableHours: state.preferences.availableHours ?? 4,
        weather: state.weather,
        candidatePlaces: state.candidates,
        wikiHighlights: state.wikiHighlights,
      });

      return {
        status: report.usedFallback ? "fallback" : "success",
        sourceBadge: "Local Vibe Sub-Agent",
        summary: `Cluster: ${report.neighborhoodCluster} · ${report.hiddenGemIdeas.length} local gems scouted`,
        result: {
          vibeStrategy: report.vibeStrategy,
          neighborhoodCluster: report.neighborhoodCluster,
          hiddenGemIdeas: report.hiddenGemIdeas,
          tradeoffSummary: report.tradeoffSummary,
          usedFallback: report.usedFallback,
        },
      };
    }

    case "estimate_cost_and_validate_plan": {
      const rawStops = Array.isArray(args.stops)
        ? (args.stops as Array<Record<string, unknown>>)
        : [];
      const city = state.preferences.city || "City";
      const stops = normalizeStops(rawStops, state.candidates, city);

      if (state.geo) {
        await Promise.all(
          stops.map(async (s) => {
            if (s.lat !== undefined && s.lon !== undefined) return;
            const resolved = await lookupPlaceCoords(
              s.placeName,
              city,
              state.geo!.lat,
              state.geo!.lon,
            );
            if (resolved) {
              s.lat = resolved.lat;
              s.lon = resolved.lon;
              s.mapUrl = resolved.mapUrl;
              state.candidates.push({
                id: s.id,
                name: s.placeName,
                category: s.category,
                neighborhood: s.neighborhood,
                lat: resolved.lat,
                lon: resolved.lon,
                dietTags: [],
                estimatedCost: s.estimatedCost,
                estimatedDurationMin: s.durationMin,
                crowdLevel: s.crowdLevel,
                indoorOutdoor: s.indoorOutdoor,
                description: s.whyItFits,
                source: s.source,
                mapUrl: resolved.mapUrl,
              });
            }
          }),
        );
      }

      const estimatedTotalCost = stops.reduce(
        (acc, s) => acc + s.estimatedCost,
        0,
      );
      const budget = state.preferences.budget ?? estimatedTotalCost;
      const budgetDelta = estimatedTotalCost - budget;
      const budgetStatus: SaturdayPlan["budgetStatus"] =
        budgetDelta <= 0
          ? "within"
          : budgetDelta <= Math.max(budget * 0.15, 200)
            ? "slightly_over"
            : "over";

      // Check transit & distance between consecutive stops
      const travelNotes: string[] = [];
      let totalMinutes = 0;
      for (let i = 0; i < stops.length; i++) {
        const curr = stops[i];
        let transitMin = curr.travelFromPrevMin;
        if (i > 0) {
          const prev = stops[i - 1];
          if (
            prev.lat !== undefined &&
            prev.lon !== undefined &&
            curr.lat !== undefined &&
            curr.lon !== undefined
          ) {
            const distKm = haversineKm(prev.lat, prev.lon, curr.lat, curr.lon);
            const realisticMin = Math.max(8, Math.round(distKm * 4 + 5));
            transitMin = Math.max(transitMin, realisticMin);
            curr.travelFromPrevMin = transitMin;
            curr.distanceFromPrevKm = Number(distKm.toFixed(1));
            travelNotes.push(
              `${prev.placeName} → ${curr.placeName}: ~${distKm.toFixed(1)} km (~${transitMin} min travel)`,
            );
            if (distKm > 12) {
              travelNotes.push(
                `Warning: ${distKm.toFixed(1)} km hop between ${prev.placeName} and ${curr.placeName} may feel tiring.`,
              );
            }
          }
        }
        totalMinutes += curr.durationMin + (i > 0 ? transitMin : 0);
      }

      const availableHours = state.preferences.availableHours ?? 4;
      const plannedHours = Number((totalMinutes / 60).toFixed(2));

      const warnings: string[] = [];
      const errors: string[] = [];

      if (budgetStatus === "over") {
        errors.push(
          `Total cost (${state.preferences.currencySymbol}${estimatedTotalCost}) exceeds budget (${state.preferences.currencySymbol}${budget}) by more than 15%.`,
        );
      } else if (budgetStatus === "slightly_over") {
        warnings.push(
          `Slightly over budget (${state.preferences.currencySymbol}${estimatedTotalCost} vs ${state.preferences.currencySymbol}${budget}); explain the trade-off clearly.`,
        );
      }

      if (plannedHours > availableHours + 0.5) {
        errors.push(
          `Total time (${plannedHours}h including travel) exceeds available time (${availableHours}h). Trim a stop or shorten durations.`,
        );
      }

      const lowerConstraints = state.preferences.constraints.map((c) =>
        c.toLowerCase(),
      );
      if (lowerConstraints.some((c) => c.includes("crowd"))) {
        const highCrowd = stops.filter((s) => s.crowdLevel === "high");
        if (highCrowd.length > 0) {
          errors.push(
            `Crowd constraint violated at: ${highCrowd.map((s) => s.placeName).join(", ")}.`,
          );
        }
      }

      if (state.weather?.isRainRisk) {
        const outdoorStops = stops.filter((s) => s.indoorOutdoor === "outdoor");
        if (outdoorStops.length > 0) {
          warnings.push(
            `Rain risk (${state.weather.precipProbMax}%) conflicts with outdoor stop(s): ${outdoorStops.map((s) => s.placeName).join(", ")}. Swap to indoor or add rain backup.`,
          );
        }
      }

      const valid = errors.length === 0;
      return {
        status: valid ? "success" : "error",
        sourceBadge: "Deterministic Validator",
        summary: valid
          ? `Valid · ${state.preferences.currencySymbol}${estimatedTotalCost}/${budget} · ${plannedHours}h/${availableHours}h`
          : `Failed validation: ${errors[0]}`,
        result: {
          valid,
          budgetStatus,
          estimatedTotalCost,
          budget,
          plannedHours,
          availableHours,
          errors,
          warnings,
          travelNotes,
        },
      };
    }

    case "save_or_update_plan": {
      const rawStops = Array.isArray(args.stops)
        ? (args.stops as Array<Record<string, unknown>>)
        : [];
      const city = state.preferences.city || state.currentPlan?.city || "Your City";
      const stops = normalizeStops(rawStops, state.candidates, city);

      if (state.geo) {
        await Promise.all(
          stops.map(async (s) => {
            if (s.lat !== undefined && s.lon !== undefined) return;
            const resolved = await lookupPlaceCoords(
              s.placeName,
              city,
              state.geo!.lat,
              state.geo!.lon,
            );
            if (resolved) {
              s.lat = resolved.lat;
              s.lon = resolved.lon;
              s.mapUrl = resolved.mapUrl;
            }
          }),
        );
      }

      // Compute Haversine transit for saved stops too
      let totalMinutes = 0;
      for (let i = 0; i < stops.length; i++) {
        if (i > 0) {
          const prev = stops[i - 1];
          const curr = stops[i];
          if (
            prev.lat !== undefined &&
            prev.lon !== undefined &&
            curr.lat !== undefined &&
            curr.lon !== undefined
          ) {
            const distKm = haversineKm(prev.lat, prev.lon, curr.lat, curr.lon);
            curr.distanceFromPrevKm = Number(distKm.toFixed(1));
            curr.travelFromPrevMin = Math.max(
              curr.travelFromPrevMin,
              Math.max(8, Math.round(distKm * 4 + 5)),
            );
          }
          totalMinutes += curr.travelFromPrevMin;
        }
        totalMinutes += stops[i].durationMin;
      }

      const estimatedTotalCost = stops.reduce(
        (acc, s) => acc + s.estimatedCost,
        0,
      );
      const totalBudget =
        state.preferences.budget ??
        state.currentPlan?.totalBudget ??
        estimatedTotalCost;
      const budgetStatus: SaturdayPlan["budgetStatus"] =
        estimatedTotalCost <= totalBudget
          ? "within"
          : estimatedTotalCost <= Math.max(totalBudget * 1.15, 200)
            ? "slightly_over"
            : "over";

      const availableHours =
        state.preferences.availableHours ??
        state.currentPlan?.availableHours ??
        4;

      const plan: SaturdayPlan = {
        id: state.currentPlan?.id || `plan-${Date.now()}`,
        city,
        currency: state.preferences.currency,
        currencySymbol: state.preferences.currencySymbol,
        totalBudget,
        estimatedTotalCost,
        budgetStatus,
        availableHours,
        plannedHours: Number((totalMinutes / 60).toFixed(2)),
        weather: state.weather || state.currentPlan?.weather,
        vibeHeadline: String(
          args.vibeHeadline || `Saturday in ${city}`,
        ),
        summaryNote: String(
          args.summaryNote ||
            "Personalized Saturday itinerary balanced for mood, budget, and low travel friction.",
        ),
        stops,
        validationNotes: Array.isArray(args.validationNotes)
          ? args.validationNotes.map(String)
          : [],
        fallbackUsed:
          state.fallbackUsed ||
          stops.some((s) => s.source === "curated_fallback"),
        lastUpdatedAt: new Date().toISOString(),
      };

      state.currentPlan = plan;

      return {
        status: "success",
        sourceBadge: "Itinerary Store",
        summary: `Saved ${stops.length}-stop plan (${plan.currencySymbol}${plan.estimatedTotalCost}, ${plan.plannedHours}h)`,
        planUpdated: plan,
        result: {
          saved: true,
          planSummary: {
            city: plan.city,
            stopsCount: plan.stops.length,
            estimatedTotalCost: plan.estimatedTotalCost,
            plannedHours: plan.plannedHours,
            budgetStatus: plan.budgetStatus,
          },
        },
      };
    }

    default:
      return {
        status: "error",
        sourceBadge: "Unknown Tool",
        summary: `Tool "${name}" is not registered.`,
        result: { error: `Unknown tool: ${name}` },
      };
  }
}
