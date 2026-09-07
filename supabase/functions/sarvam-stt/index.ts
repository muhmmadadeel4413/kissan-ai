import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    ...BASE_CORS_HEADERS,
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0],
  };
}

function json(
  req: Request,
  data: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsForOrigin(req),
    },
  });
}

function friendlyError(status: number, body: string): string {
  const lowerBody = body.toLowerCase();

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
    if (
      lowerBody.includes("language") ||
      lowerBody.includes("unsupported")
    ) {
      return "Voice recognition for this language isn't available. You can type your question instead.";
    }

    return "We couldn't process your recording. Please try again or type your question.";
  }

  return "Voice recognition is temporarily unavailable. Please try again or type your question.";
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsForOrigin(req),
    });
  }

  // Only POST is supported
  if (req.method !== "POST") {
    return json(
      req,
      { error: "Method not allowed." },
      405
    );
  }

  // Lightweight JWT sanity check
  const auth = req.headers.get("Authorization") ?? "";

  if (
    !auth.startsWith("Bearer ") ||
    auth.split(".").length !== 3
  ) {
    return json(
      req,
      {
        error:
          "This request is not authorized. Please try again.",
      },
      401
    );
  }

  // Sarvam API key must remain server-side
  const apiKey = Deno.env.get("SARVAM_API_KEY");

  if (!apiKey) {
    console.error(
      "sarvam-stt: SARVAM_API_KEY is not configured"
    );

    return json(
      req,
      {
        error:
          "Voice recognition isn't set up yet. Please try again later or type your question.",
      },
      503
    );
  }

  // Parse multipart form data
  let formData: FormData;

  try {
    formData = await req.formData();
  } catch (error) {
    console.error(
      "sarvam-stt: failed to parse form data",
      error
    );

    return json(
      req,
      {
        error:
          "Invalid request format. Please try again.",
      },
      400
    );
  }

  const audioFile = formData.get("file");

  if (!audioFile || !(audioFile instanceof Blob)) {
    return json(
      req,
      {
        error:
          "No audio file provided. Please record your question.",
      },
      400
    );
  }

  const rawLang =
    formData.get("language_code")?.toString()?.trim() ||
    "unknown";

  const requestedModel =
    formData.get("model")?.toString()?.trim() ||
    "saaras:v4";

  const requestedMode =
    formData.get("mode")?.toString()?.trim() ||
    "transcribe";

  // Saraiki is intentionally unsupported for voice recognition.
  if (rawLang.toLowerCase() === "saraiki") {
    return json(
      req,
      {
        error:
          "Saraiki voice recognition is not available yet. Please type your question instead.",
      },
      400
    );
  }

  // Normalize language codes for Sarvam Saaras v4.
  //
  // Sarvam uses "unknown" for automatic language detection.
  const languageMap: Record<string, string> = {
    auto: "unknown",
    unknown: "unknown",

    urdu: "ur-IN",
    ur: "ur-IN",
    "ur-pk": "ur-IN",
    "ur-in": "ur-IN",

    english: "en-IN",
    en: "en-IN",
    "en-us": "en-IN",
    "en-gb": "en-IN",
    "en-in": "en-IN",

    punjabi: "pa-IN",
    pa: "pa-IN",
    "pa-pk": "pa-IN",
    "pa-in": "pa-IN",
  };

  const languageCode =
    languageMap[rawLang.toLowerCase()] || rawLang;

  // Build request for Sarvam
  const sarvamFormData = new FormData();

  sarvamFormData.append(
    "file",
    audioFile,
    "audio.wav"
  );

  sarvamFormData.append(
    "model",
    requestedModel
  );

  sarvamFormData.append(
    "mode",
    requestedMode
  );

  sarvamFormData.append(
    "language_code",
    languageCode
  );

  let response: Response;

  try {
    response = await fetch(
      "https://api.sarvam.ai/speech-to-text",
      {
        method: "POST",
        headers: {
          "api-subscription-key": apiKey,
        },
        body: sarvamFormData,
      }
    );
  } catch (error) {
    console.error(
      "sarvam-stt: network error",
      error
    );

    return json(
      req,
      {
        error:
          "Voice recognition is temporarily unavailable. Please try again.",
      },
      502
    );
  }

  const responseBody = await response.text();

  if (!response.ok) {
    console.error(
      "sarvam-stt: provider error",
      response.status,
      responseBody.slice(0, 500)
    );

    return json(
      req,
      {
        error: friendlyError(
          response.status,
          responseBody
        ),
      },
      response.status
    );
  }

  let data: {
    transcript?: string;
    language_code?: string;
    request_id?: string;
  };

  try {
    data = JSON.parse(responseBody);
  } catch {
    console.error(
      "sarvam-stt: invalid JSON response",
      responseBody.slice(0, 500)
    );

    return json(
      req,
      {
        error:
          "Voice recognition returned an invalid response. Please try again.",
      },
      502
    );
  }

  const transcript =
    typeof data.transcript === "string"
      ? data.transcript.trim()
      : "";

  if (!transcript) {
    return json(
      req,
      {
        error:
          "We couldn't hear a clear question. Please try again or type it.",
      },
      200
    );
  }

  console.log(
    "sarvam-stt: transcription successful",
    {
      language_code: data.language_code ?? null,
      transcript_length: transcript.length,
      request_id: data.request_id ?? null,
    }
  );

  return json(req, {
    transcript,
    language_code:
      data.language_code ?? null,
    request_id:
      data.request_id ?? null,
  });
});