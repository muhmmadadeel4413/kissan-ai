import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * get-weather
 *
 * Securely fetches live weather for a farm location using Open-Meteo.
 *
 * Security model:
 *  - Open-Meteo is a free, no-key API — no secrets needed.
 *  - The client sends only the farm's location string. This function geocodes
 *    it to lat/lon, fetches current conditions + a 7-day forecast with hourly
 *    detail, aggregates into per-day summaries, and returns normalized JSON.
 *  - verify_jwt is disabled at the platform level (anon-based app); we do a
 *    lightweight Bearer JWT sanity check here.
 *
 * Data includes soil moisture and ET0 (evapotranspiration) for irrigation
 * support — these are null if the provider doesn't return them.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Origins permitted to call this Edge Function (preflight gate). */
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://kissan-ai-rho.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "https://vxldkzrmtygurdggtjro.supabase.co",
];

function corsForOrigin(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0],
  };
}

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** Coerce a value to a finite number, falling back to 0 (never NaN). */
function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Coerce a value to a finite number or null. */
function safeNumOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

interface GeoPlace {
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  admin1?: string;
  timezone?: string;
}

/**
 * Known province/state to major city mappings for fallback geocoding.
 * When a user enters a province name, we try the major city in that province.
 */
const PROVINCE_TO_CITY: Record<string, string> = {
  // Pakistan
  punjab: "Lahore",
  sindh: "Karachi",
  "khyber pakhtunkhwa": "Peshawar",
  kpk: "Peshawar",
  balochistan: "Quetta",
  "azad kashmir": "Muzaffarabad",
  gilgit: "Gilgit",
  // India
  maharashtra: "Mumbai",
  "uttar pradesh": "Lucknow",
  "tamil nadu": "Chennai",
  karnataka: "Bangalore",
  gujarat: "Ahmedabad",
  rajasthan: "Jaipur",
  "west bengal": "Kolkata",
  bihar: "Patna",
  "madhya pradesh": "Bhopal",
  haryana: "Chandigarh",
  telangana: "Hyderabad",
  kerala: "Thiruvananthapuram",
  assam: "Guwahati",
};

/**
 * Compute Damerau-Levenshtein distance between two strings.
 * Handles insertions, deletions, substitutions, and adjacent transpositions.
 * For example: "fasialabad" vs "faisalabad" has distance 1 (transposition of 'si' and 'is').
 */
function damerauLevenshteinDistance(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const matrix: number[][] = [];
  for (let i = 0; i <= al; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= bl; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let min = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );

      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        min = Math.min(min, matrix[i - 2][j - 2] + 1);
      }

      matrix[i][j] = min;
    }
  }

  return matrix[al][bl];
}

function stringSimilarity(a: string, b: string): number {
  const s1 = a.trim().toLowerCase();
  const s2 = b.trim().toLowerCase();
  if (s1 === s2) return 1.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = damerauLevenshteinDistance(s1, s2);
  return Math.max(0, 1.0 - dist / maxLen);
}

function cleanStr(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface DistrictCoord {
  name: string;
  admin1: string;
  country: string;
  lat: number;
  lon: number;
  tz: string;
  aliases: string[];
}

/**
 * Pre-configured coordinates and aliases for major agricultural districts & cities.
 * Enables zero-latency fallback and guarantees geocoding resilience even during
 * external API outages or extreme misspellings.
 */
const KNOWN_DISTRICTS: DistrictCoord[] = [
  // Punjab
  { name: "Faisalabad", admin1: "Punjab", country: "Pakistan", lat: 31.4187, lon: 73.0791, tz: "Asia/Karachi", aliases: ["fasialabad", "faislabad", "fsd", "lyallpur", "faisal abad"] },
  { name: "Lahore", admin1: "Punjab", country: "Pakistan", lat: 31.5497, lon: 74.3436, tz: "Asia/Karachi", aliases: ["lahor", "lhr"] },
  { name: "Rawalpindi", admin1: "Punjab", country: "Pakistan", lat: 33.5651, lon: 73.0169, tz: "Asia/Karachi", aliases: ["rawalpndi", "rwp", "pindi"] },
  { name: "Islamabad", admin1: "Federal Capital", country: "Pakistan", lat: 33.6844, lon: 73.0479, tz: "Asia/Karachi", aliases: ["isb", "islam abad"] },
  { name: "Gujranwala", admin1: "Punjab", country: "Pakistan", lat: 32.1877, lon: 74.1945, tz: "Asia/Karachi", aliases: ["gujrawala", "grw"] },
  { name: "Multan", admin1: "Punjab", country: "Pakistan", lat: 30.1575, lon: 71.5249, tz: "Asia/Karachi", aliases: ["mul"] },
  { name: "Bahawalpur", admin1: "Punjab", country: "Pakistan", lat: 29.3544, lon: 71.6911, tz: "Asia/Karachi", aliases: ["bwp", "bhawalpur"] },
  { name: "Sargodha", admin1: "Punjab", country: "Pakistan", lat: 32.0836, lon: 72.6711, tz: "Asia/Karachi", aliases: ["sgd", "sargoda"] },
  { name: "Sialkot", admin1: "Punjab", country: "Pakistan", lat: 32.4945, lon: 74.5229, tz: "Asia/Karachi", aliases: ["skt"] },
  { name: "Sheikhupura", admin1: "Punjab", country: "Pakistan", lat: 31.7131, lon: 73.9783, tz: "Asia/Karachi", aliases: ["shekhupura", "sheikupura"] },
  { name: "Jhang", admin1: "Punjab", country: "Pakistan", lat: 31.2681, lon: 72.3181, tz: "Asia/Karachi", aliases: ["jhang sadr"] },
  { name: "Rahim Yar Khan", admin1: "Punjab", country: "Pakistan", lat: 28.4202, lon: 70.3013, tz: "Asia/Karachi", aliases: ["ryk", "rahimyarkhan"] },
  { name: "Kasur", admin1: "Punjab", country: "Pakistan", lat: 31.1179, lon: 74.4461, tz: "Asia/Karachi", aliases: ["qasur", "kasoor"] },
  { name: "Muzaffargarh", admin1: "Punjab", country: "Pakistan", lat: 30.0751, lon: 71.1921, tz: "Asia/Karachi", aliases: ["muzaffar garh", "mgarh"] },
  { name: "Okara", admin1: "Punjab", country: "Pakistan", lat: 30.8081, lon: 73.4458, tz: "Asia/Karachi", aliases: ["okarah"] },
  { name: "Dera Ghazi Khan", admin1: "Punjab", country: "Pakistan", lat: 30.0561, lon: 70.6348, tz: "Asia/Karachi", aliases: ["dg khan", "d.g. khan", "dgkhan"] },
  { name: "Sahiwal", admin1: "Punjab", country: "Pakistan", lat: 30.6682, lon: 73.1114, tz: "Asia/Karachi", aliases: ["montgomery"] },
  { name: "Pakpattan", admin1: "Punjab", country: "Pakistan", lat: 30.341, lon: 73.3866, tz: "Asia/Karachi", aliases: ["pak pattan"] },
  { name: "Vehari", admin1: "Punjab", country: "Pakistan", lat: 30.0419, lon: 72.3489, tz: "Asia/Karachi", aliases: ["vihari"] },
  { name: "Toba Tek Singh", admin1: "Punjab", country: "Pakistan", lat: 30.9743, lon: 72.4828, tz: "Asia/Karachi", aliases: ["tts", "toba"] },
  { name: "Chiniot", admin1: "Punjab", country: "Pakistan", lat: 31.72, lon: 72.9789, tz: "Asia/Karachi", aliases: ["chiniyot", "cheniot"] },
  { name: "Khanewal", admin1: "Punjab", country: "Pakistan", lat: 30.3017, lon: 71.9321, tz: "Asia/Karachi", aliases: [] },
  { name: "Hafizabad", admin1: "Punjab", country: "Pakistan", lat: 32.0679, lon: 73.6854, tz: "Asia/Karachi", aliases: ["hafiz abad"] },
  { name: "Mandi Bahauddin", admin1: "Punjab", country: "Pakistan", lat: 32.587, lon: 73.4912, tz: "Asia/Karachi", aliases: ["mbdin"] },
  { name: "Lodhran", admin1: "Punjab", country: "Pakistan", lat: 29.5405, lon: 71.6336, tz: "Asia/Karachi", aliases: [] },
  { name: "Khushab", admin1: "Punjab", country: "Pakistan", lat: 32.2955, lon: 72.3525, tz: "Asia/Karachi", aliases: ["jauharabad"] },
  { name: "Bhakkar", admin1: "Punjab", country: "Pakistan", lat: 31.6253, lon: 71.0657, tz: "Asia/Karachi", aliases: ["bhakar"] },
  { name: "Layyah", admin1: "Punjab", country: "Pakistan", lat: 30.9613, lon: 70.9424, tz: "Asia/Karachi", aliases: ["leiah"] },
  { name: "Mianwali", admin1: "Punjab", country: "Pakistan", lat: 32.5853, lon: 71.5436, tz: "Asia/Karachi", aliases: ["mian wali"] },
  { name: "Attock", admin1: "Punjab", country: "Pakistan", lat: 33.7667, lon: 72.3667, tz: "Asia/Karachi", aliases: ["campbellpur"] },
  { name: "Chakwal", admin1: "Punjab", country: "Pakistan", lat: 32.9328, lon: 72.8553, tz: "Asia/Karachi", aliases: [] },
  { name: "Jhelum", admin1: "Punjab", country: "Pakistan", lat: 32.9344, lon: 73.7264, tz: "Asia/Karachi", aliases: ["jehlum"] },
  { name: "Nankana Sahib", admin1: "Punjab", country: "Pakistan", lat: 31.4492, lon: 73.7125, tz: "Asia/Karachi", aliases: ["nankana"] },
  { name: "Narowal", admin1: "Punjab", country: "Pakistan", lat: 32.102, lon: 74.873, tz: "Asia/Karachi", aliases: [] },
  { name: "Gujrat", admin1: "Punjab", country: "Pakistan", lat: 32.5742, lon: 74.0754, tz: "Asia/Karachi", aliases: [] },
  { name: "Rajanpur", admin1: "Punjab", country: "Pakistan", lat: 29.1035, lon: 70.325, tz: "Asia/Karachi", aliases: ["rajan pur"] },
  { name: "Bahawalnagar", admin1: "Punjab", country: "Pakistan", lat: 29.9987, lon: 73.2536, tz: "Asia/Karachi", aliases: ["bahawal nagar"] },

  // Sindh
  { name: "Karachi", admin1: "Sindh", country: "Pakistan", lat: 24.8607, lon: 67.0011, tz: "Asia/Karachi", aliases: ["khi"] },
  { name: "Hyderabad", admin1: "Sindh", country: "Pakistan", lat: 25.396, lon: 68.3578, tz: "Asia/Karachi", aliases: ["hyd"] },
  { name: "Sukkur", admin1: "Sindh", country: "Pakistan", lat: 27.7052, lon: 68.8574, tz: "Asia/Karachi", aliases: ["sakhar"] },
  { name: "Larkana", admin1: "Sindh", country: "Pakistan", lat: 27.559, lon: 68.212, tz: "Asia/Karachi", aliases: ["larkano"] },
  { name: "Nawabshah", admin1: "Sindh", country: "Pakistan", lat: 26.2483, lon: 68.4096, tz: "Asia/Karachi", aliases: ["shaheed benazirabad", "sba"] },
  { name: "Mirpur Khas", admin1: "Sindh", country: "Pakistan", lat: 25.5276, lon: 69.0159, tz: "Asia/Karachi", aliases: ["mirpurkhas"] },
  { name: "Jacobabad", admin1: "Sindh", country: "Pakistan", lat: 28.281, lon: 68.4375, tz: "Asia/Karachi", aliases: ["jacob abad"] },
  { name: "Badin", admin1: "Sindh", country: "Pakistan", lat: 24.656, lon: 68.837, tz: "Asia/Karachi", aliases: [] },
  { name: "Khairpur", admin1: "Sindh", country: "Pakistan", lat: 27.5295, lon: 68.7592, tz: "Asia/Karachi", aliases: ["khairpur mirs"] },

  // KPK
  { name: "Peshawar", admin1: "Khyber Pakhtunkhwa", country: "Pakistan", lat: 34.0151, lon: 71.5249, tz: "Asia/Karachi", aliases: ["pesh"] },
  { name: "Mardan", admin1: "Khyber Pakhtunkhwa", country: "Pakistan", lat: 34.1989, lon: 72.045, tz: "Asia/Karachi", aliases: [] },
  { name: "Abbottabad", admin1: "Khyber Pakhtunkhwa", country: "Pakistan", lat: 34.1688, lon: 73.2215, tz: "Asia/Karachi", aliases: ["abotabad"] },
  { name: "Swat", admin1: "Khyber Pakhtunkhwa", country: "Pakistan", lat: 35.2227, lon: 72.4258, tz: "Asia/Karachi", aliases: ["mingora", "saidu sharif"] },
  { name: "Dera Ismail Khan", admin1: "Khyber Pakhtunkhwa", country: "Pakistan", lat: 31.8314, lon: 70.9019, tz: "Asia/Karachi", aliases: ["di khan", "d.i. khan", "dikhan"] },

  // Balochistan
  { name: "Quetta", admin1: "Balochistan", country: "Pakistan", lat: 30.1798, lon: 66.975, tz: "Asia/Karachi", aliases: ["quet"] },
  { name: "Turbat", admin1: "Balochistan", country: "Pakistan", lat: 26.0031, lon: 63.0544, tz: "Asia/Karachi", aliases: ["kech"] },
  { name: "Gwadar", admin1: "Balochistan", country: "Pakistan", lat: 25.1216, lon: 62.3254, tz: "Asia/Karachi", aliases: [] },

  // AJK & GB
  { name: "Muzaffarabad", admin1: "Azad Kashmir", country: "Pakistan", lat: 34.3705, lon: 73.4711, tz: "Asia/Karachi", aliases: ["muzafarabad"] },
  { name: "Mirpur", admin1: "Azad Kashmir", country: "Pakistan", lat: 33.1478, lon: 73.7519, tz: "Asia/Karachi", aliases: ["mirpur ajk"] },
  { name: "Gilgit", admin1: "Gilgit-Baltistan", country: "Pakistan", lat: 35.9221, lon: 74.3087, tz: "Asia/Karachi", aliases: [] },
  { name: "Skardu", admin1: "Gilgit-Baltistan", country: "Pakistan", lat: 35.2971, lon: 75.6333, tz: "Asia/Karachi", aliases: [] },
];

/**
 * Find pre-configured district entry by fuzzy matching against name or aliases.
 */
function matchKnownDistrict(query: string): DistrictCoord | null {
  const clean = cleanStr(query);
  if (!clean) return null;

  // 1. Exact name or alias
  for (const d of KNOWN_DISTRICTS) {
    if (cleanStr(d.name) === clean) return d;
    for (const a of d.aliases) {
      if (cleanStr(a) === clean) return d;
    }
  }

  // 2. Token match (e.g. "Chak 123, Fasialabad")
  const tokens = clean.split(" ").filter((t) => t.length > 2);
  for (const d of KNOWN_DISTRICTS) {
    const dClean = cleanStr(d.name);
    if (tokens.includes(dClean) || clean.includes(dClean)) return d;
    for (const a of d.aliases) {
      const aClean = cleanStr(a);
      if (tokens.includes(aClean) || clean.includes(aClean)) return d;
    }
  }

  // 3. Fuzzy matching on whole string
  let best: DistrictCoord | null = null;
  let highest = 0;

  for (const d of KNOWN_DISTRICTS) {
    const score = stringSimilarity(clean, cleanStr(d.name));
    if (score > highest) {
      highest = score;
      best = d;
    }
    for (const a of d.aliases) {
      const aScore = stringSimilarity(clean, cleanStr(a));
      if (aScore > highest) {
        highest = aScore;
        best = d;
      }
    }
  }

  if (best && highest >= 0.72) return best;

  // 4. Token-level fuzzy match for composite addresses
  if (tokens.length > 1) {
    let tBest: DistrictCoord | null = null;
    let tHigh = 0;
    for (const t of tokens) {
      if (t.length < 4) continue;
      for (const d of KNOWN_DISTRICTS) {
        const score = stringSimilarity(t, cleanStr(d.name));
        if (score > tHigh) {
          tHigh = score;
          tBest = d;
        }
      }
    }
    if (tBest && tHigh >= 0.75) return tBest;
  }

  return null;
}

/**
 * Build progressively-simplified search queries for a free-text location.
 */
function locationCandidates(raw: string): string[] {
  const clean = raw.trim().replace(/\s+/g, " ");
  if (!clean) return [];

  const candidates: string[] = [];
  const seen = new Set<string>();
  const push = (q: string) => {
    const t = q.trim().replace(/\s+/g, " ");
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      candidates.push(t);
    }
  };

  // 0. Fuzzy-resolved known district first (e.g. "Fasialabad" -> "Faisalabad")
  const districtMatch = matchKnownDistrict(clean);
  if (districtMatch) {
    push(districtMatch.name);
    push(`${districtMatch.name}, ${districtMatch.admin1}`);
    push(`${districtMatch.name}, Pakistan`);
  }

  push(clean); // exact match

  // Comma-separated parts, longest first (e.g. "Faisalabad, Punjab, Pakistan").
  const parts = clean
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  [...parts]
    .sort((a, b) => b.length - a.length)
    .forEach(push);

  // Token reductions: first two tokens, then first token, then last token.
  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length > 2) push(tokens.slice(0, 2).join(" "));
  if (tokens.length > 1) {
    push(tokens[0]);
    push(tokens[tokens.length - 1]);
  }

  // Remove common suffixes like "province", "state", "district".
  const withoutSuffix = clean.replace(/\s*(province|state|district|division|tehsil)$/i, "").trim();
  if (withoutSuffix && withoutSuffix !== clean) {
    push(withoutSuffix);
  }

  // Province/state to major city fallback.
  const lowerClean = clean.toLowerCase();
  for (const [province, city] of Object.entries(PROVINCE_TO_CITY)) {
    if (lowerClean.includes(province) || province.includes(lowerClean)) {
      push(city);
      push(`${city}, Pakistan`);
      push(`${city}, India`);
      break;
    }
  }

  // Country hints as a last resort, unless the query already mentions one.
  const hasCountry = /pakistan|india|bangladesh|\bPK\b|\bIN\b|\bBD\b|,\s*[A-Z]{2}$/i.test(clean);
  if (!hasCountry) {
    for (const q of [...candidates]) {
      push(`${q}, Pakistan`);
      push(`${q}, India`);
    }
  }

  return candidates;
}

/**
 * Geocode a free-text location using Open-Meteo Geocoding API with multi-tier fallback:
 * 1. Open-Meteo API with candidate queries
 * 2. Pre-configured district database coordinates
 * 3. OpenStreetMap Nominatim geocoding
 */
async function geocodeLocation(query: string): Promise<GeoPlace | null> {
  const candidates = locationCandidates(query);

  // Tier 1: Open-Meteo Geocoding API
  for (const candidate of candidates) {
    try {
      const resp = await fetch(
        `${GEO_URL}?name=${encodeURIComponent(candidate)}&count=5&language=en&format=json`
      );
      if (!resp.ok) continue;
      const data = (await resp.json()) as { results?: GeoPlace[] };
      const list = data.results;
      if (!Array.isArray(list) || list.length === 0) continue;

      const lowerQuery = candidate.toLowerCase();
      const match =
        list.find((p) => {
          const name = (p.name ?? "").toLowerCase();
          return name === lowerQuery || name.includes(lowerQuery) || lowerQuery.includes(name);
        }) ?? list[0];
      return match;
    } catch {
      // Try next candidate
    }
  }

  // Tier 2: Check pre-configured coordinates if Open-Meteo returned no results
  const district = matchKnownDistrict(query);
  if (district) {
    console.log(`get-weather: resolved "${query}" to pre-configured ${district.name} (${district.lat}, ${district.lon})`);
    return {
      name: district.name,
      admin1: district.admin1,
      country: district.country,
      latitude: district.lat,
      longitude: district.lon,
      timezone: district.tz,
    };
  }

  // Tier 3: OpenStreetMap Nominatim fallback
  try {
    const osmResp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { "User-Agent": "KissanAI/1.0" } }
    );
    if (osmResp.ok) {
      const osmList = await osmResp.json();
      if (Array.isArray(osmList) && osmList.length > 0) {
        const item = osmList[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
          return {
            name: item.display_name?.split(",")?.[0] ?? query,
            country: "Pakistan",
            latitude: lat,
            longitude: lon,
            timezone: "auto",
          };
        }
      }
    }
  } catch {
    // Fallback completed
  }

  return null;
}

/**
 * Map WMO weather code to the condition codes used by the Kissan AI UI.
 * WMO codes: https://open-meteo.com/en/docs (Weather interpretation section)
 */
function wmoToConditionCode(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Clouds";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain";
  if (code === 85 || code === 86) return "Snow";
  if (code >= 95) return "Thunderstorm";
  return "Clouds";
}

/**
 * Map WMO weather code to a human-readable description.
 */
function wmoToDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return descriptions[code] ?? "Conditions";
}

interface DayAcc {
  date: string;
  max: number;
  min: number;
  pop: number;
  wind: number;
  humiditySum: number;
  humidityCount: number;
  rainSum: number;
  et0Sum: number;
  et0Count: number;
  soilMoistureSum: number;
  soilMoistureCount: number;
  condition: string;
  conditionCode: string;
  middayCode: number;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsForOrigin(req) });
  }

  // Lightweight JWT sanity check (anon-based app).
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ") || auth.split(".").length !== 3) {
    return json(
      { success: false, error: "This request is not authorized. Please try again." },
      401
    );
  }

  let body: { location?: string };
  try {
    body = await req.json();
  } catch {
    return json(
      { success: false, error: "We couldn't read your request. Please try again." },
      400
    );
  }

  const location = (body?.location ?? "").trim();
  if (!location) {
    return json(
      { success: false, error: "No farm location was provided. Please add one on your farm profile." },
      400
    );
  }

  // 1) Geocode the farm location string -> lat/lon.
  const place = await geocodeLocation(location);
  if (
    !place ||
    typeof place.latitude !== "number" ||
    typeof place.longitude !== "number"
  ) {
    console.log("get-weather: no geocode match for", JSON.stringify(location));
    return json(
      {
        success: false,
        error: `We couldn't find "${location}" on the map. Please check the location saved on your farm profile.`,
      },
      404
    );
  }

  const lat = place.latitude;
  const lon = place.longitude;
  const tz = place.timezone ?? "auto";

  // 2) Fetch forecast with hourly + daily data from Open-Meteo.
  //    Includes soil moisture and ET0 for irrigation support.
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: tz,
    // Current weather variables
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "rain",
      "weather_code",
      "wind_speed_10m",
    ].join(","),
    // Hourly variables for aggregation
    hourly: [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation_probability",
      "precipitation",
      "rain",
      "weather_code",
      "wind_speed_10m",
      "soil_moisture_0_to_1cm",
      "et0_fao_evapotranspiration",
    ].join(","),
    // Daily variables
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "rain_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "et0_fao_evapotranspiration",
    ].join(","),
    forecast_days: "7",
  });

  let forecastRaw: any;
  try {
    const resp = await fetch(`${FORECAST_URL}?${params}`);
    if (!resp.ok) {
      console.error("get-weather: Open-Meteo API error", resp.status);
      return json(
        { success: false, error: "We couldn't load the weather. Please try again." },
        502
      );
    }
    forecastRaw = await resp.json();
  } catch (err) {
    console.error("get-weather: network error", err);
    return json(
      { success: false, error: "We couldn't load the weather. Please try again." },
      502
    );
  }

  // 3) Extract current conditions from the response.
  const current = forecastRaw?.current;
  if (!current) {
    return json(
      { success: false, error: "We couldn't load the current weather. Please try again." },
      502
    );
  }

  const currentCode = safeNum(current.weather_code);
  const todayPrecipProb = safeNum(
    forecastRaw?.daily?.precipitation_probability_max?.[0]
  );

  const currentWeather = {
    temperature: Math.round(safeNum(current.temperature_2m)),
    feelsLike: Math.round(safeNum(current.apparent_temperature) || safeNum(current.temperature_2m)),
    humidity: Math.round(safeNum(current.relative_humidity_2m)),
    rainProbability: Math.round(todayPrecipProb),
    windSpeed: Math.round(safeNum(current.wind_speed_10m)),
    condition: wmoToDescription(currentCode),
    conditionCode: wmoToConditionCode(currentCode),
    capturedAt: current.time ?? new Date().toISOString(),
  };

  // 4) Aggregate hourly data into per-day summaries.
  const hourly = forecastRaw?.hourly;
  const daily = forecastRaw?.daily;

  const forecast: Array<{
    date: string;
    condition: string;
    conditionCode: string;
    temperatureMax: number;
    temperatureMin: number;
    rainProbability: number;
    windSpeed: number;
    humidity: number;
    precipitation: number;
    rain: number;
    soilMoisture: number | null;
    et0: number | null;
  }> = [];

  // Use daily data if available (more accurate aggregates)
  if (daily && Array.isArray(daily.time)) {
    for (let i = 0; i < daily.time.length; i++) {
      const code = safeNum(daily.weather_code?.[i]);
      forecast.push({
        date: daily.time[i],
        condition: wmoToDescription(code),
        conditionCode: wmoToConditionCode(code),
        temperatureMax: Math.round(safeNum(daily.temperature_2m_max?.[i])),
        temperatureMin: Math.round(safeNum(daily.temperature_2m_min?.[i])),
        rainProbability: Math.round(safeNum(daily.precipitation_probability_max?.[i])),
        windSpeed: Math.round(safeNum(daily.wind_speed_10m_max?.[i])),
        humidity: 0, // Will be filled from hourly if needed
        precipitation: safeNum(daily.precipitation_sum?.[i]),
        rain: safeNum(daily.rain_sum?.[i]),
        soilMoisture: null, // Soil moisture is hourly-only
        et0: safeNumOrNull(daily.et0_fao_evapotranspiration?.[i]),
      });
    }
  }

  // Fill humidity from hourly data and compute average soil moisture per day
  if (hourly && Array.isArray(hourly.time)) {
    const dayMap = new Map<string, {
      humiditySum: number;
      humidityCount: number;
      soilMoistureSum: number;
      soilMoistureCount: number;
    }>();

    for (let i = 0; i < hourly.time.length; i++) {
      const date = hourly.time[i].slice(0, 10);
      const acc = dayMap.get(date) ?? {
        humiditySum: 0,
        humidityCount: 0,
        soilMoistureSum: 0,
        soilMoistureCount: 0,
      };
      const hum = safeNumOrNull(hourly.relative_humidity_2m?.[i]);
      if (hum !== null) {
        acc.humiditySum += hum;
        acc.humidityCount += 1;
      }
      const sm = safeNumOrNull(hourly.soil_moisture_0_to_1cm?.[i]);
      if (sm !== null) {
        acc.soilMoistureSum += sm;
        acc.soilMoistureCount += 1;
      }
      dayMap.set(date, acc);
    }

    for (const day of forecast) {
      const acc = dayMap.get(day.date);
      if (acc) {
        day.humidity = acc.humidityCount > 0
          ? Math.round(acc.humiditySum / acc.humidityCount)
          : 0;
        day.soilMoisture = acc.soilMoistureCount > 0
          ? Math.round((acc.soilMoistureSum / acc.soilMoistureCount) * 100) / 100
          : null;
      }
    }
  }

  // Limit to 5 days for the forecast strip (UI expects 5)
  const forecastLimited = forecast.slice(0, 5);

  // 5) Build the response payload.
  const weather = {
    current: currentWeather,
    forecast: forecastLimited,
    location: {
      name: place.name ?? location,
      country: place.country ?? "",
    },
  };

  return json({ success: true, weather });
});
