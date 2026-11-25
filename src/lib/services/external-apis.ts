import {
  CityGeoContext,
  CrowdLevel,
  IndoorOutdoor,
  PlaceCandidate,
  WeatherSnapshot,
} from "@/types/planner";
import {
  getCuratedFallbackForCity,
  inferCurrencyFromCountry,
} from "./curated-fallbacks";

const REQUEST_TIMEOUT_MS = 6500;
const USER_AGENT = "SaturdayPlannerAgent/1.0 (https://github.com/bitscale-assignment)";

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getNextSaturdayISO(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat
  const daysUntilSat = (6 - day + 7) % 7;
  const sat = new Date(now);
  sat.setDate(now.getDate() + daysUntilSat);
  return sat.toISOString().slice(0, 10);
}

export async function geocodeCity(city: string): Promise<{
  geo: CityGeoContext;
  warning?: string;
}> {
  const cleanCity = city.trim();
  const fallbackBundle = getCuratedFallbackForCity(cleanCity);

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(
      cleanCity,
    )}`;
    const res = await fetchWithTimeout(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Nominatim HTTP ${res.status}`);
    }

    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: { country_code?: string; city?: string; town?: string; state?: string };
    }>;

    if (!data || data.length === 0) {
      if (fallbackBundle) {
        return {
          geo: fallbackBundle.geo,
          warning: `Nominatim returned no match for "${cleanCity}"; used curated city coordinates.`,
        };
      }
      throw new Error(`Could not find city "${cleanCity}" on OpenStreetMap.`);
    }

    const hit = data[0];
    const countryCode = (hit.address?.country_code || "US").toUpperCase();
    const { currency, currencySymbol } = inferCurrencyFromCountry(countryCode);

    return {
      geo: {
        city: cleanCity,
        displayName: hit.display_name,
        lat: Number(hit.lat),
        lon: Number(hit.lon),
        countryCode,
        currency,
        currencySymbol,
        source: "nominatim",
      },
    };
  } catch (err) {
    if (fallbackBundle) {
      return {
        geo: fallbackBundle.geo,
        warning: `Geocoding fallback triggered (${err instanceof Error ? err.message : "timeout"}).`,
      };
    }
    throw err;
  }
}

function wmoCodeToLabel(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Misty / foggy";
  if (code <= 57) return "Light drizzle";
  if (code <= 67) return "Rain showers";
  if (code <= 77) return "Snow / sleet";
  if (code <= 82) return "Heavy rain showers";
  return "Thunderstorms possible";
}

export async function fetchSaturdayWeather(
  lat: number,
  lon: number,
): Promise<WeatherSnapshot> {
  const saturdayDate = getNextSaturdayISO();
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=8`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);

    const data = (await res.json()) as {
      daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: number[];
      };
    };

    const daily = data.daily;
    if (!daily || !daily.time?.length) {
      throw new Error("Open-Meteo missing daily forecast");
    }

    const idx = Math.max(0, daily.time.indexOf(saturdayDate));
    const tempMinC = Math.round(daily.temperature_2m_min[idx] ?? 18);
    const tempMaxC = Math.round(daily.temperature_2m_max[idx] ?? 26);
    const precipProbMax = Math.round(
      daily.precipitation_probability_max[idx] ?? 15,
    );
    const weatherCode = daily.weather_code[idx] ?? 1;
    const weatherLabel = wmoCodeToLabel(weatherCode);
    const isRainRisk = precipProbMax >= 50 || weatherCode >= 61;

    return {
      date: daily.time[idx] || saturdayDate,
      tempMinC,
      tempMaxC,
      precipProbMax,
      weatherLabel,
      isRainRisk,
      outdoorAdvice: isRainRisk
        ? "High rain risk — prioritize covered/indoor venues or carry an umbrella with indoor backups."
        : tempMaxC >= 32
          ? "Warm afternoon — schedule outdoor walks early or near sunset, and use shaded/AC venues midday."
          : "Great outdoor window — parks, lakeside walks, and open-air cafes are comfortable.",
      source: "open-meteo",
    };
  } catch {
    return {
      date: saturdayDate,
      tempMinC: 19,
      tempMaxC: 27,
      precipProbMax: 20,
      weatherLabel: "Forecast unavailable (assumed mild)",
      isRainRisk: false,
      outdoorAdvice:
        "Live weather timed out — mix outdoor & covered backup options for safety.",
      source: "fallback",
    };
  }
}

interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

async function runOverpassQuery(query: string): Promise<OsmElement[]> {
  let lastError: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(query)}`,
        },
        4500,
      );
      if (!res.ok) {
        throw new Error(`Overpass ${endpoint} HTTP ${res.status}`);
      }
      const json = (await res.json()) as { elements?: OsmElement[] };
      return json.elements || [];
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError || new Error("All Overpass mirrors failed");
}

function estimateLocalCost(
  currency: string,
  kind: "food" | "cafe" | "activity_paid" | "free",
): number {
  if (kind === "free") return 0;
  if (currency === "INR") {
    if (kind === "cafe") return 450;
    if (kind === "food") return 750;
    return 300;
  }
  if (currency === "JPY") {
    if (kind === "cafe") return 900;
    if (kind === "food") return 1800;
    return 1000;
  }
  // USD / GBP / EUR scale
  if (kind === "cafe") return 12;
  if (kind === "food") return 24;
  return 15;
}

function inferCrowdLevel(tags: Record<string, string>): CrowdLevel {
  const tourism = tags.tourism || "";
  const leisure = tags.leisure || "";
  const amenity = tags.amenity || "";
  if (tourism === "theme_park" || amenity === "nightclub" || amenity === "fast_food") {
    return "high";
  }
  if (
    leisure === "garden" ||
    amenity === "library" ||
    shopIsBookstore(tags) ||
    tourism === "gallery"
  ) {
    return "low";
  }
  if (leisure === "park" || amenity === "cafe" || tourism === "museum") {
    return "moderate";
  }
  return "moderate";
}

function shopIsBookstore(tags: Record<string, string>): boolean {
  return tags.shop === "books";
}

function extractNeighborhood(tags: Record<string, string>, city: string): string {
  return (
    tags["addr:suburb"] ||
    tags["addr:neighbourhood"] ||
    tags["addr:district"] ||
    tags["addr:street"] ||
    city
  );
}

export async function queryActivityPlaces(params: {
  city: string;
  lat: number;
  lon: number;
  currency: string;
  interests: string[];
  avoidCrowds: boolean;
}): Promise<{
  places: PlaceCandidate[];
  usedFallback: boolean;
  note: string;
}> {
  const radius = 3200;
  const query = `
[out:json][timeout:4];
(
  nwr["leisure"~"park|garden|nature_reserve"](around:${radius},${params.lat},${params.lon});
  nwr["tourism"~"museum|gallery|viewpoint"](around:${radius},${params.lat},${params.lon});
  nwr["amenity"~"arts_centre|music_venue|theatre|library"](around:${radius},${params.lat},${params.lon});
  nwr["shop"="books"](around:${radius},${params.lat},${params.lon});
);
out center 30;
`.trim();

  try {
    const elements = await runOverpassQuery(query);
    const seen = new Set<string>();
    const parsed: PlaceCandidate[] = [];

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name?.trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());

      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat === undefined || lon === undefined) continue;

      const crowdLevel = inferCrowdLevel(tags);
      if (params.avoidCrowds && crowdLevel === "high") continue;

      const isParkOrView =
        tags.leisure === "park" ||
        tags.leisure === "garden" ||
        tags.leisure === "nature_reserve" ||
        tags.tourism === "viewpoint";
      const isMusicOrArt =
        tags.amenity === "music_venue" ||
        tags.amenity === "arts_centre" ||
        tags.amenity === "theatre" ||
        tags.tourism === "gallery";
      const isMuseum = tags.tourism === "museum";
      const isBooks = tags.shop === "books" || tags.amenity === "library";

      const category = isMusicOrArt
        ? "music / culture"
        : isParkOrView
          ? "park / walk"
          : isMuseum
            ? "museum / heritage"
            : isBooks
              ? "bookstore / chill"
              : "local spot";

      const indoorOutdoor: IndoorOutdoor = isParkOrView
        ? "outdoor"
        : "indoor";

      const isFree =
        isParkOrView ||
        isBooks ||
        tags.fee === "no";

      parsed.push({
        id: `osm-${el.type}-${el.id}`,
        name,
        category,
        neighborhood: extractNeighborhood(tags, params.city),
        lat,
        lon,
        address: [tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"]]
          .filter(Boolean)
          .join(", ") || undefined,
        dietTags: [],
        openingHours: tags.opening_hours,
        estimatedCost: estimateLocalCost(
          params.currency,
          isFree ? "free" : "activity_paid",
        ),
        estimatedDurationMin: isParkOrView ? 60 : isBooks ? 50 : 75,
        crowdLevel,
        indoorOutdoor,
        description:
          tags.description ||
          `${category} in ${extractNeighborhood(tags, params.city)} (via OpenStreetMap).`,
        source: "openstreetmap",
        mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${name}, ${params.city}`,
        )}&center=${lat},${lon}`,
      });
    }

    // Rank by alignment with interests + lower crowd if requested
    const interestTokens = params.interests.map((i) => i.toLowerCase());
    parsed.sort((a, b) => {
      const score = (p: PlaceCandidate) => {
        let s = 0;
        const hay = `${p.name} ${p.category} ${p.description}`.toLowerCase();
        for (const tok of interestTokens) {
          if (hay.includes(tok)) s += 3;
          if (tok.includes("walk") && p.category.includes("park")) s += 3;
          if (tok.includes("music") && p.category.includes("music")) s += 4;
          if (tok.includes("art") && (p.category.includes("culture") || p.category.includes("museum"))) s += 3;
          if (tok.includes("book") && p.category.includes("book")) s += 3;
        }
        if (params.avoidCrowds && p.crowdLevel === "low") s += 2;
        if (p.address) s += 1;
        return s;
      };
      return score(b) - score(a);
    });

    const top = parsed.slice(0, 12);
    if (top.length > 0) {
      return {
        places: top,
        usedFallback: false,
        note: `Fetched ${top.length} real activity spots from OpenStreetMap Overpass API.`,
      };
    }

    const fallback = getCuratedFallbackForCity(params.city);
    if (fallback) {
      return {
        places: fallback.activities,
        usedFallback: true,
        note: `OpenStreetMap returned 0 matching spots; switched to curated fallback for ${params.city}.`,
      };
    }

    return {
      places: [],
      usedFallback: true,
      note: "OpenStreetMap returned 0 matching spots.",
    };
  } catch (err) {
    const fallback = getCuratedFallbackForCity(params.city);
    if (fallback) {
      return {
        places: fallback.activities,
        usedFallback: true,
        note: `Overpass API failed (${err instanceof Error ? err.message : "timeout"}); gracefully fell back to curated spots.`,
      };
    }
    return {
      places: [],
      usedFallback: true,
      note: `Overpass API failed (${err instanceof Error ? err.message : "timeout"}).`,
    };
  }
}

export async function queryFoodPlaces(params: {
  city: string;
  lat: number;
  lon: number;
  currency: string;
  maxMealBudget: number;
  constraints: string[];
}): Promise<{
  places: PlaceCandidate[];
  usedFallback: boolean;
  note: string;
}> {
  const lowerConstraints = params.constraints.map((c) => c.toLowerCase());
  const wantsVeg = lowerConstraints.some(
    (c) => c.includes("veg") || c.includes("plant"),
  );
  const wantsVegan = lowerConstraints.some((c) => c.includes("vegan"));
  const avoidCrowds = lowerConstraints.some(
    (c) => c.includes("crowd") || c.includes("quiet"),
  );

  const radius = 2800;
  // Query vegetarian-tagged places + cafes/restaurants so we have real options even when OSM diet tags are sparse
  const dietFilter = wantsVegan
    ? `node["amenity"~"restaurant|cafe"]["diet:vegan"~"yes|only"](around:${radius},${params.lat},${params.lon});`
    : wantsVeg
      ? `node["amenity"~"restaurant|cafe"]["diet:vegetarian"~"yes|only"](around:${radius},${params.lat},${params.lon});`
      : "";

  const query = `
[out:json][timeout:4];
(
  ${dietFilter}
  node["amenity"~"cafe|restaurant"](around:${radius},${params.lat},${params.lon});
);
out 30;
`.trim();

  try {
    const elements = await runOverpassQuery(query);
    const seen = new Set<string>();
    const parsed: PlaceCandidate[] = [];

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name?.trim();
      if (!name || seen.has(name.toLowerCase())) continue;

      // Skip obvious non-veg fast food chains if vegetarian is requested
      const lowerName = name.toLowerCase();
      const cuisine = (tags.cuisine || "").toLowerCase();
      if (
        wantsVeg &&
        (lowerName.includes("kfc") ||
          lowerName.includes("steak") ||
          lowerName.includes("bbq") ||
          lowerName.includes("butcher") ||
          lowerName.includes("seafood") ||
          cuisine.includes("steak") ||
          cuisine.includes("seafood"))
      ) {
        continue;
      }
      if (tags["diet:vegetarian"] === "no") continue;

      seen.add(name.toLowerCase());
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat === undefined || lon === undefined) continue;

      const isCafe = tags.amenity === "cafe" || cuisine.includes("coffee");
      const dietTags: string[] = [];
      if (
        tags["diet:vegetarian"] === "yes" ||
        tags["diet:vegetarian"] === "only" ||
        cuisine.includes("vegetarian") ||
        cuisine.includes("south_indian") ||
        cuisine.includes("indian")
      ) {
        dietTags.push("vegetarian");
      }
      if (tags["diet:vegan"] === "yes" || tags["diet:vegan"] === "only") {
        dietTags.push("vegan");
      }

      const crowdLevel: CrowdLevel = isCafe
        ? "low"
        : tags.amenity === "fast_food"
          ? "high"
          : "moderate";
      if (avoidCrowds && crowdLevel === "high") continue;

      const estCost = estimateLocalCost(
        params.currency,
        isCafe ? "cafe" : "food",
      );

      parsed.push({
        id: `osm-food-${el.type}-${el.id}`,
        name,
        category: isCafe ? "cafe" : "restaurant",
        neighborhood: extractNeighborhood(tags, params.city),
        lat,
        lon,
        address:
          [tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"]]
            .filter(Boolean)
            .join(", ") || undefined,
        cuisine: tags.cuisine || (isCafe ? "Cafe & light bites" : "Local dining"),
        dietTags,
        openingHours: tags.opening_hours,
        estimatedCost: Math.min(estCost, Math.max(estCost, params.maxMealBudget)),
        estimatedDurationMin: isCafe ? 45 : 60,
        crowdLevel,
        indoorOutdoor: tags.outdoor_seating === "yes" ? "hybrid" : "indoor",
        description: `${tags.cuisine ? `${tags.cuisine} ` : ""}${
          isCafe ? "cafe" : "restaurant"
        } in ${extractNeighborhood(tags, params.city)}${
          dietTags.length ? ` (${dietTags.join(", ")})` : ""
        }.`,
        source: "openstreetmap",
        mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${name}, ${params.city}`,
        )}&center=${lat},${lon}`,
      });
    }

    // Prioritize explicitly diet-tagged matches, then cafes/local spots within budget
    parsed.sort((a, b) => {
      const score = (p: PlaceCandidate) => {
        let s = 0;
        if (wantsVeg && p.dietTags.includes("vegetarian")) s += 5;
        if (wantsVegan && p.dietTags.includes("vegan")) s += 6;
        if (p.estimatedCost <= params.maxMealBudget) s += 3;
        if (avoidCrowds && p.crowdLevel === "low") s += 2;
        if (p.address) s += 1;
        return s;
      };
      return score(b) - score(a);
    });

    const top = parsed.slice(0, 12);
    if (top.length > 0) {
      return {
        places: top,
        usedFallback: false,
        note: `Fetched ${top.length} real food & cafe spots from OpenStreetMap Overpass API.`,
      };
    }

    const fallback = getCuratedFallbackForCity(params.city);
    if (fallback) {
      return {
        places: fallback.food,
        usedFallback: true,
        note: `OpenStreetMap returned 0 food matches; used curated ${params.city} vegetarian/chill picks.`,
      };
    }

    return {
      places: [],
      usedFallback: true,
      note: "OpenStreetMap returned 0 matching food options.",
    };
  } catch (err) {
    const fallback = getCuratedFallbackForCity(params.city);
    if (fallback) {
      return {
        places: fallback.food,
        usedFallback: true,
        note: `Overpass food lookup failed (${err instanceof Error ? err.message : "timeout"}); gracefully fell back to curated picks.`,
      };
    }
    return {
      places: [],
      usedFallback: true,
      note: `Overpass food lookup failed (${err instanceof Error ? err.message : "timeout"}).`,
    };
  }
}

export async function fetchWikipediaLocalHighlights(
  lat: number,
  lon: number,
): Promise<Array<{ title: string; distMeters: number; url: string }>> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=6000&gslimit=8&format=json`;
    const res = await fetchWithTimeout(url, {}, 4500);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: {
        geosearch?: Array<{ pageid: number; title: string; dist: number }>;
      };
    };
    return (data.query?.geosearch || []).map((item) => ({
      title: item.title,
      distMeters: Math.round(item.dist),
      url: `https://en.wikipedia.org/?curid=${item.pageid}`,
    }));
  } catch {
    return [];
  }
}
