import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * sarvam-stt
 *
 * Secure proxy for Sarvam AI Speech-to-Text REST API.
 *
 * Security model:
 *  - The SARVAM_API_KEY lives ONLY in Supabase Edge Function secrets;
 *    it never reaches the browser.
 *  - The browser uploads audio to this function, which forwards it to
 *    Sarvam with the server-side API key.
 *  - CORS is handled because this is always called from the browser.
 *  - Lightweight Bearer JWT validation (anon-based app).
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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** Map Sarvam API errors to user-friendly messages. */
function friendlyError(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return "Voice recognition isn't set up correctly. Please try again later or type your question.";
  }
  if (status === 413) {
    return "Your recording is too long. Please try a shorter question.";
  }
  if (status === 429) {
    return "Voice recognition is busy right now. Wait a moment and try again, or type your question instead.";
  }
  if (status === 400) {
    // Check if it's a language/format issue
    if (body.toLowerCase().includes("language") || body.toLowerCase().includes("unsupported")) {
      return "Voice recognition for this language isn't available. You can type your question instead.";
    }
    return "We couldn't process your recording. Please try again or type your question.";
  }
  return "Voice recognition is temporarily unavailable. Please try again or type your question.";
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
      { error: "This request is not authorized. Please try again." },
      401
    );
  }

  const apiKey = Deno.env.get("SARVAM_API_KEY");
  if (!apiKey) {
    console.error("sarvam-stt: SARVAM_API_KEY is not configured");
    return json(
      {
        error:
          "Voice recognition isn't set up yet. Please try again later or type your question.",
      },
      503
    );
  }

  // Parse the incoming multipart form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err) {
    console.error("sarvam-stt: failed to parse form data", err);
    return json(
      { error: "Invalid request format. Please try again." },
      400
    );
  }

  const audioFile = formData.get("file");
  if (!audioFile || !(audioFile instanceof Blob)) {
    return json(
      { error: "No audio file provided. Please record your question." },
      400
    );
  }

  const languageCode = formData.get("language_code")?.toString() ?? "auto";
  const model = formData.get("model")?.toString() ?? "saaras:v3";
  const mode = formData.get("mode")?.toString() ?? "transcribe";

  // Build the multipart form data for Sarvam
  const sarvamFormData = new FormData();
  sarvamFormData.append("file", audioFile, "audio.wav");
  sarvamFormData.append("model", model);
  sarvamFormData.append("mode", mode);
  sarvamFormData.append("language_code", languageCode);

  // Forward to Sarvam STT API
  let resp: Response;
  try {
    resp = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey,
      },
      body: sarvamFormData,
    });
  } catch (err) {
    console.error("sarvam-stt: network error", err);
    return json(
      {
        error:
          "Voice recognition is temporarily unavailable. Please try again.",
      },
      502
    );
  }

  const respBody = await resp.text();

  if (!resp.ok) {
    console.error(
      "sarvam-stt: provider error",
      resp.status,
      respBody.slice(0, 300)
    );
    return json({ error: friendlyError(resp.status, respBody) }, resp.status);
  }

  // Parse Sarvam response
  let data: {
    transcript?: string;
    language_code?: string;
    request_id?: string;
  };
  try {
    data = JSON.parse(respBody);
  } catch {
    console.error("sarvam-stt: invalid JSON response", respBody.slice(0, 300));
    return json(
      { error: "Voice recognition returned an invalid response. Please try again." },
      502
    );
  }

  const transcript = data.transcript ?? "";
  if (!transcript) {
    return json(
      {
        error:
          "We couldn't hear a clear question. Please try again or type it.",
      },
      200
    );
  }

  return json({
    transcript,
    language_code: data.language_code ?? null,
    request_id: data.request_id ?? null,
  });
});
