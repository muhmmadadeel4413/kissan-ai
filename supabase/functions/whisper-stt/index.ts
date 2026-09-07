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

const WHISPER_MODEL = "whisper-large-v3-turbo";

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
  status = 200,
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
    return "Voice recognition isn't configured correctly. Please try again later or type your question.";
  }

  if (status === 413) {
    return "Your recording is too large. Please record a shorter question.";
  }

  if (status === 429) {
    return "Voice recognition is busy right now. Please wait a moment and try again.";
  }

  if (status === 400) {
    if (
      lowerBody.includes("language") ||
      lowerBody.includes("unsupported")
    ) {
      return "Voice recognition for this language isn't available. Please type your question instead.";
    }

    return "We couldn't process your recording. Please try again.";
  }

  if (status >= 500) {
    return "Voice recognition is temporarily unavailable. Please try again.";
  }

  return "We couldn't recognize your voice. Please try again or type your question.";
}

function normalizeLanguage(rawLanguage: string): string | null {
  const language = rawLanguage.trim().toLowerCase();

  const languageMap: Record<string, string> = {
    urdu: "ur",
    ur: "ur",
    "ur-pk": "ur",
    "ur-in": "ur",

    punjabi: "pa",
    pa: "pa",
    "pa-pk": "pa",
    "pa-in": "pa",

    english: "en",
    en: "en",
    "en-us": "en",
    "en-gb": "en",
    "en-in": "en",
  };

  if (
    language === "" ||
    language === "auto" ||
    language === "unknown"
  ) {
    return null;
  }

  return languageMap[language] ?? null;
}

function containsDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

function containsUrduScript(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

Deno.serve(async (req: Request) => {
  // ---------------------------------------------------------
  // CORS
  // ---------------------------------------------------------

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsForOrigin(req),
    });
  }

  // ---------------------------------------------------------
  // Method validation
  // ---------------------------------------------------------

  if (req.method !== "POST") {
    return json(
      req,
      {
        error: "Method not allowed.",
      },
      405,
    );
  }

  // ---------------------------------------------------------
  // Lightweight JWT validation
  // ---------------------------------------------------------

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
      401,
    );
  }

  // ---------------------------------------------------------
  // API key
  // ---------------------------------------------------------

  const apiKey = Deno.env.get("GROQ_API_KEY");

  if (!apiKey) {
    console.error(
      "whisper-stt: GROQ_API_KEY is not configured",
    );

    return json(
      req,
      {
        error:
          "Voice recognition isn't set up yet. Please try again later.",
      },
      503,
    );
  }

  // ---------------------------------------------------------
  // Parse multipart form data
  // ---------------------------------------------------------

  let formData: FormData;

  try {
    formData = await req.formData();
  } catch (error) {
    console.error(
      "whisper-stt: failed to parse form data",
      error,
    );

    return json(
      req,
      {
        error:
          "Invalid audio request. Please try again.",
      },
      400,
    );
  }

  const audioFile = formData.get("file");

  if (!(audioFile instanceof Blob)) {
    return json(
      req,
      {
        error:
          "No audio file provided. Please record your question.",
      },
      400,
    );
  }

  // ---------------------------------------------------------
  // Language
  // ---------------------------------------------------------

  const rawLanguage =
    formData.get("language_code")?.toString()?.trim() ||
    "unknown";

  // Saraiki intentionally unsupported for STT
  if (rawLanguage.toLowerCase() === "saraiki") {
    return json(
      req,
      {
        error:
          "Saraiki voice recognition is not available yet. Please type your question instead.",
      },
      400,
    );
  }

  const language = normalizeLanguage(rawLanguage);

  // ---------------------------------------------------------
  // Validate file size
  // ---------------------------------------------------------

  const MAX_FILE_SIZE = 25 * 1024 * 1024;

  if (audioFile.size > MAX_FILE_SIZE) {
    return json(
      req,
      {
        error:
          "Your recording is too large. Please record a shorter question.",
      },
      413,
    );
  }

  // ---------------------------------------------------------
  // Build Groq multipart request
  // ---------------------------------------------------------

  const groqFormData = new FormData();

  groqFormData.append(
    "file",
    audioFile,
    "audio.wav",
  );

  groqFormData.append(
    "model",
    WHISPER_MODEL,
  );

  groqFormData.append(
    "response_format",
    "json",
  );

  // Keep transcription deterministic
  groqFormData.append(
    "temperature",
    "0",
  );

  // Important:
  // Only send language when the user explicitly selected
  // Urdu, Punjabi, or English.
  //
  // Auto mode leaves the language unspecified so Whisper
  // can detect it.
  if (language) {
    groqFormData.append(
      "language",
      language,
    );
  }

  // ---------------------------------------------------------
  // Language-specific prompts
  // ---------------------------------------------------------

  if (language === "ur") {
    groqFormData.append(
      "prompt",
      "یہ ایک پاکستانی کسان کی آواز ہے۔ جواب کو اردو رسم الخط میں لکھیں۔ زرعی الفاظ، فصل، کھاد، پانی، آبپاشی، بیماری، کیڑے، گندم، کپاس، چاول اور مکئی جیسے الفاظ درست لکھیں۔ اردو کو دیوناگری ہندی رسم الخط میں تبدیل نہ کریں۔",
    );
  } else if (language === "pa") {
    groqFormData.append(
      "prompt",
      "This is a Pakistani Punjabi farmer speaking about agriculture, crops, fertilizer, irrigation, pests, diseases, wheat, cotton, rice and maize. Transcribe the speech in the appropriate Punjabi script and preserve agricultural terminology.",
    );
  } else if (language === "en") {
    groqFormData.append(
      "prompt",
      "This is an agricultural farmer speaking about crops, fertilizer, irrigation, pests, diseases, wheat, cotton, rice and maize. Transcribe accurately and preserve agricultural terminology.",
    );
  } else {
    groqFormData.append(
      "prompt",
      "This is a Pakistani farmer speaking about agriculture, crops, fertilizer, irrigation, pests, diseases, wheat, cotton, rice and maize. Preserve the original spoken language and script. Do not translate the speech into English.",
    );
  }

  // ---------------------------------------------------------
  // Call Groq Whisper
  // ---------------------------------------------------------

  let response: Response;

  try {
    response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: groqFormData,
      },
    );
  } catch (error) {
    console.error(
      "whisper-stt: network error",
      error,
    );

    return json(
      req,
      {
        error:
          "Voice recognition is temporarily unavailable. Please try again.",
      },
      502,
    );
  }

  const responseBody = await response.text();

  // ---------------------------------------------------------
  // Provider error
  // ---------------------------------------------------------

  if (!response.ok) {
    console.error(
      "whisper-stt: Groq provider error",
      response.status,
      responseBody.slice(0, 500),
    );

    return json(
      req,
      {
        error: friendlyError(
          response.status,
          responseBody,
        ),
      },
      response.status,
    );
  }

  // ---------------------------------------------------------
  // Parse response
  // ---------------------------------------------------------

  let data: {
    text?: string;
  };

  try {
    data = JSON.parse(responseBody);
  } catch {
    console.error(
      "whisper-stt: invalid JSON response",
      responseBody.slice(0, 500),
    );

    return json(
      req,
      {
        error:
          "Voice recognition returned an invalid response. Please try again.",
      },
      502,
    );
  }

  const transcript =
    typeof data.text === "string"
      ? data.text.trim()
      : "";

  // ---------------------------------------------------------
  // Empty transcript
  // ---------------------------------------------------------

  if (!transcript) {
    return json(
      req,
      {
        error:
          "We couldn't hear a clear question. Please try again or type it.",
      },
      200,
    );
  }

  // ---------------------------------------------------------
  // Urdu script safety check
  // ---------------------------------------------------------
  //
  // Whisper should return Urdu script when Urdu is selected.
  // This log helps us detect cases where it unexpectedly
  // returns Devanagari.
  //
  // We do NOT automatically translate the transcript here,
  // because changing the transcript can alter the farmer's
  // original meaning.
  // ---------------------------------------------------------

  if (
    language === "ur" &&
    containsDevanagari(transcript) &&
    !containsUrduScript(transcript)
  ) {
    console.warn(
      "whisper-stt: Urdu selected but transcript appears to use Devanagari script",
      {
        transcript_preview: transcript.slice(0, 200),
      },
    );
  }

  // ---------------------------------------------------------
  // Success
  // ---------------------------------------------------------

  console.log(
    "whisper-stt: transcription successful",
    {
      requested_language: rawLanguage,
      detected_language: language ?? "auto",
      transcript_length: transcript.length,
    },
  );

  return json(req, {
    transcript,
    language_code: language ?? null,
    provider: "groq",
    model: WHISPER_MODEL,
  });
});