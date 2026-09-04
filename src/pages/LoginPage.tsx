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
