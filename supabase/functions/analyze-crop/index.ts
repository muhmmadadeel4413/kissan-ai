import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * analyze-crop
 *
 * Securely analyzes a crop photo using Google Gemini vision API.
 *
 * Provider flow:
 * 1. Gemini is tried first.
 * 2. If Gemini returns HTTP 429, immediately switch to OpenRouter.
 * 3. OpenRouter uses the `openrouter/free` routing model.
 * 4. No repeated Gemini retries before fallback.
 *
 * Security model:
 * - API keys live only in Supabase Edge Function secrets.
 * - The client provides the image URL and farm context.
 * - Diagnosis results are persisted using the Supabase service role.
 * - Farm ownership is checked when farmId is supplied.
 */

const corsHeaders = {
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
    ...corsHeaders,
  };

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
}

const MODEL = "gemini-3.5-flash";

const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta";

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

function json(
  data: unknown,
  status = 200,
  req?: Request,
): Response {
  const headers = req
    ? corsForOrigin(req)
    : corsHeaders;

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

/* ------------------------------------------------------------------ */
/* Gemini                                                             */
/* ------------------------------------------------------------------ */

/**
 * Single Gemini attempt.
 *
 * IMPORTANT:
 * We intentionally do NOT retry Gemini on 429.
 * A 429 immediately triggers the OpenRouter fallback.
 */
async function callGemini(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<{ text: string }> {
  const url =
    `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${apiKey}`;

  let resp: Response;

  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("Gemini network error:", error);
    throw new Error("GEMINI_UNAVAILABLE");
  }

  if (resp.ok) {
    const data = await resp.json();

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!text) {
      throw new Error("GEMINI_EMPTY_RESPONSE");
    }

    return { text };
  }

  const errText = await resp.text();

  console.error(
    `Gemini error: ${resp.status}`,
    errText.slice(0, 500),
  );

  if (resp.status === 429) {
    throw new Error("GEMINI_RATE_LIMIT");
  }

  throw new Error("GEMINI_ERROR");
}

/* ------------------------------------------------------------------ */
/* OpenRouter fallback                                                */
/* ------------------------------------------------------------------ */

async function callOpenRouter(
  apiKey: string,
  prompt: string,
  imageData: string,
  mimeType: string,
): Promise<{ text: string; model: string | null }> {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://kissan-ai-six.vercel.app",
      "X-Title": "Kissan AI",
    },
    body: JSON.stringify({
      model: "openrouter/free",
      messages: [
        {
          role: "system",
          content:
            "You are a trusted crop-health expert for smallholder farmers in South Asia, especially Pakistan. Analyze crop photos carefully. Return ONLY valid JSON. Do not use markdown code fences. Do not add explanations before or after the JSON.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageData}`,
              },
            },
          ],
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      "OpenRouter error:",
      response.status,
      errorText.slice(0, 500),
    );

    throw new Error("OPENROUTER_ERROR");
  }

  const data = await response.json();

  const model =
    typeof data?.model === "string"
      ? data.model
      : null;

  console.log(
    "analyze-crop OpenRouter model used:",
    model ?? "unknown",
  );

  const content =
    data?.choices?.[0]?.message?.content;

  let text = "";

  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .map((part: unknown) => {
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof (part as { text?: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }

        return "";
      })
      .join("");
  }

  if (!text.trim()) {
    throw new Error("OPENROUTER_EMPTY_RESPONSE");
  }

  return {
    text: text.trim(),
    model,
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Chunked base64 encode to avoid call-stack limits on large images.
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;

  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, i + chunk),
    );
  }

  return btoa(binary);
}

/**
 * Extract JSON from model output.
 *
 * Handles:
 * - Pure JSON
 * - ```json ... ```
 * - Text before/after JSON
 */
function extractJson(text: string): unknown | null {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue with object extraction below.
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    const possibleJson = cleaned.slice(
      firstBrace,
      lastBrace + 1,
    );

    try {
      return JSON.parse(possibleJson);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Extract a structured diagnosis object from model JSON.
 */
function parseDiagnosis(text: string): {
  diagnosis: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  description: string;
  causes: string[];
  recommendedActions: string[];
  notes: string;
} | null {
  const raw = extractJson(text);

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Record<string, unknown>;

  const severity: "low" | "medium" | "high" =
    ["low", "medium", "high"].includes(
      String(data.severity),
    )
      ? (String(data.severity) as
          | "low"
          | "medium"
          | "high")
      : "medium";

  const confidenceNumber = Number(data.confidence);

  const confidence = Math.max(
    0,
    Math.min(
      100,
      Number.isFinite(confidenceNumber)
        ? confidenceNumber
        : 0,
    ),
  );

  return {
    diagnosis: String(
      data.diagnosis ?? "Condition detected",
    ).slice(0, 300),

    severity,

    confidence,

    description: String(
      data.description ?? "",
    ).slice(0, 2000),

    causes: Array.isArray(data.causes)
      ? data.causes
          .map((cause: unknown) => String(cause))
          .slice(0, 8)
      : [],

    recommendedActions: Array.isArray(
      data.recommendedActions,
    )
      ? data.recommendedActions
          .map((action: unknown) => String(action))
          .slice(0, 8)
      : [],

    notes: String(
      data.notes ?? "",
    ).slice(0, 1000),
  };
}

/* ------------------------------------------------------------------ */
/* Main handler                                                       */
/* ------------------------------------------------------------------ */

Deno.serve(async (req: Request) => {
  /* CORS preflight */
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsForOrigin(req),
    });
  }

  /* Only POST is supported */
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

  /* Lightweight JWT sanity check */
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
          "AI diagnosis is not configured yet. Add the Gemini API key in the project settings to enable the Crop Doctor.",
      },
      503,
      req,
    );
  }

  let body: {
    imageUrl?: string;
    farmId?: string;
    cropName?: string;
    growthStage?: string;
    variety?: string;
    location?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json(
      {
        success: false,
        error:
          "We couldn't read your request. Please try again.",
      },
      400,
      req,
    );
  }

  const {
    imageUrl,
    farmId,
    growthStage,
    variety,
    location,
  } = body ?? {};

  const cropName =
    (body?.cropName ?? "crop")
      .trim()
      .slice(0, 120) || "crop";

  if (!imageUrl) {
    return json(
      {
        success: false,
        error:
          "No photo was provided. Please upload one first.",
      },
      400,
      req,
    );
  }

  /* -------------------------------------------------------------- */
  /* Download stored image                                          */
  /* -------------------------------------------------------------- */

  let imageResp: Response;

  try {
    imageResp = await fetch(imageUrl);
  } catch {
    return json(
      {
        success: false,
        error:
          "We couldn't retrieve your photo. Please try again.",
      },
      502,
      req,
    );
  }

  if (!imageResp.ok) {
    return json(
      {
        success: false,
        error:
          "We couldn't retrieve your photo. Please try again.",
      },
      502,
      req,
    );
  }

  const contentType =
    imageResp.headers.get("content-type") ??
    "image/jpeg";

  const imageBytes = new Uint8Array(
    await imageResp.arrayBuffer(),
  );

  const base64 = bytesToBase64(imageBytes);

  /* -------------------------------------------------------------- */
  /* Build context                                                  */
  /* -------------------------------------------------------------- */

  const contextBits = [
    cropName
      ? `- Crop: ${cropName}`
      : null,

    growthStage
      ? `- Growth stage: ${growthStage}`
      : null,

    variety
      ? `- Variety: ${variety}`
      : null,

    location
      ? `- Location: ${location}`
      : null,
  ].filter(Boolean);

  const systemContext =
    contextBits.length > 0
      ? `The photo is of ${cropName} on a farm in South Asia (e.g. Pakistan).

Context provided by the farmer:

${contextBits.join("\n")}`
      : `The photo is of a crop on a farm in South Asia (e.g. Pakistan). No additional context was provided.`;

  /* -------------------------------------------------------------- */
  /* Diagnosis prompt                                               */
  /* -------------------------------------------------------------- */

  const prompt = `
You are a trusted crop-health expert for smallholder farmers in South Asia (Pakistan). You diagnose plant problems from photos.

${systemContext}

Look carefully at the photo of the crop/leaf. Identify the most likely problem.

Be honest and careful:

- If the image is unclear, say so.
- If you cannot confidently identify a specific problem, use a diagnosis such as "Unclear — could not confidently identify".
- Set confidence low when visual evidence is weak.
- Do not invent symptoms that are not visible.
- Recommended actions must be simple, affordable, safe, and suitable for a smallholder farmer.
- Do not recommend dangerous pesticide mixing or unsafe chemical practices.

Respond ONLY with valid JSON matching this schema.

Do not use markdown.

Do not add text before or after the JSON.

Schema:

{
  "diagnosis": "short human-readable name of the likely problem",
  "severity": "low" | "medium" | "high",
  "confidence": 0-100 integer,
  "description": "2-4 clear sentences for a non-expert farmer explaining what this is and why it matters",
  "causes": ["likely cause 1", "likely cause 2"],
  "recommendedActions": ["simple, affordable, safe action 1", "action 2", "action 3"],
  "notes": "Any important caveat, e.g. when to consult a local agricultural officer. Always remind that this is AI guidance, not a substitute for a professional."
}
`.trim();

  /* -------------------------------------------------------------- */
  /* Gemini first → OpenRouter fallback                             */
  /* -------------------------------------------------------------- */

  let modelText = "";

  let provider: "gemini" | "openrouter" = "gemini";

  const geminiBody = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
          {
            inlineData: {
              mimeType: contentType,
              data: base64,
            },
          },
        ],
      },
    ],

    generationConfig: {
      temperature: 0.3,

      responseMimeType: "application/json",

      responseSchema: {
        type: "OBJECT",

        properties: {
          diagnosis: {
            type: "STRING",
          },

          severity: {
            type: "STRING",
            enum: ["low", "medium", "high"],
          },

          confidence: {
            type: "INTEGER",
          },

          description: {
            type: "STRING",
          },

          causes: {
            type: "ARRAY",
            items: {
              type: "STRING",
            },
          },

          recommendedActions: {
            type: "ARRAY",
            items: {
              type: "STRING",
            },
          },

          notes: {
            type: "STRING",
          },
        },

        required: [
          "diagnosis",
          "severity",
          "confidence",
          "description",
          "causes",
          "recommendedActions",
          "notes",
        ],
      },
    },
  };

  try {
    const result = await callGemini(
      geminiApiKey,
      geminiBody,
    );

    modelText = result.text;
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "UNKNOWN_ERROR";

    console.error(
      "Gemini analyze-crop error:",
      errorMessage,
    );

    /* ------------------------------------------------------------ */
    /* Immediate OpenRouter fallback on Gemini 429                  */
    /* ------------------------------------------------------------ */

    if (errorMessage === "GEMINI_RATE_LIMIT") {
      const openRouterApiKey =
        Deno.env.get("OPENROUTER_API_KEY");

      if (!openRouterApiKey) {
        console.error(
          "OPENROUTER_API_KEY is not configured.",
        );

        return json(
          {
            success: false,
            error:
              "The AI request limit was reached and the backup AI service is not configured yet. Please try again shortly.",
          },
          502,
          req,
        );
      }

      console.log(
        "Gemini rate limit reached. Switching immediately to OpenRouter.",
      );

      try {
        const fallback =
          await callOpenRouter(
            openRouterApiKey,
            prompt,
            base64,
            contentType,
          );

        modelText = fallback.text;
        provider = "openrouter";

        console.log(
          "analyze-crop fallback succeeded using OpenRouter.",
        );
      } catch (fallbackError) {
        console.error(
          "OpenRouter fallback error:",
          fallbackError instanceof Error
            ? fallbackError.message
            : fallbackError,
        );

        return json(
          {
            success: false,
            error:
              "The AI couldn't analyze this photo right now. Please try again.",
          },
          502,
          req,
        );
      }
    } else {
      return json(
        {
          success: false,
          error:
            "The AI couldn't analyze this photo right now. Please try again.",
        },
        502,
        req,
      );
    }
  }

  /* -------------------------------------------------------------- */
  /* Parse diagnosis                                                */
  /* -------------------------------------------------------------- */

  const parsed =
    parseDiagnosis(modelText);

  if (!parsed) {
    console.error(
      `${provider} parse failure. Raw:`,
      modelText.slice(0, 1000),
    );

    return json(
      {
        success: false,
        error:
          "The AI returned an unexpected result. Please try another photo.",
      },
      502,
      req,
    );
  }

  /* -------------------------------------------------------------- */
  /* Supabase admin client                                          */
  /* -------------------------------------------------------------- */

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") ?? "";

  const serviceRoleKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    ) ?? "";

  const supabaseAdmin = createClient(
    supabaseUrl,
    serviceRoleKey,
  );

  /* -------------------------------------------------------------- */
  /* Farm ownership                                                 */
  /* -------------------------------------------------------------- */

  if (farmId) {
    const { data: farmRow } =
      await supabaseAdmin
        .from("farms")
        .select("user_id")
        .eq("id", farmId)
        .maybeSingle();

    const token = auth
      .slice("Bearer ".length)
      .trim();

    const { data: caller } =
      await supabaseAdmin.auth.getUser(
        token,
      );

    const callerId =
      caller?.user?.id ?? null;

    if (
      !farmRow ||
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
  }

  /* -------------------------------------------------------------- */
  /* Persist diagnosis                                              */
  /* -------------------------------------------------------------- */

  const insertPayload: Record<
    string,
    unknown
  > = {
    crop: cropName,
    diagnosis: parsed.diagnosis,
    severity: parsed.severity,
    confidence: parsed.confidence,
    description: parsed.description,
    causes: parsed.causes,
    recommended_actions:
      parsed.recommendedActions,
    notes: parsed.notes,
    image_url: imageUrl,
  };

  if (farmId) {
    insertPayload.farm_id = farmId;
  }

  const { data: row, error } =
    await supabaseAdmin
      .from("diagnoses")
      .insert(insertPayload)
      .select()
      .single();

  if (error) {
    console.error(
      "Diagnosis insert error:",
      error,
    );

    return json(
      {
        success: false,
        error:
          "We analyzed the photo but couldn't save the result. Please try again.",
      },
      502,
      req,
    );
  }

  /* -------------------------------------------------------------- */
  /* Success                                                         */
  /* -------------------------------------------------------------- */

  return json(
    {
      success: true,
      diagnosis: row,
    },
    200,
    req,
  );
});