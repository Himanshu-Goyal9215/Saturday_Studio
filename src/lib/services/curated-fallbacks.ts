import { CityGeoContext, PlaceCandidate } from "@/types/planner";

interface CityFallbackBundle {
  geo: CityGeoContext;
  activities: PlaceCandidate[];
  food: PlaceCandidate[];
}

function mapsSearchUrl(name: string, city: string, lat?: number, lon?: number): string {
  if (lat !== undefined && lon !== undefined) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${name}, ${city}`,
    )}&center=${lat},${lon}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${name}, ${city}`,
  )}`;
}

export const CURATED_CITY_FALLBACKS: Record<string, CityFallbackBundle> = {
  bangalore: {
    geo: {
      city: "Bangalore",
      displayName: "Bengaluru, Karnataka, India",
      lat: 12.9716,
      lon: 77.5946,
      countryCode: "IN",
      currency: "INR",
      currencySymbol: "₹",
      source: "fallback",
    },
    activities: [
      {
        id: "blr-act-lalbagh",
        name: "Lalbagh Botanical Garden (West Gate Quiet Loop)",
        category: "park / walk",
        neighborhood: "Basavanagudi / Lalbagh",
        lat: 12.9507,
        lon: 77.5848,
        address: "Mavalli, Bengaluru",
        dietTags: [],
        openingHours: "06:00–19:00",
        estimatedCost: 50,
        estimatedDurationMin: 75,
        crowdLevel: "low",
        indoorOutdoor: "outdoor",
        description:
          "Shaded 19th-century botanical avenues and lakeside benches; calmest around the West Gate & bonsai garden.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Lalbagh Botanical Garden", "Bengaluru", 12.9507, 77.5848),
      },
      {
        id: "blr-act-indian-music",
        name: "Indian Music Experience Museum (IME)",
        category: "music / culture",
        neighborhood: "JP Nagar",
        lat: 12.8913,
        lon: 77.5858,
        address: "Brigade Millennium Ave, JP Nagar 7th Phase",
        dietTags: [],
        openingHours: "10:00–18:00",
        estimatedCost: 250,
        estimatedDurationMin: 90,
        crowdLevel: "low",
        indoorOutdoor: "hybrid",
        description:
          "Interactive sound garden and peaceful listening booths spanning classical, indie, and folk music.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Indian Music Experience Museum", "Bengaluru", 12.8913, 77.5858),
      },
      {
        id: "blr-act-blossoms-quiet",
        name: "Champaca Bookstore & Quiet Patio",
        category: "bookstore / chill",
        neighborhood: "Vasanth Nagar",
        lat: 12.9905,
        lon: 77.5955,
        address: "Edward Road, Vasanth Nagar",
        dietTags: [],
        openingHours: "11:00–19:30",
        estimatedCost: 300,
        estimatedDurationMin: 60,
        crowdLevel: "low",
        indoorOutdoor: "indoor",
        description:
          "Independent treehouse-style bookstore with curated vinyl/indie playlists and zero mall chaos.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Champaca Bookstore", "Bengaluru", 12.9905, 77.5955),
      },
      {
        id: "blr-act-sankey",
        name: "Sankey Tank Lakeside Walk",
        category: "walk / chill",
        neighborhood: "Sadashivanagar / Malleswaram",
        lat: 13.0085,
        lon: 77.5734,
        address: "Sankey Road, Sadashivanagar",
        dietTags: [],
        openingHours: "06:00–20:00",
        estimatedCost: 0,
        estimatedDurationMin: 60,
        crowdLevel: "moderate",
        indoorOutdoor: "outdoor",
        description:
          "Flat, gentle lakeside promenade ideal when tired — easy benches and sunset light.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Sankey Tank", "Bengaluru", 13.0085, 77.5734),
      },
    ],
    food: [
      {
        id: "blr-food-mtr",
        name: "MTR Lalbagh (Mavalli Tiffin Rooms)",
        category: "restaurant",
        neighborhood: "Lalbagh Road",
        lat: 12.9552,
        lon: 77.5855,
        address: "14, Lalbagh Road, Mavalli",
        cuisine: "South Indian Vegetarian",
        dietTags: ["vegetarian"],
        openingHours: "06:30–11:00, 12:30–20:30",
        estimatedCost: 450,
        estimatedDurationMin: 50,
        crowdLevel: "moderate",
        indoorOutdoor: "indoor",
        description:
          "Iconic 100% pure-veg heritage dining hall — sit-down tiffin & filter coffee.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("MTR Lalbagh Road", "Bengaluru", 12.9552, 77.5855),
      },
      {
        id: "blr-food-green-theory",
        name: "Green Theory",
        category: "cafe / restaurant",
        neighborhood: "Residency Road",
        lat: 12.9665,
        lon: 77.6004,
        address: "15, Convent Road, Off Residency Road",
        cuisine: "Vegetarian & Vegan Cafe",
        dietTags: ["vegetarian", "vegan"],
        openingHours: "11:00–23:00",
        estimatedCost: 850,
        estimatedDurationMin: 65,
        crowdLevel: "low",
        indoorOutdoor: "hybrid",
        description:
          "Leafy colonial bungalow garden serving exclusively vegetarian comfort plates and acoustic background music.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Green Theory Convent Road", "Bengaluru", 12.9665, 77.6004),
      },
      {
        id: "blr-food-subz",
        name: "Enerjuvate Studio & Cafe",
        category: "cafe",
        neighborhood: "Jayanagar",
        lat: 12.9317,
        lon: 77.5809,
        address: "Jayanagar 4th Block",
        cuisine: "Vegetarian Health Cafe",
        dietTags: ["vegetarian", "vegan", "gluten-free"],
        openingHours: "10:30–21:30",
        estimatedCost: 650,
        estimatedDurationMin: 55,
        crowdLevel: "low",
        indoorOutdoor: "indoor",
        description:
          "Calm vegetarian-friendly studio cafe with acoustic vibe and unhurried seating.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Enerjuvate Jayanagar", "Bengaluru", 12.9317, 77.5809),
      },
    ],
  },
  mumbai: {
    geo: {
      city: "Mumbai",
      displayName: "Mumbai, Maharashtra, India",
      lat: 19.076,
      lon: 72.8777,
      countryCode: "IN",
      currency: "INR",
      currencySymbol: "₹",
      source: "fallback",
    },
    activities: [
      {
        id: "bom-act-prithvi",
        name: "Prithvi Theatre Courtyard & Bookshop",
        category: "culture / chill",
        neighborhood: "Juhu",
        lat: 19.1065,
        lon: 72.8258,
        dietTags: [],
        estimatedCost: 200,
        estimatedDurationMin: 75,
        crowdLevel: "low",
        indoorOutdoor: "hybrid",
        description:
          "Bamboo-shaded courtyard ideal for unhurried coffee, indie arts vibe, and light evening acoustic energy.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Prithvi Theatre", "Mumbai", 19.1065, 72.8258),
      },
      {
        id: "bom-act-jehangir",
        name: "Jehangir Art Gallery & Kala Ghoda Stroll",
        category: "art / walk",
        neighborhood: "Kala Ghoda, Fort",
        lat: 18.9276,
        lon: 72.8318,
        dietTags: [],
        estimatedCost: 0,
        estimatedDurationMin: 80,
        crowdLevel: "low",
        indoorOutdoor: "hybrid",
        description:
          "Air-conditioned contemporary art rooms paired with quiet heritage lane strolling.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Jehangir Art Gallery", "Mumbai", 18.9276, 72.8318),
      },
    ],
    food: [
      {
        id: "bom-food-burma",
        name: "Burma Burma (Fort)",
        category: "restaurant",
        neighborhood: "Fort",
        lat: 18.9288,
        lon: 72.8331,
        cuisine: "Burmese Vegetarian",
        dietTags: ["vegetarian", "vegan"],
        estimatedCost: 1100,
        estimatedDurationMin: 65,
        crowdLevel: "moderate",
        indoorOutdoor: "indoor",
        description:
          "100% vegetarian Burmese tea room and dining spot, calm seating.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Burma Burma Fort", "Mumbai", 18.9288, 72.8331),
      },
      {
        id: "bom-food-soam",
        name: "Soam",
        category: "restaurant",
        neighborhood: "Babulnath / Chowpatty",
        lat: 18.9585,
        lon: 72.8087,
        cuisine: "Gujarati & Rajasthani Vegetarian",
        dietTags: ["vegetarian", "jain"],
        estimatedCost: 750,
        estimatedDurationMin: 55,
        crowdLevel: "moderate",
        indoorOutdoor: "indoor",
        description:
          "Clean, beloved pure-veg comfort kitchen near Marine Drive.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Soam Babulnath", "Mumbai", 18.9585, 72.8087),
      },
    ],
  },
  london: {
    geo: {
      city: "London",
      displayName: "London, United Kingdom",
      lat: 51.5074,
      lon: -0.1278,
      countryCode: "GB",
      currency: "GBP",
      currencySymbol: "£",
      source: "fallback",
    },
    activities: [
      {
        id: "lon-act-barbican",
        name: "Barbican Conservatory & Lakeside",
        category: "culture / chill",
        neighborhood: "Barbican",
        lat: 51.5202,
        lon: -0.0937,
        dietTags: [],
        estimatedCost: 0,
        estimatedDurationMin: 75,
        crowdLevel: "low",
        indoorOutdoor: "indoor",
        description:
          "Indoor brutalist rainforest oasis and calm lakeside terrace.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Barbican Conservatory", "London", 51.5202, -0.0937),
      },
      {
        id: "lon-act-regents",
        name: "Regent's Canal Towpath Walk",
        category: "walk",
        neighborhood: "Angel to Broadway Market",
        lat: 51.5335,
        lon: -0.0885,
        dietTags: [],
        estimatedCost: 0,
        estimatedDurationMin: 70,
        crowdLevel: "low",
        indoorOutdoor: "outdoor",
        description:
          "Flat waterside stroll away from Oxford Street crowds.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Regents Canal Towpath", "London", 51.5335, -0.0885),
      },
    ],
    food: [
      {
        id: "lon-food-mildreds",
        name: "Mildreds Soho / King's Cross",
        category: "restaurant",
        neighborhood: "King's Cross",
        lat: 51.5318,
        lon: -0.1255,
        cuisine: "Plant-based / Vegetarian",
        dietTags: ["vegetarian", "vegan"],
        estimatedCost: 24,
        estimatedDurationMin: 60,
        crowdLevel: "moderate",
        indoorOutdoor: "indoor",
        description: "Relaxed plant-based plates near the canal.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Mildreds Kings Cross", "London", 51.5318, -0.1255),
      },
    ],
  },
  gurgaon: {
    geo: {
      city: "Gurgaon",
      displayName: "Gurugram, Haryana, India",
      lat: 28.4595,
      lon: 77.0266,
      countryCode: "IN",
      currency: "INR",
      currencySymbol: "₹",
      source: "fallback",
    },
    activities: [
      {
        id: "ggn-act-museo",
        name: "Museo Camera (Centre for the Photographic Arts)",
        category: "museum / culture",
        neighborhood: "DLF Phase IV",
        lat: 28.4648,
        lon: 77.0819,
        address: "Shri Ganesh Mandir Marg, Sector 28, DLF Phase IV",
        dietTags: [],
        openingHours: "11:00–19:00",
        estimatedCost: 300,
        estimatedDurationMin: 75,
        crowdLevel: "low",
        indoorOutdoor: "indoor",
        description:
          "Quiet, air-conditioned contemporary photography museum & vintage camera gallery away from mall crowds.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Museo Camera", "Gurugram", 28.4648, 77.0819),
      },
      {
        id: "ggn-act-leisure",
        name: "Leisure Valley Park",
        category: "park / walk",
        neighborhood: "Sector 29",
        lat: 28.4682,
        lon: 77.0642,
        address: "NH-8 / Sector 29, Gurugram",
        dietTags: [],
        openingHours: "05:30–20:30",
        estimatedCost: 0,
        estimatedDurationMin: 55,
        crowdLevel: "low",
        indoorOutdoor: "outdoor",
        description:
          "Wide shaded jogging & rose garden loops ideal for an unhurried stroll.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Leisure Valley Park", "Gurugram", 28.4682, 77.0642),
      },
      {
        id: "ggn-act-aravalli",
        name: "Aravalli Biodiversity Park",
        category: "park / walk",
        neighborhood: "DLF Phase III / MG Road Edge",
        lat: 28.4865,
        lon: 77.1056,
        address: "Mehrauli-Gurgaon Rd, Gurugram",
        dietTags: [],
        openingHours: "06:00–18:30",
        estimatedCost: 0,
        estimatedDurationMin: 60,
        crowdLevel: "low",
        indoorOutdoor: "outdoor",
        description:
          "Restored native Aravalli forest trails with peaceful birdwatching paths.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Aravalli Biodiversity Park", "Gurugram", 28.4865, 77.1056),
      },
    ],
    food: [
      {
        id: "ggn-food-roots",
        name: "Roots — Café in the Park",
        category: "cafe",
        neighborhood: "Sector 29",
        lat: 28.4659,
        lon: 77.0677,
        address: "Rajiv Gandhi Renewable Energy Park, Sector 29",
        cuisine: "Vegetarian Cafe & Indian Breakfast",
        dietTags: ["vegetarian"],
        openingHours: "08:00–20:00",
        estimatedCost: 550,
        estimatedDurationMin: 55,
        crowdLevel: "low",
        indoorOutdoor: "hybrid",
        description:
          "Serene garden-park cafe with wooden decks, bun maska, poha, and great filter coffee right beside Leisure Valley.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Roots Cafe in the Park", "Gurugram", 28.4659, 77.0677),
      },
      {
        id: "ggn-food-greenr",
        name: "Greenr Cafe (32nd Avenue)",
        category: "restaurant",
        neighborhood: "Sector 15 Part II",
        lat: 28.4616,
        lon: 77.0504,
        address: "32nd Avenue, NH-8, Sector 15 Part II",
        cuisine: "Plant-Forward Vegetarian Cafe",
        dietTags: ["vegetarian", "vegan"],
        openingHours: "12:00–22:30",
        estimatedCost: 850,
        estimatedDurationMin: 60,
        crowdLevel: "moderate",
        indoorOutdoor: "indoor",
        description:
          "100% vegetarian/plant-based kitchen with calm indoor greenery and acoustic playlists.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Greenr Cafe 32nd Avenue", "Gurugram", 28.4616, 77.0504),
      },
      {
        id: "ggn-food-hamoni",
        name: "Hamoni: Café by the Golf Course",
        category: "cafe",
        neighborhood: "Sector 23",
        lat: 28.5067,
        lon: 77.0508,
        address: "CK Farm, Carterpuri Village, Sector 23A",
        cuisine: "Cafe & Continental Vegetarian Options",
        dietTags: ["vegetarian"],
        openingHours: "09:00–22:00",
        estimatedCost: 750,
        estimatedDurationMin: 60,
        crowdLevel: "low",
        indoorOutdoor: "hybrid",
        description:
          "Tucked-away leafy cafe overlooking a quiet driving range, far from CyberHub noise.",
        source: "curated_fallback",
        mapUrl: mapsSearchUrl("Hamoni Cafe by the Golf Course", "Gurugram", 28.5067, 77.0508),
      },
    ],
  },
};

export function inferCurrencyFromCountry(countryCode: string): {
  currency: string;
  currencySymbol: string;
} {
  const code = countryCode.toUpperCase();
  const map: Record<string, { currency: string; currencySymbol: string }> = {
    IN: { currency: "INR", currencySymbol: "₹" },
    US: { currency: "USD", currencySymbol: "$" },
    GB: { currency: "GBP", currencySymbol: "£" },
    UK: { currency: "GBP", currencySymbol: "£" },
    JP: { currency: "JPY", currencySymbol: "¥" },
    CA: { currency: "CAD", currencySymbol: "C$" },
    AU: { currency: "AUD", currencySymbol: "A$" },
    SG: { currency: "SGD", currencySymbol: "S$" },
    AE: { currency: "AED", currencySymbol: "AED " },
  };
  if (map[code]) return map[code];
  const euroCountries = new Set([
    "FR",
    "DE",
    "ES",
    "IT",
    "NL",
    "PT",
    "BE",
    "AT",
    "IE",
    "FI",
    "GR",
  ]);
  if (euroCountries.has(code)) {
    return { currency: "EUR", currencySymbol: "€" };
  }
  return { currency: "USD", currencySymbol: "$" };
}

export function getCuratedFallbackForCity(city: string): CityFallbackBundle | null {
  const normalized = city.trim().toLowerCase();
  for (const [key, bundle] of Object.entries(CURATED_CITY_FALLBACKS)) {
    if (
      normalized.includes(key) ||
      (key === "bangalore" && normalized.includes("bengaluru")) ||
      (key === "gurgaon" && normalized.includes("gurugram"))
    ) {
      return bundle;
    }
  }
  return null;
}
