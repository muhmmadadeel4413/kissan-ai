/**
 * Smart Location Matcher & Fuzzy Resolver
 *
 * Provides resilient, scalable location resolution for agricultural applications.
 * Handles typos (e.g. "Fasialabad" -> "Faisalabad"), transliteration variations,
 * common abbreviations ("Fsd", "Lhr", "Isb", "Rwp"), and composite strings
 * ("Chak 123, Fasialabad").
 */

export interface LocationEntry {
  name: string;
  admin1: string; // Province / State
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  aliases: string[];
}

export interface ResolvedLocation {
  name: string;
  admin1: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  query: string;
  matchedName: string;
  confidence: number;
  formatted: string;
}

export interface LocationSuggestion {
  name: string;
  admin1: string;
  country: string;
  formatted: string;
  latitude: number;
  longitude: number;
}

/**
 * Comprehensive database of all Pakistan districts, divisions, and major
 * agricultural hubs, plus major regional agricultural centers.
 */
export const KNOWN_LOCATIONS: LocationEntry[] = [
  // --- Punjab, Pakistan ---
  {
    name: "Faisalabad",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 31.4187,
    longitude: 73.0791,
    timezone: "Asia/Karachi",
    aliases: ["fasialabad", "faislabad", "fsd", "lyallpur", "faisal abad", "faislabad district"],
  },
  {
    name: "Lahore",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 31.5497,
    longitude: 74.3436,
    timezone: "Asia/Karachi",
    aliases: ["lahor", "lhr", "lahore cantt"],
  },
  {
    name: "Rawalpindi",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 33.5651,
    longitude: 73.0169,
    timezone: "Asia/Karachi",
    aliases: ["rawalpndi", "rwp", "pindi"],
  },
  {
    name: "Islamabad",
    admin1: "Federal Capital",
    country: "Pakistan",
    latitude: 33.6844,
    longitude: 73.0479,
    timezone: "Asia/Karachi",
    aliases: ["isb", "islam abad"],
  },
  {
    name: "Gujranwala",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 32.1877,
    longitude: 74.1945,
    timezone: "Asia/Karachi",
    aliases: ["gujrawala", "grw", "gujranwala cantt"],
  },
  {
    name: "Multan",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 30.1575,
    longitude: 71.5249,
    timezone: "Asia/Karachi",
    aliases: ["mul", "multan cantt"],
  },
  {
    name: "Bahawalpur",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 29.3544,
    longitude: 71.6911,
    timezone: "Asia/Karachi",
    aliases: ["bwp", "bhawalpur", "bahawlpur"],
  },
  {
    name: "Sargodha",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 32.0836,
    longitude: 72.6711,
    timezone: "Asia/Karachi",
    aliases: ["sgd", "sargoda"],
  },
  {
    name: "Sialkot",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 32.4945,
    longitude: 74.5229,
    timezone: "Asia/Karachi",
    aliases: ["skt", "sealkot"],
  },
  {
    name: "Sheikhupura",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 31.7131,
    longitude: 73.9783,
    timezone: "Asia/Karachi",
    aliases: ["shekhupura", "sheikupura", "shikupura", "sheikhupura district"],
  },
  {
    name: "Jhang",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 31.2681,
    longitude: 72.3181,
    timezone: "Asia/Karachi",
    aliases: ["jhang sadr", "jhang maghiana"],
  },
  {
    name: "Rahim Yar Khan",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 28.4202,
    longitude: 70.3013,
    timezone: "Asia/Karachi",
    aliases: ["ryk", "rahimyarkhan", "rahim yar kahn"],
  },
  {
    name: "Kasur",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 31.1179,
    longitude: 74.4461,
    timezone: "Asia/Karachi",
    aliases: ["qasur", "kasoor"],
  },
  {
    name: "Muzaffargarh",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 30.0751,
    longitude: 71.1921,
    timezone: "Asia/Karachi",
    aliases: ["muzaffar garh", "mgarh", "muzaffargarh district"],
  },
  {
    name: "Okara",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 30.8081,
    longitude: 73.4458,
    timezone: "Asia/Karachi",
    aliases: ["okarah", "okara cantt"],
  },
  {
    name: "Dera Ghazi Khan",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 30.0561,
    longitude: 70.6348,
    timezone: "Asia/Karachi",
    aliases: ["dg khan", "d.g. khan", "dgkhan", "dera ghazi kahn"],
  },
  {
    name: "Sahiwal",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 30.6682,
    longitude: 73.1114,
    timezone: "Asia/Karachi",
    aliases: ["montgomery", "sahiwal district"],
  },
  {
    name: "Pakpattan",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 30.341,
    longitude: 73.3866,
    timezone: "Asia/Karachi",
    aliases: ["pak pattan", "pakpattan sharif"],
  },
  {
    name: "Vehari",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 30.0419,
    longitude: 72.3489,
    timezone: "Asia/Karachi",
    aliases: ["vihari", "vehari district"],
  },
  {
    name: "Toba Tek Singh",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 30.9743,
    longitude: 72.4828,
    timezone: "Asia/Karachi",
    aliases: ["tts", "toba", "toba tek sing"],
  },
  {
    name: "Chiniot",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 31.72,
    longitude: 72.9789,
    timezone: "Asia/Karachi",
    aliases: ["chiniyot", "cheniot"],
  },
  {
    name: "Khanewal",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 30.3017,
    longitude: 71.9321,
    timezone: "Asia/Karachi",
    aliases: ["khanewal district"],
  },
  {
    name: "Hafizabad",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 32.0679,
    longitude: 73.6854,
    timezone: "Asia/Karachi",
    aliases: ["hafiz abad"],
  },
  {
    name: "Mandi Bahauddin",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 32.587,
    longitude: 73.4912,
    timezone: "Asia/Karachi",
    aliases: ["mbdin", "mandi baha ud din", "mandi bahaodin"],
  },
  {
    name: "Lodhran",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 29.5405,
    longitude: 71.6336,
    timezone: "Asia/Karachi",
    aliases: ["lodhran district"],
  },
  {
    name: "Khushab",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 32.2955,
    longitude: 72.3525,
    timezone: "Asia/Karachi",
    aliases: ["jauharabad", "khushab district"],
  },
  {
    name: "Bhakkar",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 31.6253,
    longitude: 71.0657,
    timezone: "Asia/Karachi",
    aliases: ["bhakar"],
  },
  {
    name: "Layyah",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 30.9613,
    longitude: 70.9424,
    timezone: "Asia/Karachi",
    aliases: ["leiah", "layyah district"],
  },
  {
    name: "Mianwali",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 32.5853,
    longitude: 71.5436,
    timezone: "Asia/Karachi",
    aliases: ["mian wali"],
  },
  {
    name: "Attock",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 33.7667,
    longitude: 72.3667,
    timezone: "Asia/Karachi",
    aliases: ["campbellpur", "attock city"],
  },
  {
    name: "Chakwal",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 32.9328,
    longitude: 72.8553,
    timezone: "Asia/Karachi",
    aliases: ["chakwal district"],
  },
  {
    name: "Jhelum",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 32.9344,
    longitude: 73.7264,
    timezone: "Asia/Karachi",
    aliases: ["jehlum"],
  },
  {
    name: "Nankana Sahib",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 31.4492,
    longitude: 73.7125,
    timezone: "Asia/Karachi",
    aliases: ["nankana", "nankana sahib district"],
  },
  {
    name: "Narowal",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 32.102,
    longitude: 74.873,
    timezone: "Asia/Karachi",
    aliases: ["narowal district"],
  },
  {
    name: "Gujrat",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 32.5742,
    longitude: 74.0754,
    timezone: "Asia/Karachi",
    aliases: ["gujrat city", "gujrat punjab"],
  },
  {
    name: "Rajanpur",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 29.1035,
    longitude: 70.325,
    timezone: "Asia/Karachi",
    aliases: ["rajan pur"],
  },
  {
    name: "Bahawalnagar",
    admin1: "Punjab",
    country: "Pakistan",
    latitude: 29.9987,
    longitude: 73.2536,
    timezone: "Asia/Karachi",
    aliases: ["bahawal nagar"],
  },

  // --- Sindh, Pakistan ---
  {
    name: "Karachi",
    admin1: "Sindh",
    country: "Pakistan",
    latitude: 24.8607,
    longitude: 67.0011,
    timezone: "Asia/Karachi",
    aliases: ["khi", "karachi city"],
  },
  {
    name: "Hyderabad",
    admin1: "Sindh",
    country: "Pakistan",
    latitude: 25.396,
    longitude: 68.3578,
    timezone: "Asia/Karachi",
    aliases: ["hyd", "hyderabad sindh"],
  },
  {
    name: "Sukkur",
    admin1: "Sindh",
    country: "Pakistan",
    latitude: 27.7052,
    longitude: 68.8574,
    timezone: "Asia/Karachi",
    aliases: ["sakhar", "sukkar"],
  },
  {
    name: "Larkana",
    admin1: "Sindh",
    country: "Pakistan",
    latitude: 27.559,
    longitude: 68.212,
    timezone: "Asia/Karachi",
    aliases: ["larkano", "larkana district"],
  },
  {
    name: "Nawabshah",
    admin1: "Sindh",
    country: "Pakistan",
    latitude: 26.2483,
    longitude: 68.4096,
    timezone: "Asia/Karachi",
    aliases: ["shaheed benazirabad", "sba", "nawab shah"],
  },
  {
    name: "Mirpur Khas",
    admin1: "Sindh",
    country: "Pakistan",
    latitude: 25.5276,
    longitude: 69.0159,
    timezone: "Asia/Karachi",
    aliases: ["mirpurkhas", "mirpur khas district"],
  },
  {
    name: "Jacobabad",
    admin1: "Sindh",
    country: "Pakistan",
    latitude: 28.281,
    longitude: 68.4375,
    timezone: "Asia/Karachi",
    aliases: ["jacob abad"],
  },
  {
    name: "Shikarpur",
    admin1: "Sindh",
    country: "Pakistan",
    latitude: 27.9571,
    longitude: 68.6383,
    timezone: "Asia/Karachi",
    aliases: ["shikar pur"],
  },
  {
    name: "Badin",
    admin1: "Sindh",
    country: "Pakistan",
    latitude: 24.656,
    longitude: 68.837,
    timezone: "Asia/Karachi",
    aliases: ["badin district"],
  },
  {
    name: "Thatta",
    admin1: "Sindh",
    country: "Pakistan",
    latitude: 24.7475,
    longitude: 67.9236,
    timezone: "Asia/Karachi",
    aliases: ["thatto"],
  },
  {
    name: "Khairpur",
    admin1: "Sindh",
    country: "Pakistan",
    latitude: 27.5295,
    longitude: 68.7592,
    timezone: "Asia/Karachi",
    aliases: ["khairpur mirs", "khairpur district"],
  },
  {
    name: "Ghotki",
    admin1: "Sindh",
    country: "Pakistan",
    latitude: 28.006,
    longitude: 69.3161,
    timezone: "Asia/Karachi",
    aliases: ["ghotki district"],
  },
  {
    name: "Sanghar",
    admin1: "Sindh",
    country: "Pakistan",
    latitude: 26.0466,
    longitude: 68.9481,
    timezone: "Asia/Karachi",
    aliases: ["sanghar district"],
  },

  // --- Khyber Pakhtunkhwa, Pakistan ---
  {
    name: "Peshawar",
    admin1: "Khyber Pakhtunkhwa",
    country: "Pakistan",
    latitude: 34.0151,
    longitude: 71.5249,
    timezone: "Asia/Karachi",
    aliases: ["pesh", "peshawer"],
  },
  {
    name: "Mardan",
    admin1: "Khyber Pakhtunkhwa",
    country: "Pakistan",
    latitude: 34.1989,
    longitude: 72.045,
    timezone: "Asia/Karachi",
    aliases: ["mardan city"],
  },
  {
    name: "Abbottabad",
    admin1: "Khyber Pakhtunkhwa",
    country: "Pakistan",
    latitude: 34.1688,
    longitude: 73.2215,
    timezone: "Asia/Karachi",
    aliases: ["abotabad", "abbotabad"],
  },
  {
    name: "Swat",
    admin1: "Khyber Pakhtunkhwa",
    country: "Pakistan",
    latitude: 35.2227,
    longitude: 72.4258,
    timezone: "Asia/Karachi",
    aliases: ["mingora", "saidu sharif", "swat valley"],
  },
  {
    name: "Dera Ismail Khan",
    admin1: "Khyber Pakhtunkhwa",
    country: "Pakistan",
    latitude: 31.8314,
    longitude: 70.9019,
    timezone: "Asia/Karachi",
    aliases: ["di khan", "d.i. khan", "dikhan"],
  },
  {
    name: "Mansehra",
    admin1: "Khyber Pakhtunkhwa",
    country: "Pakistan",
    latitude: 34.3333,
    longitude: 73.2,
    timezone: "Asia/Karachi",
    aliases: ["manshera"],
  },
  {
    name: "Kohat",
    admin1: "Khyber Pakhtunkhwa",
    country: "Pakistan",
    latitude: 33.5869,
    longitude: 71.4414,
    timezone: "Asia/Karachi",
    aliases: ["kohat cantt"],
  },

  // --- Balochistan, Pakistan ---
  {
    name: "Quetta",
    admin1: "Balochistan",
    country: "Pakistan",
    latitude: 30.1798,
    longitude: 66.975,
    timezone: "Asia/Karachi",
    aliases: ["quet", "kwetta"],
  },
  {
    name: "Turbat",
    admin1: "Balochistan",
    country: "Pakistan",
    latitude: 26.0031,
    longitude: 63.0544,
    timezone: "Asia/Karachi",
    aliases: ["kech", "turbat district"],
  },
  {
    name: "Gwadar",
    admin1: "Balochistan",
    country: "Pakistan",
    latitude: 25.1216,
    longitude: 62.3254,
    timezone: "Asia/Karachi",
    aliases: ["gwader"],
  },

  // --- Azad Kashmir & Gilgit-Baltistan ---
  {
    name: "Muzaffarabad",
    admin1: "Azad Kashmir",
    country: "Pakistan",
    latitude: 34.3705,
    longitude: 73.4711,
    timezone: "Asia/Karachi",
    aliases: ["muzafarabad", "ajk muzaffarabad"],
  },
  {
    name: "Mirpur",
    admin1: "Azad Kashmir",
    country: "Pakistan",
    latitude: 33.1478,
    longitude: 73.7519,
    timezone: "Asia/Karachi",
    aliases: ["mirpur ajk", "mirpur kashmir"],
  },
  {
    name: "Gilgit",
    admin1: "Gilgit-Baltistan",
    country: "Pakistan",
    latitude: 35.9221,
    longitude: 74.3087,
    timezone: "Asia/Karachi",
    aliases: ["gilgit city"],
  },
  {
    name: "Skardu",
    admin1: "Gilgit-Baltistan",
    country: "Pakistan",
    latitude: 35.2971,
    longitude: 75.6333,
    timezone: "Asia/Karachi",
    aliases: ["skardo"],
  },
];

/**
 * Compute Damerau-Levenshtein distance between two strings.
 * Handles insertions, deletions, substitutions, and adjacent transpositions.
 * For example: "fasialabad" vs "faisalabad" has distance 1 (transposition of 'si' and 'is').
 */
export function damerauLevenshteinDistance(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  // 2D distance matrix
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
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );

      // Transposition
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

/**
 * Normalized similarity score (0.0 to 1.0).
 */
export function stringSimilarity(a: string, b: string): number {
  const s1 = a.trim().toLowerCase();
  const s2 = b.trim().toLowerCase();
  if (s1 === s2) return 1.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = damerauLevenshteinDistance(s1, s2);
  return Math.max(0, 1.0 - dist / maxLen);
}

/** Clean and strip punctuation from a query string */
function cleanQuery(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve any free-text location string to a verified location.
 *
 * Employs a multi-stage heuristic:
 * 1. Exact alias / name match
 * 2. Substring & token containment
 * 3. Damerau-Levenshtein fuzzy matching (catches "Fasialabad" -> "Faisalabad")
 * 4. Token-level fuzzy matching for composite inputs like "Chak 45, Fasialabad"
 */
export function resolveLocation(rawQuery: string): ResolvedLocation | null {
  const clean = cleanQuery(rawQuery);
  if (!clean) return null;

  // 1. Exact match against canonical name or aliases
  for (const loc of KNOWN_LOCATIONS) {
    const locNameClean = cleanQuery(loc.name);
    if (clean === locNameClean) {
      return buildResolved(loc, rawQuery, 1.0);
    }
    for (const alias of loc.aliases) {
      if (clean === cleanQuery(alias)) {
        return buildResolved(loc, rawQuery, 0.98);
      }
    }
  }

  // 2. Token containment (e.g. "Faisalabad, Punjab" or "Faisalabad Pakistan")
  const tokens = clean.split(" ").filter((t) => t.length > 2);
  for (const loc of KNOWN_LOCATIONS) {
    const locNameClean = cleanQuery(loc.name);
    if (tokens.includes(locNameClean) || clean.includes(locNameClean)) {
      return buildResolved(loc, rawQuery, 0.95);
    }
    for (const alias of loc.aliases) {
      const aliasClean = cleanQuery(alias);
      if (tokens.includes(aliasClean) || clean.includes(aliasClean)) {
        return buildResolved(loc, rawQuery, 0.93);
      }
    }
  }

  // 3. Fuzzy matching against whole string (e.g. "Fasialabad")
  let bestMatch: LocationEntry | null = null;
  let highestScore = 0;

  for (const loc of KNOWN_LOCATIONS) {
    const nameScore = stringSimilarity(clean, cleanQuery(loc.name));
    if (nameScore > highestScore) {
      highestScore = nameScore;
      bestMatch = loc;
    }
    for (const alias of loc.aliases) {
      const aliasScore = stringSimilarity(clean, cleanQuery(alias));
      if (aliasScore > highestScore) {
        highestScore = aliasScore;
        bestMatch = loc;
      }
    }
  }

  // If whole-string similarity is high enough (>= 0.70 or edit distance <= 2)
  if (bestMatch && highestScore >= 0.7) {
    return buildResolved(bestMatch, rawQuery, highestScore);
  }

  // 4. Token-level fuzzy match for composite addresses (e.g. "Chak 123 Fasialabad")
  if (tokens.length > 1) {
    let tokenBestMatch: LocationEntry | null = null;
    let tokenHighScore = 0;

    for (const token of tokens) {
      if (token.length < 4) continue;
      for (const loc of KNOWN_LOCATIONS) {
        const score = stringSimilarity(token, cleanQuery(loc.name));
        if (score > tokenHighScore) {
          tokenHighScore = score;
          tokenBestMatch = loc;
        }
      }
    }

    if (tokenBestMatch && tokenHighScore >= 0.75) {
      return buildResolved(tokenBestMatch, rawQuery, tokenHighScore * 0.9);
    }
  }

  return null;
}

function buildResolved(
  loc: LocationEntry,
  rawQuery: string,
  confidence: number
): ResolvedLocation {
  return {
    name: loc.name,
    admin1: loc.admin1,
    country: loc.country,
    latitude: loc.latitude,
    longitude: loc.longitude,
    timezone: loc.timezone,
    query: rawQuery,
    matchedName: `${loc.name}, ${loc.admin1}, ${loc.country}`,
    confidence,
    formatted: `${loc.name}, ${loc.admin1}`,
  };
}

/**
 * Suggestions for autocomplete combobox on farm setup/edit screens.
 */
export function findLocationSuggestions(
  query: string,
  limit = 6
): LocationSuggestion[] {
  const clean = cleanQuery(query);
  if (!clean || clean.length < 1) {
    // Return top agricultural districts by default
    return KNOWN_LOCATIONS.slice(0, limit).map(toSuggestion);
  }

  const scored: Array<{ entry: LocationEntry; score: number }> = [];

  for (const loc of KNOWN_LOCATIONS) {
    const locClean = cleanQuery(loc.name);
    let maxScore = 0;

    if (locClean.startsWith(clean)) {
      maxScore = 1.0;
    } else if (locClean.includes(clean)) {
      maxScore = 0.85;
    } else {
      for (const alias of loc.aliases) {
        const aliasClean = cleanQuery(alias);
        if (aliasClean.startsWith(clean)) {
          maxScore = Math.max(maxScore, 0.9);
        } else if (aliasClean.includes(clean)) {
          maxScore = Math.max(maxScore, 0.75);
        }
      }
    }

    // Fuzzy check if no prefix match
    if (maxScore === 0 && clean.length >= 3) {
      const sim = stringSimilarity(clean, locClean);
      if (sim >= 0.65) maxScore = sim * 0.7;
    }

    if (maxScore > 0) {
      scored.push({ entry: loc, score: maxScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => toSuggestion(s.entry));
}

function toSuggestion(loc: LocationEntry): LocationSuggestion {
  return {
    name: loc.name,
    admin1: loc.admin1,
    country: loc.country,
    formatted: `${loc.name}, ${loc.admin1}, ${loc.country}`,
    latitude: loc.latitude,
    longitude: loc.longitude,
  };
}
