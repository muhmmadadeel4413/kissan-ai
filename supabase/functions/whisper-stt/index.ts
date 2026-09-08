import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * whisper-stt
 *
 * Kissan AI Speech-to-Text Edge Function.
 *
 * Flow:
 * Browser
 *   ↓
 * whisper-stt
 *   ↓
 * Groq API
 *   ↓
 * Whisper Large V3 Turbo
 *   ↓
 * transcript
 *
 * Notes:
 * - Groq API key stays server-side.
 * - Urdu, Punjabi, and English are supported.
 * - Saraiki voice recognition is intentionally unsupported.
 * - Automatic language detection is used when no supported
 *   language is explicitly selected.
 */

// -----------------------------------------------------------------------------
// CORS
// -----------------------------------------------------------------------------

const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",

  // Current production Vercel application
  "https://kissan-ai-six.vercel.app",

  // Previous Vercel deployment retained for compatibility
  "https://kissan-ai-rho.vercel.app",

  // Supabase project origin
  "https://vxldkzrmtygurdggtjro.supabase.co",
];

function corsForOrigin(
  req: Request,
): Record<string, string> {
  const origin =
    req.headers.get("origin") ?? "";

  const headers: Record<string, string> = {
    ...BASE_CORS_HEADERS,
  };

  /**
   * Only explicitly allowed origins receive
   * Access-Control-Allow-Origin.
   *
   * IMPORTANT:
   * Unknown origins do NOT fall back to localhost.
   */
  if (
    origin &&
    ALLOWED_ORIGINS.includes(origin)
  ) {
    headers[
      "Access-Control-Allow-Origin"
    ] = origin;

    headers["Vary"] = "Origin";
  }

  return headers;
}

// -----------------------------------------------------------------------------
// JSON response helper
// -----------------------------------------------------------------------------

function json(
  req: Request,
  data: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
        ...corsForOrigin(req),
      },
    },
  );
}

// -----------------------------------------------------------------------------
// Friendly provider errors
// -----------------------------------------------------------------------------

function friendlyError(
  status: number,
  body: string,
): string {
  const lowerBody =
    body.toLowerCase();

  if (
    status === 401 ||
    status === 403
  ) {
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

  return "We couldn't recognize your voice. Please try again or type it.";
}

// -----------------------------------------------------------------------------
// Language normalization
// -----------------------------------------------------------------------------

function normalizeLanguage(
  rawLanguage: string,
): string | null {
  const language =
    rawLanguage
      .trim()
      .toLowerCase();

  const languageMap:
    Record<string, string> = {
      // Urdu
      urdu: "ur",
      ur: "ur",
      "ur-pk": "ur",
      "ur-in": "ur",

      // Punjabi
      punjabi: "pa",
      pa: "pa",
      "pa-pk": "pa",
      "pa-in": "pa",

      // English
      english: "en",
      en: "en",
      "en-us": "en",
      "en-gb": "en",
      "en-in": "en",
    };

  /**
   * null means automatic language detection.
   */
  if (
    language === "" ||
    language === "auto" ||
    language === "unknown"
  ) {
    return null;
  }

  return (
    languageMap[language] ??
    null
  );
}

// -----------------------------------------------------------------------------
// Script detection helpers
// -----------------------------------------------------------------------------

function containsDevanagari(
  text: string,
): boolean {
  return /[\u0900-\u097F]/.test(
    text,
  );
}

function containsUrduScript(
  text: string,
): boolean {
  return /[\u0600-\u06FF]/.test(
    text,
  );
}

// -----------------------------------------------------------------------------
// Whisper model
// -----------------------------------------------------------------------------

const WHISPER_MODEL =
  "whisper-large-v3-turbo";

// -----------------------------------------------------------------------------
// Main handler
// -----------------------------------------------------------------------------

Deno.serve(
  async (req: Request) => {
    // -------------------------------------------------------------------------
    // CORS preflight
    // -------------------------------------------------------------------------

    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers:
          corsForOrigin(req),
      });
    }

    // -------------------------------------------------------------------------
    // Method validation
    // -------------------------------------------------------------------------

    if (req.method !== "POST") {
      return json(
        req,
        {
          error:
            "Method not allowed.",
        },
        405,
      );
    }

    // -------------------------------------------------------------------------
    // Lightweight JWT sanity check
    // -------------------------------------------------------------------------

    const auth =
      req.headers.get(
        "Authorization",
      ) ?? "";

    const token =
      auth
        .slice(
          "Bearer ".length,
        )
        .trim();

    if (
      !auth.startsWith(
        "Bearer ",
      ) ||
      token.split(".").length !== 3
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

    // -------------------------------------------------------------------------
    // Groq API key
    // -------------------------------------------------------------------------

    const apiKey =
      Deno.env.get(
        "GROQ_API_KEY",
      );

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

    // -------------------------------------------------------------------------
    // Parse multipart form data
    // -------------------------------------------------------------------------

    let formData: FormData;

    try {
      formData =
        await req.formData();
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

    // -------------------------------------------------------------------------
    // Audio file
    // -------------------------------------------------------------------------

    const audioFile =
      formData.get("file");

    if (
      !(audioFile instanceof Blob)
    ) {
      return json(
        req,
        {
          error:
            "No audio file provided. Please record your question.",
        },
        400,
      );
    }

    // -------------------------------------------------------------------------
    // Language
    // -------------------------------------------------------------------------

    const rawLanguage =
      formData
        .get("language_code")
        ?.toString()
        .trim() ||
      "unknown";

    // -------------------------------------------------------------------------
    // Saraiki intentionally unsupported
    // -------------------------------------------------------------------------

    if (
      rawLanguage
        .toLowerCase() ===
      "saraiki"
    ) {
      return json(
        req,
        {
          error:
            "Saraiki voice recognition is not available yet. Please type your question instead.",
        },
        400,
      );
    }

    const language =
      normalizeLanguage(
        rawLanguage,
      );

    // -------------------------------------------------------------------------
    // Validate file size
    // -------------------------------------------------------------------------

    const MAX_FILE_SIZE =
      25 * 1024 * 1024;

    if (
      audioFile.size >
      MAX_FILE_SIZE
    ) {
      return json(
        req,
        {
          error:
            "Your recording is too large. Please record a shorter question.",
        },
        413,
      );
    }

    // -------------------------------------------------------------------------
    // Build Groq multipart request
    // -------------------------------------------------------------------------

    const groqFormData =
      new FormData();

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

    /**
     * Keep transcription deterministic.
     */
    groqFormData.append(
      "temperature",
      "0",
    );

    /**
     * Only send a language when the user explicitly
     * selected Urdu, Punjabi, or English.
     *
     * Otherwise Whisper can automatically detect
     * the spoken language.
     */
    if (language) {
      groqFormData.append(
        "language",
        language,
      );
    }

    // -------------------------------------------------------------------------
    // Language-specific prompts
    // -------------------------------------------------------------------------

    if (language === "ur") {
      groqFormData.append(
        "prompt",
        "یہ ایک پاکستانی کسان کی آواز ہے۔ جواب کو اردو رسم الخط میں لکھیں۔ زرعی الفاظ، فصل، کھاد، پانی، آبپاشی، بیماری، کیڑے، گندم، کپاس، چاول اور مکئی جیسے الفاظ درست لکھیں۔ اردو کو دیوناگری ہندی رسم الخط میں تبدیل نہ کریں۔",
      );
    } else if (
      language === "pa"
    ) {
      groqFormData.append(
        "prompt",
        "This is a Pakistani Punjabi farmer speaking about agriculture, crops, fertilizer, irrigation, pests, diseases, wheat, cotton, rice and maize. Transcribe the speech in the appropriate Punjabi script and preserve agricultural terminology.",
      );
    } else if (
      language === "en"
    ) {
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

    // -------------------------------------------------------------------------
    // Call Groq Whisper
    // -------------------------------------------------------------------------

    let response: Response;

    try {
      response = await fetch(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${apiKey}`,
          },
          body:
            groqFormData,
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

    // -------------------------------------------------------------------------
    // Read provider response
    // -------------------------------------------------------------------------

    const responseBody =
      await response.text();

    // -------------------------------------------------------------------------
    // Provider error
    // -------------------------------------------------------------------------

    if (!response.ok) {
      console.error(
        "whisper-stt: Groq provider error",
        response.status,
        responseBody.slice(
          0,
          500,
        ),
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

    // -------------------------------------------------------------------------
    // Parse response
    // -------------------------------------------------------------------------

    let data: {
      text?: string;
    };

    try {
      data =
        JSON.parse(
          responseBody,
        );
    } catch {
      console.error(
        "whisper-stt: invalid JSON response",
        responseBody.slice(
          0,
          500,
        ),
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

    // -------------------------------------------------------------------------
    // Extract transcript
    // -------------------------------------------------------------------------

    const transcript =
      typeof data.text ===
      "string"
        ? data.text.trim()
        : "";

    // -------------------------------------------------------------------------
    // Empty transcript
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // Urdu script safety check
    // -------------------------------------------------------------------------

    /**
     * Whisper should normally return Urdu script when
     * Urdu is explicitly selected.
     *
     * We only log unexpected Devanagari output here.
     *
     * We do NOT automatically translate or modify the
     * transcript because that could change the farmer's
     * original meaning.
     */
    if (
      language === "ur" &&
      containsDevanagari(
        transcript,
      ) &&
      !containsUrduScript(
        transcript,
      )
    ) {
      console.warn(
        "whisper-stt: Urdu selected but transcript appears to use Devanagari script",
        {
          transcript_preview:
            transcript.slice(
              0,
              200,
            ),
        },
      );
    }

    // -------------------------------------------------------------------------
    // Success logging
    // -------------------------------------------------------------------------

    console.log(
      "whisper-stt: transcription successful",
      {
        requested_language:
          rawLanguage,

        detected_language:
          language ?? "auto",

        transcript_length:
          transcript.length,
      },
    );

    // -------------------------------------------------------------------------
    // Final response
    // -------------------------------------------------------------------------

    return json(
      req,
      {
        transcript,

        language_code:
          language ?? null,

        provider: "groq",

        model:
          WHISPER_MODEL,
      },
      200,
    );
  },
);