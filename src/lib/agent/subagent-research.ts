import { GoogleGenAI } from "@google/genai";
import { PlaceCandidate, WeatherSnapshot } from "@/types/planner";

export interface LocalScoutReport {
  vibeStrategy: string;
  neighborhoodCluster: string;
  hiddenGemIdeas: Array<{
    name: string;
    category: string;
    neighborhood: string;
    estimatedCost: number;
    estimatedDurationMin: number;
    whyItFits: string;
    tradeoffNote: string;
    crowdLevel: "low" | "moderate" | "high";
    indoorOutdoor: "indoor" | "outdoor" | "hybrid";
  }>;
  tradeoffSummary: string;
  modelUsed: string;
  usedFallback: boolean;
}

const SUBAGENT_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.8-flash",
  "gemini-4-hydrogen",
];
const GROQ_SUBAGENT_MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"];

export async function runLocalVibeResearchSubagent(params: {
  apiKey: string;
  groqApiKey?: string;
  city: string;
  mood: string;
  interests: string[];
  constraints: string[];
  budget: number;
  currencySymbol: string;
  availableHours: number;
  weather?: WeatherSnapshot;
  candidatePlaces: PlaceCandidate[];
  wikiHighlights: Array<{ title: string; distMeters: number; url: string }>;
}): Promise<LocalScoutReport> {
  const ai = new GoogleGenAI({
    apiKey: params.apiKey,
    httpOptions: {
      timeout: 15000,
      retryOptions: { attempts: 1 },
    },
  });

  const candidateSummary = params.candidatePlaces.slice(0, 12).map((p) => ({
    name: p.name,
    category: p.category,
    neighborhood: p.neighborhood,
    crowdLevel: p.crowdLevel,
    indoorOutdoor: p.indoorOutdoor,
    estimatedCost: p.estimatedCost,
    dietTags: p.dietTags,
  }));

  const prompt = `You are a specialized Local Culture & Route-Clustering Sub-Agent helping a Saturday Planner.
City: ${params.city}
Mood: ${params.mood}
Interests: ${params.interests.join(", ") || "general chill"}
Constraints: ${params.constraints.join(", ") || "none"}
Budget: ${params.currencySymbol}${params.budget}
Available time: ${params.availableHours} hours
Saturday weather: ${
    params.weather
      ? `${params.weather.weatherLabel}, ${params.weather.tempMinC}–${params.weather.tempMaxC}°C, rain risk ${params.weather.precipProbMax}%`
      : "unknown"
  }

Real OpenStreetMap candidates found:
${JSON.stringify(candidateSummary, null, 2)}

Wikipedia local landmarks nearby:
${JSON.stringify(params.wikiHighlights.slice(0, 6))}

Respond ONLY with valid JSON matching this schema:
{
  "vibeStrategy": "1-2 sentences on pacing & energy management for this mood",
  "neighborhoodCluster": "best 1-2 adjacent neighborhoods to stay in so transit stays short",
  "hiddenGemIdeas": [
    {
      "name": "Real or realistic local venue/experience name in ${params.city}",
      "category": "music / culture / chill / food / walk",
      "neighborhood": "specific area",
      "estimatedCost": 300,
      "estimatedDurationMin": 60,
      "whyItFits": "concrete reason tied to mood/interests",
      "tradeoffNote": "honest tradeoff (e.g. timing, cover charge, or crowd window)",
      "crowdLevel": "low",
      "indoorOutdoor": "indoor"
    }
  ],
  "tradeoffSummary": "1-2 sentences explaining the biggest trade-off (cost vs chill, weather vs outdoor, crowd timing)"
}
Keep hiddenGemIdeas to 2-3 high-signal local ideas (especially for music, live acoustic cafes, or quiet corners that OpenStreetMap tags often miss). Respect all constraints strictly.`;

  for (const model of params.apiKey ? SUBAGENT_MODELS : []) {
    try {
      const interaction = await ai.interactions.create(
        {
          model,
          store: false,
          input: prompt,
          generation_config: {
            thinking_level: "low",
          },
        },
        { maxRetries: 0 },
      );

      const raw = (interaction.output_text || "").trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Subagent did not return JSON");

      const parsed = JSON.parse(jsonMatch[0]) as Omit<
        LocalScoutReport,
        "modelUsed" | "usedFallback"
      >;

      return {
        vibeStrategy: parsed.vibeStrategy || "Keep stops clustered with gentle pacing.",
        neighborhoodCluster: parsed.neighborhoodCluster || params.city,
        hiddenGemIdeas: Array.isArray(parsed.hiddenGemIdeas)
          ? parsed.hiddenGemIdeas.slice(0, 3)
          : [],
        tradeoffSummary:
          parsed.tradeoffSummary ||
          "Balancing comfort, travel time, and budget within your Saturday window.",
        modelUsed: model,
        usedFallback: false,
      };
    } catch {
      // Try next fallback model
    }
  }

  if (params.groqApiKey) {
    for (const model of GROQ_SUBAGENT_MODELS) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${params.groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
          }),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = (data.choices?.[0]?.message?.content || "").trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;
        const parsed = JSON.parse(jsonMatch[0]) as Omit<
          LocalScoutReport,
          "modelUsed" | "usedFallback"
        >;
        return {
          vibeStrategy: parsed.vibeStrategy || "Keep stops clustered with gentle pacing.",
          neighborhoodCluster: parsed.neighborhoodCluster || params.city,
          hiddenGemIdeas: Array.isArray(parsed.hiddenGemIdeas)
            ? parsed.hiddenGemIdeas.slice(0, 3)
            : [],
          tradeoffSummary:
            parsed.tradeoffSummary ||
            "Balancing comfort, travel time, and budget within your Saturday window.",
          modelUsed: `groq/${model}`,
          usedFallback: false,
        };
      } catch {
        // Try next Groq model
      }
    }
  }

  return {
    vibeStrategy: `Cluster 2–3 nearby spots in ${params.city} so you spend time enjoying instead of commuting, matching a "${params.mood}" pace.`,
    neighborhoodCluster:
      params.candidatePlaces[0]?.neighborhood || `${params.city} Central`,
    hiddenGemIdeas: [],
    tradeoffSummary:
      "Using verified OpenStreetMap & weather signals directly since the sub-agent scout timed out.",
    modelUsed: "heuristic-fallback",
    usedFallback: true,
  };
}
