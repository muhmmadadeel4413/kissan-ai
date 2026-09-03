import { CloudOff, Database, RefreshCw, Settings2, Sprout } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { supabaseConfigError } from "../../lib/supabase";

/**
 * Friendly full-screen state shown when the Supabase integration isn't
 * configured yet (missing/invalid VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY).
 *
 * Without this, every feature page would crash — the old module-load throw in
 * supabase.ts white-screened even the landing page. This screen explains what
 * is missing and exactly what to do next, so the failure is never a mystery.
 */
export function SupabaseSetupScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Sprout className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Kissan AI
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Smart farming, simplified</p>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="mb-4 flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
                <CloudOff className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-foreground">
                  Let's connect your farm's database
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  This app needs a Supabase connection to store your farm data, sign you
                  in, and run the AI features. Right now that connection isn't configured.
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-border bg-muted p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Database className="h-3.5 w-3.5" aria-hidden="true" />
                What's missing
              </p>
              <p className="text-sm leading-relaxed text-foreground">
                {supabaseConfigError ??
                  "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set."}
              </p>
            </div>

            <ol className="mb-5 space-y-2.5 text-sm text-foreground">
              {[
                "Open the Environment settings panel for this project.",
                "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (from your Supabase project settings), or link the Supabase project in the integrations menu.",
                "Restart the preview server so Vite re-reads the variables.",
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>

            <Button
              type="button"
              variant="default"
              className="w-full"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Restart / refresh the app
            </Button>
            <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <Settings2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              After adding the variables, this screen disappears automatically — no code
              changes needed.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
