import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * chat-assistant
 *
 * Context-aware agricultural AI assistant for Kissan AI.
 *
 * Architecture:
 *   Browser  →  this Edge Function  →  Gemini  →  structured reply
 *              (farm context + recent chat history)
 *
 * Security model (mirrors analyze-crop):
 *  - The Gemini API key lives ONLY in Supabase Edge Function secrets
 *    (GEMINI_API_KEY), read here with Deno.env.get — it never reaches the
 *    browser.
 *  - verify_jwt is disabled at the platform level (anon-based app); we do a
 *    lightweight Bearer JWT sanity check here, same as the other functions.
 *  - The farm is validated server-side via the service role (never trust a
 *    client-supplied farm ID blindly) and the conversation must belong to
 *    that farm.
 *  - The assistant message is inserted via the service role so a client can
 *    never forge an AI reply. The user message is saved by the client (anon,
 *    via RLS) before this function runs.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "gemini-3.5-flash";
/** Recent-message window sent to the model (configurable). */
const HISTORY_LIMIT = 20;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/* ------------------------------------------------------------------ */
/* Resilient Gemini call (handles free-tier 429 rate limits)           */
/* ------------------------------------------------------------------ */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Call Gemini's generateContent endpoint with a bounded retry on transient
 * failures (429 rate-limit / 5xx). Throws a dedicated error when the quota
 * is exhausted so the caller can reply with an honest, actionable message.
 */
async function callGemini(
  apiKey: string,
  body: Record<string, unknown>
): Promise<{ text: string }> {
  const url = `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${apiKey}`;
  const maxAttempts = 3;
  let lastError = "Kissan AI is temporarily unavailable. Please try again.";
  let quotaExhausted = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      lastError = "Kissan AI is temporarily unavailable. Please try again.";
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      throw new Error(lastError);
    }

    if (resp.ok) {
      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!text) {
        lastError = "Kissan AI couldn't form a reply. Please try again.";
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
      }
      return { text };
    }

    const errText = await resp.text();
    console.error(`${MODEL} error (attempt ${attempt}/${maxAttempts}):`, resp.status, errText.slice(0, 300));

    if (resp.status === 429) {
      quotaExhausted = true;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 5000 * attempt));
        continue;
      }
      break;
    }
    if (resp.status >= 500 && attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }
    break;
  }

  if (quotaExhausted) {
    throw new Error(
      "Kissan AI is a bit busy right now — its request limit for this moment was reached. Please wait a minute and try again."
    );
  }
  throw new Error(lastError);
}

/* ------------------------------------------------------------------ */
/* Context payload (sent by the client, built from existing systems)   */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Structured AI reply                                                 */
/* ------------------------------------------------------------------ */

interface ChatReply {
  answer: string;
  language: "en" | "ur";
  confidence: "low" | "moderate" | "high";
  needs_clarification: boolean;
  clarifying_question: string | null;
  key_points: string[];
  recommended_actions: string[];
}

function sanitizeReply(raw: unknown): ChatReply | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const answer = String(r.answer ?? "").trim();
  if (!answer) return null;

  const language = r.language === "ur" ? "ur" : "en";
  const confidence = ["low", "moderate", "high"].includes(String(r.confidence))
    ? (r.confidence as ChatReply["confidence"])
    : "moderate";

  return {
    answer: answer.slice(0, 6000),
    language,
    confidence,
    needs_clarification: r.needs_clarification === true,
    clarifying_question: r.clarifying_question
      ? String(r.clarifying_question).slice(0, 500)
      : null,
    key_points: Array.isArray(r.key_points)
      ? r.key_points.map((k) => String(k)).slice(0, 6)
      : [],
    recommended_actions: Array.isArray(r.recommended_actions)
      ? r.recommended_actions.map((a) => String(a)).slice(0, 6)
      : [],
  };
}

/* ------------------------------------------------------------------ */
/* System prompt (agricultural safety rules)                           */
/* ------------------------------------------------------------------ */

function buildSystemPrompt(
  context: ChatContextPayload,
  preferredLanguage: "auto" | "urdu" | "english",
  history: Array<{ role: string; content: string }>
): string {
  const bits: string[] = [];

  const farm = context.farm ?? {};
  const crop = context.crop ?? {};
  const growth = context.growth ?? {};
  const weather = context.weather ?? {};

  const farmBits = [
    farm.location ? `Location: ${farm.location}` : null,
    farm.area ? `Land area: ${farm.area}` : null,
    farm.soilType ? `Soil: ${farm.soilType}` : null,
    farm.irrigationMethod ? `Irrigation: ${farm.irrigationMethod}` : null,
  ].filter(Boolean);

  const cropBits = [
    crop.name ? `Crop: ${crop.name}` : null,
    crop.variety ? `Variety: ${crop.variety}` : null,
    crop.plantingDate ? `Planted: ${crop.plantingDate}` : null,
    growth.ageDays != null ? `Crop age: ${growth.ageDays} days` : null,
    growth.stageLabel ? `Growth stage: ${growth.stageLabel}` : null,
  ].filter(Boolean);

  const weatherBits = [
    weather.temperature != null ? `Temperature: ${weather.temperature}°C` : null,
    weather.humidity != null ? `Humidity: ${weather.humidity}%` : null,
    weather.rainProbability != null
      ? `Rain probability: ${weather.rainProbability}%`
      : null,
    weather.condition ? `Conditions: ${weather.condition}` : null,
  ].filter(Boolean);

  bits.push(
    "You are Kissan AI — an Agricultural Decision Support Assistant for smallholder farmers in South Asia (Pakistan)."
  );
  bits.push(
    "You help farmers understand their crop and farm conditions, give practical and understandable guidance, prefer simple language, and answer in the farmer's language when requested (English or Urdu)."
  );

  if (farmBits.length || cropBits.length || weatherBits.length) {
    const contextLines: string[] = ["FARM CONTEXT (real data saved by the farmer):"];
    if (farmBits.length) contextLines.push(`- Farm:\n  ${farmBits.join("\n  ")}`);
    if (cropBits.length) contextLines.push(`- Crop:\n  ${cropBits.join("\n  ")}`);
    if (weatherBits.length)
      contextLines.push(`- Current weather:\n  ${weatherBits.join("\n  ")}`);
    if (context.recentDiagnoses?.length) {
      const diag = context.recentDiagnoses[0];
      contextLines.push(
        `- Most recent crop diagnosis: ${diag.diagnosis ?? "unknown"} (severity: ${
          diag.severity ?? "unknown"
        }, confidence: ${diag.confidence ?? "unknown"}%).`
      );
    }
    if (context.risks?.length) {
      const riskLines = context.risks
        .map((r) => `    - [${r.level ?? "unknown"}] ${r.title ?? "risk"} (${r.type ?? "unknown"})`)
        .join("\n");
      contextLines.push(
        `- Current farm risk assessment (from the Risk Engine):\n${riskLines}`
      );
    }
    if (context.todayActions?.length) {
      const actionLines = context.todayActions
        .map(
          (a) =>
            `    - [${a.priority ?? "medium"}] ${a.title ?? "action"}${
              a.completed ? " (completed)" : ""
            }${a.timing ? ` — timing: ${a.timing}` : ""}\n      Why: ${a.reason ?? "no reason given"}`
        )
        .join("\n");
      contextLines.push(
        `- Current "What should I do today?" actions (from the Decision Engine):\n${actionLines}\n  If the farmer asks why they should do an action today, explain using its saved reason and the farm context above.`
      );
    }
    bits.push(contextLines.join("\n"));
  } else {
    bits.push(
      "FARM CONTEXT: No farm-specific context is available right now. Answer general agricultural questions where safe, and clearly state that farm-specific information is unavailable."
    );
  }

  bits.push(
    "SAFETY RULES — follow these strictly:",
    "- NEVER claim a diagnosis with certainty. Use cautious language such as 'this may be related to...'.",
    "- NEVER invent a pesticide, chemical, or crop condition.",
    "- NEVER invent dosages or application rates. If you don't have exact product information, say so and advise: 'Follow the product label and local agricultural guidance for the correct application rate.'",
    "- NEVER recommend dangerous chemical combinations, and never tell the farmer to ignore product labels.",
    "- NEVER claim a treatment is guaranteed to work.",
    "- NEVER fabricate farm information, weather, laboratory results, or diagnosis history. Only use the context provided above.",
    "- For serious crop disease or pest situations, recommend consulting a qualified local agricultural expert or agricultural officer.",
    "- Clearly distinguish facts from estimates. Never claim certainty when evidence is insufficient.",
    "- If important information is missing to answer well, ask a clarifying question instead of guessing."
  );

  bits.push(
    "LANGUAGE: Detect the language of the farmer's message automatically and reply in that same language (Urdu or English). Do not translate an Urdu question into an English answer unless the farmer asks."
  );
  if (preferredLanguage === "urdu") {
    bits.push("The farmer prefers Urdu — answer in clear, simple Urdu.");
  } else if (preferredLanguage === "english") {
    bits.push("The farmer prefers English — answer in clear, simple English.");
  }

  bits.push(
    "Your final answer must be honest about uncertainty. Use confidence only as a meaningful signal — never imply scientific certainty."
  );

  if (history.length > 0) {
    const historyLines = history.map(
      (m) => `${m.role === "user" ? "Farmer" : "Kissan AI"}: ${m.content}`
    );
    bits.push(`RECENT CONVERSATION:\n${historyLines.join("\n")}`);
  }

  return bits.join("\n\n");
}

/* ------------------------------------------------------------------ */
/* Main handler                                                        */
/* ------------------------------------------------------------------ */

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Lightweight JWT sanity check (anon-based app).
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ") || auth.split(".").length !== 3) {
    return json(
      { success: false, error: "This request is not authorized. Please try again." },
      401
    );
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return json(
      {
        success: false,
        error:
          "Kissan AI is temporarily unavailable. Please try again later.",
      },
      503
    );
  }

  let body: {
    farmId?: string;
    conversationId?: string;
    message?: string;
    preferredLanguage?: "auto" | "urdu" | "english";
    context?: ChatContextPayload;
  };
  try {
    body = await req.json();
  } catch {
    return json(
      { success: false, error: "We couldn't read your message. Please try again." },
      400
    );
  }

  const farmId = (body?.farmId ?? "").trim();
  const conversationId = (body?.conversationId ?? "").trim();
  const message = (body?.message ?? "").trim();
  const preferredLanguage =
    body?.preferredLanguage === "urdu" || body?.preferredLanguage === "english"
      ? body.preferredLanguage
      : "auto";

  if (!message) {
    return json(
      { success: false, error: "Please type a message before sending." },
      400
    );
  }
  if (!farmId) {
    return json(
      { success: false, error: "No farm was found. Please set up your farm first." },
      400
    );
  }
  if (!conversationId) {
    return json(
      { success: false, error: "No conversation was found. Please start a new chat." },
      400
    );
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 1) Validate the farm exists and belongs to the caller.
  const { data: farmRow, error: farmError } = await supabaseAdmin
    .from("farms")
    .select("id, user_id")
    .eq("id", farmId)
    .maybeSingle();

  if (farmError || !farmRow) {
    return json(
      { success: false, error: "We couldn't find your farm. Please try again." },
      404
    );
  }

  // 1b) Ownership: the caller must be the authenticated owner of the farm.
  const { data: caller, error: callerError } = await supabaseAdmin.auth.getUser(
    auth.slice("Bearer ".length).trim()
  );
  const callerId = caller?.user?.id ?? null;
  if (callerError || !callerId || farmRow.user_id !== callerId) {
    return json(
      { success: false, error: "You don't have access to that farm." },
      403
    );
  }

  // 2) Validate the conversation belongs to this farm.
  const { data: conversationRow, error: conversationError } = await supabaseAdmin
    .from("chat_conversations")
    .select("id, farm_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError || !conversationRow || conversationRow.farm_id !== farmId) {
    return json(
      { success: false, error: "This conversation could not be opened." },
      404
    );
  }

  // 3) Load the recent message window (latest N, chronological).
  const { data: recentRows, error: historyError } = await supabaseAdmin
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (historyError) {
    return json(
      { success: false, error: "Kissan AI is temporarily unavailable. Please try again." },
      502
    );
  }

  const history = ((recentRows as Array<{ role: string; content: string }>) ?? [])
    .slice()
    .reverse()
    .map((m) => ({ role: m.role, content: String(m.content ?? "") }));

  const context = body?.context ?? {};

  // 4) Call Gemini with a forced structured JSON response.
  const prompt = buildSystemPrompt(context, preferredLanguage, history);
  const userTurn = `Farmer: ${message}\n\nRespond now with your structured answer JSON.`;

  let geminiText: string;
  try {
    const result = await callGemini(apiKey, {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { text: userTurn },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            answer: { type: "STRING" },
            language: { type: "STRING", enum: ["en", "ur"] },
            confidence: { type: "STRING", enum: ["low", "moderate", "high"] },
            needs_clarification: { type: "BOOLEAN" },
            clarifying_question: { type: "STRING" },
            key_points: { type: "ARRAY", items: { type: "STRING" } },
            recommended_actions: { type: "ARRAY", items: { type: "STRING" } },
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
    });
    geminiText = result.text;
  } catch (err) {
    console.error("chat-assistant Gemini error:", err instanceof Error ? err.message : err);
    return json(
      { success: false, error: err instanceof Error ? err.message : "Kissan AI is temporarily unavailable. Please try again." },
      502
    );
  }

  let parsed: ChatReply | null = null;
  try {
    parsed = sanitizeReply(JSON.parse(geminiText));
  } catch {
    parsed = null;
  }

  if (!parsed) {
    console.error("chat-assistant parse failure. Raw:", geminiText.slice(0, 500));
    return json(
      {
        success: false,
        error:
          "Kissan AI couldn't form a clear answer. Please try asking again.",
      },
      502
    );
  }

  // 5) Persist the assistant reply via the service role (clients can't forge it).
  const { data: savedMessage, error: insertError } = await supabaseAdmin
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      farm_id: farmId,
      role: "assistant",
      content: parsed.answer,
    })
    .select()
    .single();

  if (insertError) {
    console.error("chat-assistant insert error:", insertError);
    return json(
      { success: false, error: "Kissan AI is temporarily unavailable. Please try again." },
      502
    );
  }

  // Touch the conversation so it sorts as most-recent.
  await supabaseAdmin
    .from("chat_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return json({ success: true, reply: parsed, message: savedMessage });
});