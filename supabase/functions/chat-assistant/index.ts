import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "https://kissan-ai-six.vercel.app",
  "https://vxldkzrmtygurdggtjro.supabase.co",
];

function corsForOrigin(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";

  const headers: Record<string, string> = {
    ...BASE_CORS_HEADERS,
  };

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
}

const MODEL = "gemini-3.5-flash";
const HISTORY_LIMIT = 20;

function json(
  data: unknown,
  status = 200,
  req?: Request,
): Response {
  const headers = req
    ? corsForOrigin(req)
    : BASE_CORS_HEADERS;

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

/* ------------------------------------------------------------------
 * Gemini
 * ------------------------------------------------------------------ */

const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta";

async function callGemini(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<{ text: string }> {
  const url =
    `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.ok) {
    const data = await response.json();

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!text) {
      throw new Error(
        "Kissan AI couldn't form a reply.",
      );
    }

    return { text };
  }

  const errorText = await response.text();

  console.error(
    "Gemini error:",
    response.status,
    errorText.slice(0, 1000),
  );

  if (response.status === 429) {
    const error = new Error(
      "Gemini rate limit exceeded",
    );

    error.name = "GEMINI_RATE_LIMIT";

    throw error;
  }

  throw new Error(
    "Kissan AI is temporarily unavailable. Please try again.",
  );
}

/* ------------------------------------------------------------------
 * OpenRouter fallback
 * ------------------------------------------------------------------ */

async function callOpenRouter(
  apiKey: string,
  body: {
    systemPrompt: string;
    userMessage: string;
  },
): Promise<{ text: string }> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer":
          "https://kissan-ai-six.vercel.app",
        "X-Title": "Kissan AI",
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          {
            role: "system",
            content: `${body.systemPrompt}

IMPORTANT OUTPUT RULES:
- Return ONLY one valid JSON object.
- Do NOT write explanations before or after the JSON.
- Do NOT use markdown code fences.
- Do NOT write "User Safety", "Safety", "Analysis", or any other text outside the JSON.
- The JSON must contain exactly these fields:
  answer, language, confidence, needs_clarification, clarifying_question, key_points, recommended_actions.
- answer must contain the actual answer to the farmer.

URDU SCRIPT RULE:
- If language is "ur", ALL Urdu text must be written in Urdu/Arabic script.
- NEVER write Urdu in Devanagari/Hindi script.
- Do NOT convert Urdu into Hindi.
- Do NOT answer an Urdu farmer in Hindi.
- Preserve Urdu vocabulary and meaning.
`,
          },
          {
            role: "user",
            content: body.userMessage,
          },
        ],
        temperature: 0.2,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      "OpenRouter error:",
      response.status,
      errorText.slice(0, 1000),
    );

    throw new Error(
      "OpenRouter fallback failed.",
    );
  }

  const data = await response.json();

  const text =
    data?.choices?.[0]?.message?.content ?? "";

  console.log(
    "OpenRouter raw response:",
    String(text).slice(0, 2000),
  );

  if (!text) {
    throw new Error(
      "OpenRouter returned an empty response.",
    );
  }

  return {
    text: String(text).trim(),
  };
}

/* ------------------------------------------------------------------
 * Context
 * ------------------------------------------------------------------ */

interface ChatContextPayload {
  farm?: {
    location?: string;
    area?: string;
    soilType?: string;
    irrigationMethod?: string;
  };

  crop?: {
    name?: string;
    variety?: string | null;
    plantingDate?: string | null;
  };

  growth?: {
    ageDays?: number | null;
    stage?: string;
    stageLabel?: string;
  };

  weather?: {
    temperature?: number;
    humidity?: number;
    rainProbability?: number;
    condition?: string;
  };

  recentDiagnoses?: Array<{
    diagnosis?: string;
    severity?: string;
    confidence?: number;
    createdAt?: string;
  }>;

  risks?: Array<{
    type?: string;
    level?: string;
    title?: string;
  }>;

  todayActions?: Array<{
    title?: string;
    priority?: string;
    reason?: string;
    timing?: string | null;
    completed?: boolean;
  }>;
}

/* ------------------------------------------------------------------
 * Structured reply
 * ------------------------------------------------------------------ */

interface ChatReply {
  answer: string;
  language: "en" | "ur";
  confidence: "low" | "moderate" | "high";
  needs_clarification: boolean;
  clarifying_question: string | null;
  key_points: string[];
  recommended_actions: string[];
}

/* ------------------------------------------------------------------
 * Script helpers
 * ------------------------------------------------------------------ */

/**
 * Detect Devanagari/Hindi Unicode characters.
 */
function containsDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Detect Urdu/Arabic-script characters.
 */
function containsUrduScript(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/**
 * Returns true when text appears to be Urdu written in
 * Devanagari/Hindi script.
 */
function isBadUrduScript(text: string): boolean {
  if (!text.trim()) {
    return false;
  }

  return (
    containsDevanagari(text) &&
    !containsUrduScript(text)
  );
}

/* ------------------------------------------------------------------
 * Urdu script correction
 * ------------------------------------------------------------------ */

/**
 * If an Urdu response accidentally comes back in Devanagari,
 * ask Gemini to convert only the script while preserving
 * the original meaning.
 *
 * This is intentionally a small correction pass and is only
 * triggered when Devanagari is detected.
 */
async function correctUrduScript(
  apiKey: string,
  answer: string,
): Promise<string> {
  if (!isBadUrduScript(answer)) {
    return answer;
  }

  console.warn(
    "chat-assistant: Devanagari detected in Urdu response. Running Urdu script correction.",
  );

  const correctionPrompt = `
You are an Urdu script correction assistant.

Convert the following response from Devanagari/Hindi script into natural Urdu written in Urdu/Arabic script.

STRICT RULES:

1. Preserve the EXACT meaning.
2. Do NOT add new information.
3. Do NOT remove important information.
4. Do NOT translate the content into English.
5. Do NOT change agricultural recommendations.
6. Use standard Pakistani Urdu.
7. Output ONLY the corrected Urdu text.
8. Do NOT use Devanagari/Hindi characters.
9. Do not add explanations or quotation marks.

Text to correct:

${answer}
`;

  try {
    const result = await callGemini(apiKey, {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: correctionPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
      },
    });

    const corrected = result.text.trim();

    if (
      corrected &&
      !containsDevanagari(corrected)
    ) {
      return corrected.slice(0, 6000);
    }

    console.warn(
      "chat-assistant: Urdu correction still contained Devanagari. Keeping original response.",
    );

    return answer;
  } catch (error) {
    console.error(
      "chat-assistant: Urdu script correction failed:",
      error,
    );

    return answer;
  }
}

/* ------------------------------------------------------------------
 * Robust JSON extraction
 * ------------------------------------------------------------------ */

function extractJson(raw: string): unknown | null {
  if (!raw) {
    return null;
  }

  let text = raw.trim();

  // Remove markdown code fences.
  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // First attempt: entire response is JSON.
  try {
    return JSON.parse(text);
  } catch {
    // Continue with extraction.
  }

  // Find first { and last }.
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    const candidate = text.slice(
      firstBrace,
      lastBrace + 1,
    );

    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  return null;
}

/* ------------------------------------------------------------------
 * Sanitize reply
 * ------------------------------------------------------------------ */

function sanitizeReply(
  raw: unknown,
): ChatReply | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const r = raw as Record<string, unknown>;

  const answer = String(
    r.answer ?? "",
  ).trim();

  if (!answer) {
    return null;
  }

  const language =
    r.language === "ur"
      ? "ur"
      : "en";

  const confidenceValue =
    String(r.confidence ?? "");

  const confidence = [
    "low",
    "moderate",
    "high",
  ].includes(confidenceValue)
    ? (confidenceValue as ChatReply["confidence"])
    : "moderate";

  return {
    answer: answer.slice(0, 6000),

    language,

    confidence,

    needs_clarification:
      r.needs_clarification === true,

    clarifying_question:
      r.clarifying_question
        ? String(
            r.clarifying_question,
          ).slice(0, 500)
        : null,

    key_points:
      Array.isArray(r.key_points)
        ? r.key_points
            .map((k) => String(k))
            .slice(0, 6)
        : [],

    recommended_actions:
      Array.isArray(
        r.recommended_actions,
      )
        ? r.recommended_actions
            .map((a) => String(a))
            .slice(0, 6)
        : [],
  };
}

/* ------------------------------------------------------------------
 * System prompt
 * ------------------------------------------------------------------ */

function buildSystemPrompt(
  context: ChatContextPayload,
  preferredLanguage:
    | "auto"
    | "urdu"
    | "english",
  history: Array<{
    role: string;
    content: string;
  }>,
): string {
  const bits: string[] = [];

  const farm = context.farm ?? {};
  const crop = context.crop ?? {};
  const growth = context.growth ?? {};
  const weather = context.weather ?? {};

  const farmBits = [
    farm.location
      ? `Location: ${farm.location}`
      : null,

    farm.area
      ? `Land area: ${farm.area}`
      : null,

    farm.soilType
      ? `Soil: ${farm.soilType}`
      : null,

    farm.irrigationMethod
      ? `Irrigation: ${farm.irrigationMethod}`
      : null,
  ].filter(Boolean);

  const cropBits = [
    crop.name
      ? `Crop: ${crop.name}`
      : null,

    crop.variety
      ? `Variety: ${crop.variety}`
      : null,

    crop.plantingDate
      ? `Planted: ${crop.plantingDate}`
      : null,

    growth.ageDays != null
      ? `Crop age: ${growth.ageDays} days`
      : null,

    growth.stageLabel
      ? `Growth stage: ${growth.stageLabel}`
      : null,
  ].filter(Boolean);

  const weatherBits = [
    weather.temperature != null
      ? `Temperature: ${weather.temperature}°C`
      : null,

    weather.humidity != null
      ? `Humidity: ${weather.humidity}%`
      : null,

    weather.rainProbability != null
      ? `Rain probability: ${weather.rainProbability}%`
      : null,

    weather.condition
      ? `Conditions: ${weather.condition}`
      : null,
  ].filter(Boolean);

  bits.push(
    "You are Kissan AI — an Agricultural Decision Support Assistant for smallholder farmers in South Asia (Pakistan).",
  );

  bits.push(
    "You help farmers understand their crop and farm conditions, give practical and understandable guidance, prefer simple language, and answer in the farmer's language when requested (English or Urdu).",
  );

  if (
    farmBits.length ||
    cropBits.length ||
    weatherBits.length
  ) {
    const contextLines: string[] = [
      "FARM CONTEXT (real data saved by the farmer):",
    ];

    if (farmBits.length) {
      contextLines.push(
        `- Farm:\n  ${farmBits.join("\n  ")}`,
      );
    }

    if (cropBits.length) {
      contextLines.push(
        `- Crop:\n  ${cropBits.join("\n  ")}`,
      );
    }

    if (weatherBits.length) {
      contextLines.push(
        `- Current weather:\n  ${weatherBits.join("\n  ")}`,
      );
    }

    if (
      context.recentDiagnoses?.length
    ) {
      const diag =
        context.recentDiagnoses[0];

      contextLines.push(
        `- Most recent crop diagnosis: ${
          diag.diagnosis ?? "unknown"
        } (severity: ${
          diag.severity ?? "unknown"
        }, confidence: ${
          diag.confidence ?? "unknown"
        }%).`,
      );
    }

    if (context.risks?.length) {
      const riskLines =
        context.risks
          .map(
            (r) =>
              `    - [${
                r.level ?? "unknown"
              }] ${
                r.title ?? "risk"
              } (${
                r.type ?? "unknown"
              })`,
          )
          .join("\n");

      contextLines.push(
        `- Current farm risk assessment:\n${riskLines}`,
      );
    }

    if (
      context.todayActions?.length
    ) {
      const actionLines =
        context.todayActions
          .map(
            (a) =>
              `    - [${
                a.priority ?? "medium"
              }] ${
                a.title ?? "action"
              }${
                a.completed
                  ? " (completed)"
                  : ""
              }${
                a.timing
                  ? ` — timing: ${a.timing}`
                  : ""
              }\n      Why: ${
                a.reason ??
                "no reason given"
              }`,
          )
          .join("\n");

      contextLines.push(
        `- Current "What should I do today?" actions:\n${actionLines}`,
      );
    }

    bits.push(
      contextLines.join("\n"),
    );
  } else {
    bits.push(
      "FARM CONTEXT: No farm-specific context is available right now. Answer general agricultural questions where safe, and clearly state that farm-specific information is unavailable.",
    );
  }

  bits.push(
    "SAFETY RULES — follow these strictly:",
    "- NEVER claim a diagnosis with certainty.",
    "- NEVER invent a pesticide, chemical, or crop condition.",
    "- NEVER invent dosages or application rates.",
    "- NEVER recommend dangerous chemical combinations.",
    "- NEVER claim a treatment is guaranteed to work.",
    "- NEVER fabricate farm information, weather, laboratory results, or diagnosis history.",
    "- For serious crop disease or pest situations, recommend consulting a qualified local agricultural expert or agricultural officer.",
    "- Clearly distinguish facts from estimates.",
    "- If important information is missing, ask a clarifying question instead of guessing.",
  );

  // Strong language rules.
  bits.push(
    `LANGUAGE RULES:

1. Detect the farmer's message language automatically.
2. If the farmer speaks/writes Urdu, answer in Pakistani Urdu.
3. If the farmer prefers Urdu, answer in clear, simple Pakistani Urdu.
4. Urdu MUST be written using Urdu/Arabic script.
5. NEVER write Urdu using Devanagari/Hindi characters.
6. NEVER convert Urdu into Hindi.
7. NEVER answer an Urdu question in English unless the farmer explicitly asks for English.
8. Preserve common Pakistani agricultural terms naturally.
9. If the farmer uses Roman Urdu, you may understand Roman Urdu, but when the preferred language is Urdu, respond in proper Urdu script.
10. If the farmer asks in English and prefers English, answer in simple English.`,
  );

  if (
    preferredLanguage === "urdu"
  ) {
    bits.push(
      `HARD URDU REQUIREMENT:

The farmer has explicitly selected Urdu.

Your "answer", "clarifying_question", "key_points", and "recommended_actions" MUST be in Urdu.

Use Urdu/Arabic script only for Urdu content.

DO NOT use Devanagari/Hindi script.

Example of correct Urdu:

"آپ کی فصل کو اس وقت زیادہ پانی کی ضرورت ہو سکتی ہے۔"

Example of WRONG output:

"आपकी फसल को इस समय ज्यादा पानी की जरूरत हो सकती है।"

The second example is Hindi/Devanagari and MUST NOT be produced.`,
    );
  }

  if (
    preferredLanguage === "english"
  ) {
    bits.push(
      "The farmer prefers English — answer in clear, simple English.",
    );
  }

  if (history.length > 0) {
    const historyLines =
      history.map(
        (m) =>
          `${
            m.role === "user"
              ? "Farmer"
              : "Kissan AI"
          }: ${m.content}`,
      );

    bits.push(
      `RECENT CONVERSATION:\n${historyLines.join("\n")}`,
    );
  }

  return bits.join("\n\n");
}

/* ------------------------------------------------------------------
 * Main handler
 * ------------------------------------------------------------------ */

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsForOrigin(req),
    });
  }

  // Method validation
  if (req.method !== "POST") {
    return json(
      {
        success: false,
        error: "Method not allowed.",
      },
      405,
      req,
    );
  }

  // JWT sanity check
  const auth =
    req.headers.get("Authorization") ?? "";

  if (
    !auth.startsWith("Bearer ") ||
    auth.split(".").length !== 3
  ) {
    return json(
      {
        success: false,
        error:
          "This request is not authorized. Please try again.",
      },
      401,
      req,
    );
  }

  const geminiApiKey =
    Deno.env.get("GEMINI_API_KEY");

  if (!geminiApiKey) {
    return json(
      {
        success: false,
        error:
          "Kissan AI is temporarily unavailable. Please try again later.",
      },
      503,
      req,
    );
  }

  let body: {
    farmId?: string;
    conversationId?: string;
    message?: string;
    preferredLanguage?:
      | "auto"
      | "urdu"
      | "english";
    context?: ChatContextPayload;
  };

  try {
    body = await req.json();
  } catch {
    return json(
      {
        success: false,
        error:
          "We couldn't read your message. Please try again.",
      },
      400,
      req,
    );
  }

  const farmId =
    (body?.farmId ?? "").trim();

  const conversationId =
    (body?.conversationId ?? "").trim();

  const message =
    (body?.message ?? "").trim();

  const preferredLanguage =
    body?.preferredLanguage === "urdu" ||
    body?.preferredLanguage === "english"
      ? body.preferredLanguage
      : "auto";

  if (!message) {
    return json(
      {
        success: false,
        error:
          "Please type a message before sending.",
      },
      400,
      req,
    );
  }

  if (!farmId) {
    return json(
      {
        success: false,
        error:
          "No farm was found. Please set up your farm first.",
      },
      400,
      req,
    );
  }

  if (!conversationId) {
    return json(
      {
        success: false,
        error:
          "No conversation was found. Please start a new chat.",
      },
      400,
      req,
    );
  }

  const supabaseAdmin =
    createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      ) ?? "",
    );

  // ---------------------------------------------------------------
  // 1. Validate farm
  // ---------------------------------------------------------------

  const {
    data: farmRow,
    error: farmError,
  } =
    await supabaseAdmin
      .from("farms")
      .select("id, user_id")
      .eq("id", farmId)
      .maybeSingle();

  if (
    farmError ||
    !farmRow
  ) {
    return json(
      {
        success: false,
        error:
          "We couldn't find your farm. Please try again.",
      },
      404,
      req,
    );
  }

  // ---------------------------------------------------------------
  // 2. Validate ownership
  // ---------------------------------------------------------------

  const {
    data: caller,
    error: callerError,
  } =
    await supabaseAdmin.auth.getUser(
      auth
        .slice("Bearer ".length)
        .trim(),
    );

  const callerId =
    caller?.user?.id ?? null;

  if (
    callerError ||
    !callerId ||
    farmRow.user_id !== callerId
  ) {
    return json(
      {
        success: false,
        error:
          "You don't have access to that farm.",
      },
      403,
      req,
    );
  }

  // ---------------------------------------------------------------
  // 3. Validate conversation
  // ---------------------------------------------------------------

  const {
    data: conversationRow,
    error: conversationError,
  } =
    await supabaseAdmin
      .from("chat_conversations")
      .select("id, farm_id")
      .eq("id", conversationId)
      .maybeSingle();

  if (
    conversationError ||
    !conversationRow ||
    conversationRow.farm_id !== farmId
  ) {
    return json(
      {
        success: false,
        error:
          "This conversation could not be opened.",
      },
      404,
      req,
    );
  }

  // ---------------------------------------------------------------
  // 4. Load history
  // ---------------------------------------------------------------

  const {
    data: recentRows,
    error: historyError,
  } =
    await supabaseAdmin
      .from("chat_messages")
      .select(
        "role, content, created_at",
      )
      .eq(
        "conversation_id",
        conversationId,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      )
      .limit(HISTORY_LIMIT);

  if (historyError) {
    return json(
      {
        success: false,
        error:
          "Kissan AI is temporarily unavailable. Please try again.",
      },
      502,
      req,
    );
  }

  const history = (
    (recentRows as Array<{
      role: string;
      content: string;
    }>) ?? []
  )
    .slice()
    .reverse()
    .map((m) => ({
      role: m.role,
      content: String(
        m.content ?? "",
      ),
    }));

  // ---------------------------------------------------------------
  // 5. Build prompt
  // ---------------------------------------------------------------

  const context =
    body?.context ?? {};

  const prompt =
    buildSystemPrompt(
      context,
      preferredLanguage,
      history,
    );

  const userTurn =
    `Farmer: ${message}\n\nRespond now with the structured answer JSON.`;

  // ---------------------------------------------------------------
  // Gemini → OpenRouter fallback
  // ---------------------------------------------------------------

  let aiText = "";

  try {
    const result =
      await callGemini(
        geminiApiKey,
        {
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt,
                },
                {
                  text: userTurn,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            responseMimeType:
              "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                answer: {
                  type: "STRING",
                },

                language: {
                  type: "STRING",
                  enum: [
                    "en",
                    "ur",
                  ],
                },

                confidence: {
                  type: "STRING",
                  enum: [
                    "low",
                    "moderate",
                    "high",
                  ],
                },

                needs_clarification: {
                  type: "BOOLEAN",
                },

                clarifying_question: {
                  type: "STRING",
                },

                key_points: {
                  type: "ARRAY",
                  items: {
                    type: "STRING",
                  },
                },

                recommended_actions: {
                  type: "ARRAY",
                  items: {
                    type: "STRING",
                  },
                },
              },

              required: [
                "answer",
                "language",
                "confidence",
                "needs_clarification",
                "clarifying_question",
                "key_points",
                "recommended_actions",
              ],
            },
          },
        },
      );

    aiText = result.text;

    console.log(
      "AI provider: Gemini",
    );
  } catch (err) {
    const error = err as Error;

    if (
      error.name ===
      "GEMINI_RATE_LIMIT"
    ) {
      console.log(
        "Gemini 429 detected. Switching immediately to OpenRouter.",
      );

      const openRouterKey =
        Deno.env.get(
          "OPENROUTER_API_KEY",
        );

      if (!openRouterKey) {
        console.error(
          "OPENROUTER_API_KEY is not configured.",
        );

        return json(
          {
            success: false,
            error:
              "AI fallback service is not configured.",
          },
          502,
          req,
        );
      }

      try {
        const result =
          await callOpenRouter(
            openRouterKey,
            {
              systemPrompt:
                prompt,
              userMessage:
                userTurn,
            },
          );

        aiText = result.text;

        console.log(
          "AI provider: OpenRouter fallback",
        );
      } catch (openRouterError) {
        console.error(
          "OpenRouter fallback failed:",
          openRouterError,
        );

        return json(
          {
            success: false,
            error:
              "Kissan AI is temporarily unavailable. Please try again.",
          },
          502,
          req,
        );
      }
    } else {
      console.error(
        "chat-assistant Gemini error:",
        error,
      );

      return json(
        {
          success: false,
          error:
            "Kissan AI is temporarily unavailable. Please try again.",
        },
        502,
        req,
      );
    }
  }

  // ---------------------------------------------------------------
  // 6. Parse AI response
  // ---------------------------------------------------------------

  console.log(
    "Final AI raw response:",
    aiText.slice(0, 2000),
  );

  const rawParsed =
    extractJson(aiText);

  const parsed =
    sanitizeReply(rawParsed);

  if (!parsed) {
    console.error(
      "chat-assistant parse failure. Raw:",
      aiText.slice(0, 2000),
    );

    return json(
      {
        success: false,
        error:
          "Kissan AI couldn't form a clear answer. Please try asking again.",
      },
      502,
      req,
    );
  }

  // ---------------------------------------------------------------
  // 7. Final Urdu script safeguard
  // ---------------------------------------------------------------

  if (
    preferredLanguage === "urdu" ||
    parsed.language === "ur"
  ) {
    parsed.answer =
      await correctUrduScript(
        geminiApiKey,
        parsed.answer,
      );

    if (
      parsed.clarifying_question &&
      isBadUrduScript(
        parsed.clarifying_question,
      )
    ) {
      parsed.clarifying_question =
        await correctUrduScript(
          geminiApiKey,
          parsed.clarifying_question,
        );
    }

    parsed.key_points =
      await Promise.all(
        parsed.key_points.map(
          async (point) =>
            isBadUrduScript(point)
              ? await correctUrduScript(
                  geminiApiKey,
                  point,
                )
              : point,
        ),
      );

    parsed.recommended_actions =
      await Promise.all(
        parsed.recommended_actions.map(
          async (action) =>
            isBadUrduScript(action)
              ? await correctUrduScript(
                  geminiApiKey,
                  action,
                )
              : action,
        ),
      );

    // Force language metadata to Urdu.
    parsed.language = "ur";
  }

  // ---------------------------------------------------------------
  // 8. Save assistant message
  // ---------------------------------------------------------------

  const {
    data: savedMessage,
    error: insertError,
  } =
    await supabaseAdmin
      .from("chat_messages")
      .insert({
        conversation_id:
          conversationId,
        farm_id:
          farmId,
        role:
          "assistant",
        content:
          parsed.answer,
      })
      .select()
      .single();

  if (insertError) {
    console.error(
      "chat-assistant insert error:",
      insertError,
    );

    return json(
      {
        success: false,
        error:
          "Kissan AI is temporarily unavailable. Please try again.",
      },
      502,
      req,
    );
  }

  // ---------------------------------------------------------------
  // 9. Update conversation
  // ---------------------------------------------------------------

  await supabaseAdmin
    .from("chat_conversations")
    .update({
      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      conversationId,
    );

  // ---------------------------------------------------------------
  // 10. Return
  // ---------------------------------------------------------------

  return json(
    {
      success: true,
      reply: parsed,
      message: savedMessage,
    },
    200,
    req,
  );
});