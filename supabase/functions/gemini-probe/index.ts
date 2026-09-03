import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Temporary diagnostic probe — now disabled. Responds 403 to all non-OPTIONS
// requests so it cannot be used to inspect the project's Gemini configuration.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return new Response(JSON.stringify({ error: "This diagnostic endpoint is disabled." }), {
    status: 403,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
