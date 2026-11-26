# Saturday Studio — Perfect Saturday Planner Agent

**Live App:** [https://saturdaystudio.himanshugoyal.xyz/](https://saturdaystudio.himanshugoyal.xyz/)  
**GitHub Repository:** [https://github.com/Himanshu-Goyal9215/Saturday_Studio](https://github.com/Himanshu-Goyal9215/Saturday_Studio)

A conversational AI Saturday planner built with **Next.js (App Router + TypeScript + Tailwind CSS)** and the **Google GenAI Interactions API** (`@google/genai`). It combines live streaming **Thinking Summaries**, real-world **zero-cost APIs** (OpenStreetMap Nominatim, Photon & Overpass, Open-Meteo weather, Wikipedia GeoSearch), an internal **Local Vibe Scout Sub-Agent**, and deterministic **budget, Haversine distance/transit, and constraint validation**.

## Key Features

- **Conversational Interviewer + One-Shot JSON Mode**: Chats naturally (asking 1–2 focused questions when input is vague) while also handling complete prompts or pasted JSON payloads (such as the Bitscale test JSON) in one go, plus mid-plan Q&A and stop swaps.
- **Live Thinking & Tool-Calling Trace**: Streams Gemini thinking summaries and every tool invocation (inputs, latency, data source badges, and raw outputs) in real time.
- **7 Specialized Agent Tools**:
  1. `parse_user_preferences` — Normalizes free-text or JSON preferences & detects missing fields.
  2. `get_city_weather_and_context` — Geocodes via OpenStreetMap Nominatim, fetches Saturday weather via Open-Meteo, and pulls local landmarks via Wikipedia GeoSearch.
  3. `get_activity_options` — Queries OpenStreetMap Photon (primary) and Overpass (fallback) for parks, galleries, music venues, and bookstores with crowd filtering and curated fallback.
  4. `get_food_options` — Queries OpenStreetMap Photon / Overpass for cafes & restaurants matching dietary constraints (`vegetarian`, `vegan`) and budget.
  5. `research_local_vibe_subagent` — An internal AI sub-agent that clusters neighborhoods, surfaces chill/acoustic local gems, and identifies realistic trade-offs.
  6. `estimate_cost_and_validate_plan` — Deterministic validator checking budget limits, Haversine distances & transit times (auto-reconciling stop clock times), total hours, weather rain risk, and crowd constraints.
  7. `save_or_update_plan` — Hydrates Google Maps links/coordinates and updates the live Itinerary Canvas as you tweak or swap stops in follow-up turns.
- **Guardrails & Graceful Fallbacks**: Scope guardrail keeps the agent focused on Saturday planning; Photon → Overpass → curated city fallback handles sparse data or `502`/timeout errors; automatic model/provider fallback (`Gemini` → `OpenRouter` → `Groq`) protects against rate limits.

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts                # Streaming NDJSON agent endpoint
│   │   └── health/route.ts              # Server config health check
│   ├── globals.css
│   ├── icon.jpg                         # App favicon (Saturday Studio logo)
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ChatMessageBubble.tsx
│   ├── ItineraryCanvas.tsx              # Live Itinerary, Agent Trace & Trip Brief tabs
│   ├── PlannerWorkspace.tsx             # Split-pane conversational workspace
│   └── ThinkingTraceAccordion.tsx
├── lib/
│   ├── agent/
│   │   ├── openai-compat-fallback.ts    # OpenRouter & Groq fallback runner
│   │   ├── orchestrator.ts              # Multi-turn streaming Gemini Interactions loop
│   │   ├── subagent-research.ts         # Internal Local Vibe Scout sub-agent
│   │   └── tools.ts                     # 7 tool declarations & execution handlers
│   └── services/
│       ├── curated-fallbacks.ts         # Graceful city fallbacks
│       └── external-apis.ts             # Nominatim, Photon, Overpass, Open-Meteo, Wikipedia
└── types/
    └── planner.ts
```

## Running Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env.local` and add your free [Google AI Studio](https://aistudio.google.com/apikey) key:
   ```bash
   cp .env.example .env.local
   ```
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   # Optional paid/credit fallback (prevents free-tier rate limits):
   # OPENROUTER_API_KEY=sk-or-v1-...
   # Optional secondary free fallback:
   # GROQ_API_KEY=gsk_...
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

1. Push this repository to GitHub.
2. Import the repository in [Vercel](https://vercel.com/new).
3. Add `GEMINI_API_KEY` (and optionally `OPENROUTER_API_KEY` / `GROQ_API_KEY`) under **Project Settings → Environment Variables**.
4. Deploy — Next.js App Router and `/api/chat` streaming work out of the box on Vercel.

## How AI Tools Were Used During the Build

Built with **Antigravity** (AI coding assistant) and the **Gemini API Docs MCP server** to scaffold the Next.js TypeScript app, verify `@google/genai` Interactions API streaming and thinking-summary schemas, and integrate free OpenStreetMap/Open-Meteo/Wikipedia APIs alongside an internal Gemini sub-agent and deterministic realism validator.
