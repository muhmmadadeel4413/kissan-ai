import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * analyze-crop
 *
 * Securely analyzes a crop photo using the Google Gemini vision API.
 *
 * Security model:
 *  - The Gemini API key lives ONLY in Supabase Edge Function secrets
 *    (GEMINI_API_KEY). It is read here with Deno.env.get and never reaches
 *    the browser.
 *  - The client uploads the photo to the public `crop-images` bucket, then
 *    calls this function with the image URL + farm context. This function
 *    downloads the image, sends it to Gemini, and writes the diagnosis row
 *    using the service role so clients can never inject fake results.
 *  - verify_jwt is disabled at the platform level (this app is anon-based,
 *    no user accounts); we do a lightweight Bearer JWT sanity check here.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "gemini-3.6-flash";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** Chunked base64 encode to avoid call-stack limits on large images. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Extract a structured diagnosis object from Gemini's JSON text. */
function parseDiagnosis(text: string): {
  diagnosis: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  description: string;
  causes: string[];
  recommendedActions: string[];
  notes: string;
} | null {
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== "object") return null;
    const severity = ["low", "medium", "high"].includes(raw.severity)
      ? raw.severity
      : "medium";
    return {
      diagnosis: String(raw.diagnosis ?? "Condition detected").slice(0, 300),
      severity,
      confidence: Math.max(0, Math.min(100, Number(raw.confidence) || 0)),
      description: String(raw.description ?? "").slice(0, 2000),
      causes: Array.isArray(raw.causes)
        ? raw.causes.map((c: unknown) => String(c)).slice(0, 8)
        : [],
      recommendedActions: Array.isArray(raw.recommendedActions)
        ? raw.recommendedActions.map((a: unknown) => String(a)).slice(0, 8)
        : [],
      notes: String(raw.notes ?? "").slice(0, 1000),
    };
  } catch {
    return null;
  }
}

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
          "AI diagnosis is not configured yet. Add the Gemini API key in the project settings to enable the Crop Doctor.",
      },
      503
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
      { success: false, error: "We couldn't read your request. Please try again." },
      400
    );
  }

  const { imageUrl, farmId, growthStage, variety, location } = body ?? {};
  const cropName = (body?.cropName ?? "crop").trim().slice(0, 120) || "crop";

  if (!imageUrl) {
    return json(
      { success: false, error: "No photo was provided. Please upload one first." },
      400
    );
  }

  // Download the stored image.
  let imageResp: Response;
  try {
    imageResp = await fetch(imageUrl);
  } catch {
    return json(
      { success: false, error: "We couldn't retrieve your photo. Please try again." },
      502
    );
  }
  if (!imageResp.ok) {
    return json(
      { success: false, error: "We couldn't retrieve your photo. Please try again." },
      502
    );
  }
  const contentType = imageResp.headers.get("content-type") ?? "image/jpeg";
  const imageBytes = new Uint8Array(await imageResp.arrayBuffer());
  const base64 = bytesToBase64(imageBytes);

  const contextBits = [
    cropName ? `- Crop: ${cropName}` : null,
    growthStage ? `- Growth stage: ${growthStage}` : null,
    variety ? `- Variety: ${variety}` : null,
    location ? `- Location: ${location}` : null,
  ].filter(Boolean);

  const systemContext =
    contextBits.length > 0
      ? `The photo is of ${cropName} on a farm in South Asia (e.g. Pakistan).\nContext provided by the farmer:\n${contextBits.join("\n")}`
      : `The photo is of a crop on a farm in South Asia (e.g. Pakistan). No additional context was provided.`;

  const prompt = `You are a trusted crop-health expert for smallholder farmers in South Asia (Pakistan). You diagnose plant problems from photos.

${systemContext}

Look carefully at the photo of the crop/leaf. Identify the most likely problem. Respond ONLY with JSON matching the schema below. Be honest and careful: if the image is unclear or you cannot confidently identify a specific problem, say so in "diagnosis" (e.g. "Unclear — could not confidently identify") and set confidence low.

Schema:
{
  "diagnosis": "short human-readable name of the likely problem",
  "severity": "low" | "medium" | "high",
  "confidence": 0-100 integer,
  "description": "2-4 clear sentences for a non-expert farmer explaining what this is and why it matters",
  "causes": ["likely cause 1", "likely cause 2"],
  "recommendedActions": ["simple, affordable, safe action 1", "action 2", "action 3"],
  "notes": "Any important caveat, e.g. when to consult a local agricultural officer. Always remind that this is AI guidance, not a substitute for a professional."
}`;

  const geminiResp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: contentType, data: base64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              diagnosis: { type: "STRING" },
              severity: { type: "STRING", enum: ["low", "medium", "high"] },
              confidence: { type: "INTEGER" },
              description: { type: "STRING" },
              causes: { type: "ARRAY", items: { type: "STRING" } },
              recommendedActions: { type: "ARRAY", items: { type: "STRING" } },
              notes: { type: "STRING" },
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
      }),
    }
  );

  if (!geminiResp.ok) {
    const errText = await geminiResp.text();
    console.error("Gemini error:", geminiResp.status, errText);
    return json(
      { success: false, error: "The AI couldn't analyze this photo right now. Please try again." },
      502
    );
  }

  const geminiData = await geminiResp.json();
  const text =
    geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const parsed = parseDiagnosis(text);

  if (!parsed) {
    console.error("Gemini parse failure. Raw:", text.slice(0, 500));
    return json(
      { success: false, error: "The AI returned an unexpected result. Please try another photo." },
      502
    );
  }

  // Persist via the service role so clients can't forge diagnosis history.
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Ownership: when a farm is supplied, the caller must be the farm's owner.
  if (farmId) {
    const { data: farmRow } = await supabaseAdmin
      .from("farms")
      .select("user_id")
      .eq("id", farmId)
      .maybeSingle();

    const token = auth.slice("Bearer ".length).trim();
    const { data: caller } = await supabaseAdmin.auth.getUser(token);
    const callerId = caller?.user?.id ?? null;

    if (!farmRow || !callerId || farmRow.user_id !== callerId) {
      return json(
        { success: false, error: "You don't have access to that farm." },
        403
      );
    }
  }

  const insertPayload: Record<string, unknown> = {
    crop: cropName,
    diagnosis: parsed.diagnosis,
    severity: parsed.severity,
    confidence: parsed.confidence,
    description: parsed.description,
    causes: parsed.causes,
    recommended_actions: parsed.recommendedActions,
    notes: parsed.notes,
    image_url: imageUrl,
  };
  if (farmId) insertPayload.farm_id = farmId;

  const { data: row, error } = await supabaseAdmin
    .from("diagnoses")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("Diagnosis insert error:", error);
    return json(
      { success: false, error: "We analyzed the photo but couldn't save the result. Please try again." },
      502
    );
  }

  return json({ success: true, diagnosis: row });
});