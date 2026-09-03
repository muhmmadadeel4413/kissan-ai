import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { LoginVisualPanel } from "../components/auth/LoginVisualPanel";
import { PasswordField } from "../components/auth/PasswordField";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription } from "../components/ui/alert";
import { LanguageToggle, ThemeToggle } from "../components/layout/preference-controls";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import { useFarm } from "../context/FarmContext";
import { usePostAuthRedirect } from "../hooks/usePostAuthRedirect";

interface FieldErrors {
  email?: string;
  password?: string;
}

/** Google "G" brand glyph (inline SVG — lucide doesn't ship brand icons). */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

/** Apple brand glyph (inline SVG). */
function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

export default function LoginPage() {
  const { t } = usePreferences();
  const { signIn, isAuthenticated, loading } = useAuth();
  const { status } = useFarm();
  const navigate = useNavigate();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Already authenticated (page reached while logged in) → send to the app.
  const redirect = usePostAuthRedirect("login");
  React.useEffect(() => {
    if (redirect.shouldLeaveAuthPage) redirect.go();
  }, [redirect.shouldLeaveAuthPage, redirect.go]);

  // If the farm resolved while we waited, finalise the redirect.
  React.useEffect(() => {
    if (isAuthenticated && status === "ready" && !submitting) {
      navigate(redirect.target, { replace: true });
    }
  }, [isAuthenticated, status, submitting, navigate, redirect.target]);

  function validate(): boolean {
    const e: FieldErrors = {};
    if (!email.trim()) e.email = t("auth.errEmailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = t("auth.errEmailInvalid");
    if (!password) e.password = t("auth.errPasswordRequired");
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      // Session established — FarmProvider will load the owned farm and the
      // effect above lands on Dashboard or Farm Setup accordingly.
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.errGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  // Social providers are not wired to a backend yet — show an honest message
  // instead of faking authentication (preserves the app's real capabilities).
  function handleSocial(kind: "google" | "apple") {
    setError(t(kind === "google" ? "auth.googleUnavailable" : "auth.appleUnavailable"));
  }

  return (
    <div className="flex min-h-dvh bg-background">
      {/* LEFT — visual panel (hidden below lg) */}
      <LoginVisualPanel />

      {/* RIGHT — login form */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="pointer-events-none absolute inset-0 bg-hero-wash" aria-hidden="true" />

        {/* Preference toggles (restored from the old auth shell) */}
        <div className="absolute end-4 top-4 z-10 flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
        </div>

        {/* Mobile brand mark (panel is hidden on small screens) */}
        <Link
          to="/"
          className="relative z-10 mb-8 flex items-center gap-2.5 self-start lg:hidden cursor-pointer"
          aria-label={t("brand.name")}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-deep text-primary-foreground shadow-lift ring-1 ring-inset ring-white/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M7 20h10" />
              <path d="M10 20c5.5-2.5.8-6.4 3-10" />
              <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
              <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
            </svg>
          </span>
          <span className="font-heading text-xl font-bold tracking-tight text-foreground">
            {t("brand.name")}
          </span>
        </Link>

        <div className="relative z-10 w-full max-w-md">
          <header className="mb-8">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              {t("auth.loginTitle")}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("auth.loginSubtitle")}
            </p>
          </header>

          {error ? (
            <Alert variant="danger" className="mb-4">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                dir="ltr"
                className="h-12"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
              />
              {fieldErrors.email ? (
                <p id="email-error" className="text-xs text-danger" role="alert">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline cursor-pointer"
                >
                  {t("auth.forgotPassword")}
                </Link>
              </div>
              <PasswordField
                id="password"
                autoComplete="current-password"
                className="h-12"
                placeholder={t("auth.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
              />
              {fieldErrors.password ? (
                <p id="password-error" className="text-xs text-danger" role="alert">
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>

            <Button type="submit" className="h-12 w-full text-base" disabled={submitting || loading}>
              {submitting ? t("auth.signingIn") : t("auth.login")}
            </Button>
          </form>

          {/* Divider + social options (visual parity with the reference) */}
          <div className="my-7 flex items-center gap-3" role="separator" aria-label={t("auth.orContinueWith")}>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("auth.orContinueWith")}
            </span>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleSocial("google")}
              className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-input bg-card px-4 text-sm font-semibold text-foreground shadow-soft transition-all duration-150 ease-out hover:bg-muted hover:border-primary/40 active:scale-[0.97] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <GoogleIcon />
              {t("auth.continueWithGoogle")}
            </button>
            <button
              type="button"
              onClick={() => handleSocial("apple")}
              className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-input bg-card px-4 text-sm font-semibold text-foreground shadow-soft transition-all duration-150 ease-out hover:bg-muted hover:border-primary/40 active:scale-[0.97] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <AppleIcon />
              {t("auth.continueWithApple")}
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link
              to="/signup"
              className="font-medium text-primary hover:underline cursor-pointer"
            >
              {t("auth.createAccount")}
            </Link>
          </p>

          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            {t("auth.rememberFor")} · {t("auth.languageNote")}
          </p>
        </div>
      </div>
    </div>
  );
}
