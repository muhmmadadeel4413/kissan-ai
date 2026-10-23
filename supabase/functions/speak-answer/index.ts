
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

function jsonResponse(
  req: Request,
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsForOrigin(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsForOrigin(req),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      req,
      { error: "Method not allowed" },
      405,
    );
  }

  // Match the existing analyze-crop request pattern.
  // Supabase's gateway should continue validating JWTs normally.
  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token || token.split(".").length !== 3) {
    return jsonResponse(
      req,
      { error: "Unauthorized. Please sign in and try again." },
      401,
    );
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      console.error("GEMINI_API_KEY secret is missing.");

      return jsonResponse(
        req,
        { error: "The voice service is not configured." },
        500,
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        req,
        { error: "Invalid JSON request body." },
        400,
      );
    }

    if (!isRecord(body)) {
      return jsonResponse(
        req,
        { error: "Invalid request body." },
        400,
      );
    }

    const text = body.text;
    const language = body.language ?? "ur";

    if (typeof text !== "string" || !text.trim()) {
      return jsonResponse(
        req,
        { error: "Text is required." },
        400,
      );
    }

    const cleanText = text.trim();

    if (cleanText.length > 2500) {
      return jsonResponse(
        req,
        { error: "Text must be 2500 characters or fewer." },
        400,
      );
    }

    if (!["en", "ur", "pa"].includes(String(language))) {
      return jsonResponse(
        req,
        { error: "Unsupported language. Use en, ur, or pa." },
        400,
      );
    }

    const style =
      language === "en"
        ? "Speak clearly and naturally in English."
        : language === "pa"
          ? "Speak clearly and naturally in Punjabi."
          : "Speak clearly and naturally in Pakistani Urdu.";

    let response: Response;

    try {
      response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            model: "gemini-3.8-flash-tts",
            input: [
              {
                type: "user_input",
                content: [
                  {
                    type: "text",
                    text: cleanText,
                    annotations: [
                      {
                        type: "speech_metadata",
                        style,
                      },
                    ],
                  },
                ],
              },
            ],
            response_format: { type: "audio" },
            generation_config: {
              speech_config: [{ voice: "Kore" }],
            },
          }),
          signal: AbortSignal.timeout(60000),
        },
      );
    } catch (error) {
      console.error("Gemini TTS network/timeout error:", error);

      return jsonResponse(
        req,
        { error: "The voice service could not be reached. Please try again." },
        502,
      );
    }

    let result: unknown;

    try {
      result = await response.json();
    } catch (error) {
      console.error("Gemini TTS returned invalid JSON:", error);

      return jsonResponse(
        req,
        { error: "The voice service returned an invalid response." },
        502,
      );
    }

    if (!response.ok) {
      // Keep the detailed provider error in server logs, not in the UI.
      console.error(
        "Gemini TTS HTTP error:",
        response.status,
        JSON.stringify(result).slice(0, 1500),
      );

      return jsonResponse(
        req,
        {
          error: "Gemini TTS request failed.",
          providerStatus: response.status,
        },
        502,
      );
    }

    const steps =
      isRecord(result) && Array.isArray(result.steps)
        ? result.steps
        : [];

    let audioBase64: string | null = null;

    for (const step of steps) {
      if (
        !isRecord(step) ||
        step.type !== "model_output" ||
        !Array.isArray(step.content)
      ) {
        continue;
      }

      for (const item of step.content) {
        if (
          isRecord(item) &&
          item.type === "audio" &&
          typeof item.data === "string" &&
          item.data.length > 0
        ) {
          audioBase64 = item.data;
        }
      }
    }

    if (!audioBase64) {
      console.error(
        "Gemini TTS returned no audio data:",
        JSON.stringify(result).slice(0, 1500),
      );

      return jsonResponse(
        req,
        { error: "No audio was returned by Gemini TTS." },
        502,
      );
    }

    return jsonResponse(req, {
      audioBase64,
      mimeType: "audio/wav",
    });
  } catch (error) {
    console.error("speak-answer unexpected error:", error);

    return jsonResponse(
      req,
      { error: "Internal voice service error." },
      500,
    );
  }
});
