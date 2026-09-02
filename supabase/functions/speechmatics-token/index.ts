import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * speechmatics-token
 *
 * Issues a short-lived real-time Speechmatics JWT for the Voice Assistant.
 *
 * Security model:
 *  - The long-lived SPEECHMATICS_API_KEY lives ONLY in Supabase Edge Function
 *    secrets; it never reaches the browser. This function exchanges it for a
 *    60-second temp key scoped to real-time transcription, which the browser
 *    may use to open the WebSocket.
 *  - verify_jwt is disabled at the platform level (anon-based app); we do a
 *    lightweight Bearer JWT sanity check here, same as the other functions.
 *  - CORS is handled because this is always called from the browser.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
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
      { error: "This request is not authorized. Please try again." },
      401
    );
  }

  const apiKey = Deno.env.get("SPEECHMATICS_API_KEY");
  if (!apiKey) {
    console.error("speechmatics-token: SPEECHMATICS_API_KEY is not configured");
    return json(
      {
        error:
          "Voice recognition isn't set up yet. Please try again later or type your question.",
      },
      503
    );
  }

  // Short-lived real-time temp key (ttl in seconds, 60..3600).
  let resp: Response;
  try {
    resp = await fetch("https://mp.speechmatics.com/v1/api_keys?type=rt", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: 60 }),
    });
  } catch (err) {
    console.error("speechmatics-token: network error", err);
    return json(
      {
        error:
          "Voice recognition is temporarily unavailable. Please try again.",
      },
      502
    );
  }

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(
      "speechmatics-token: provider error",
      resp.status,
      errText.slice(0, 300)
    );
    return json(
      {
        error:
          "Voice recognition is temporarily unavailable. Please try again.",
      },
      502
    );
  }

  const data = (await resp.json()) as { key_value?: string; token?: string };
  const token = data.key_value ?? data.token;
  if (!token) {
    console.error("speechmatics-token: no token in response");
    return json(
      {
        error:
          "Voice recognition is temporarily unavailable. Please try again.",
      },
      502
    );
  }

  return json({ token });
});