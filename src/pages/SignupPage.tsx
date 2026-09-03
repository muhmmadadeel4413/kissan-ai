import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, MailCheck } from "lucide-react";
import { LoginVisualPanel } from "../components/auth/LoginVisualPanel";
import { PasswordField } from "../components/auth/PasswordField";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { LanguageToggle, ThemeToggle } from "../components/layout/preference-controls";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import { useFarm } from "../context/FarmContext";
import { usePostAuthRedirect } from "../hooks/usePostAuthRedirect";

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
  terms?: string;
}

const MIN_PASSWORD = 6;

/**
 * Sign-up page rendered in the same split-screen design language as the
 * login page: the green Kissan AI visual panel on the left and the sign-up
 * form on the right. All existing authentication behaviour is preserved —
 * Supabase sign-up, validation, error handling, email-confirmation state,
 * and post-auth redirects.
 */
export default function SignupPage() {
  const { t } = usePreferences();
  const { signUp, isAuthenticated, loading } = useAuth();
  const { status } = useFarm();
  const navigate = useNavigate();

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [error, setError] = React.useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const redirect = usePostAuthRedirect("login");
  React.useEffect(() => {
    if (redirect.shouldLeaveAuthPage) redirect.go();
  }, [redirect.shouldLeaveAuthPage, redirect.go]);

  React.useEffect(() => {
    if (isAuthenticated && status === "ready" && !submitting) {
      navigate(redirect.target, { replace: true });
    }
  }, [isAuthenticated, status, submitting, navigate, redirect.target]);

  function validate(): boolean {
    const e: FieldErrors = {};
    if (!fullName.trim()) e.name = t("auth.errNameRequired");
    if (!email.trim()) e.email = t("auth.errEmailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = t("auth.errEmailInvalid");
    if (!password) e.password = t("auth.errPasswordRequired");
    else if (password.length < MIN_PASSWORD) e.password = t("auth.errPasswordTooShort");
    if (!confirm) e.confirm = t("auth.errConfirmRequired");
    else if (confirm !== password) e.confirm = t("auth.errPasswordMismatch");
    if (!acceptedTerms) e.terms = t("auth.errTermsRequired");
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await signUp(email.trim(), password, fullName.trim());
      if (result.needsEmailConfirmation) {
        // Do NOT claim the email was verified — Supabase still needs the link.
        setNeedsConfirmation(email.trim());
      }
      // When confirmation is disabled, the returned session is non-null and
      // the redirect effect above lands on Dashboard or Farm Setup.
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.errGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh bg-background">
      {/* LEFT — visual panel (hidden below lg) */}
      <LoginVisualPanel
        titleKey="auth.signupVisualTitle"
        subtitleKey="auth.signupVisualSubtitle"
      />

      {/* RIGHT — sign-up form */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="pointer-events-none absolute inset-0 bg-hero-wash" aria-hidden="true" />

        {/* Preference toggles (shared with the login page) */}
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
          {needsConfirmation ? (
            <>
              <header className="mb-8">
                <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
                  {t("auth.confirmEmailTitle")}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t("auth.signupSubtitle")}
                </p>
              </header>

              <Alert className="border-border bg-background">
                <MailCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                <AlertTitle className="mb-0">{t("auth.confirmEmailTitle")}</AlertTitle>
                <AlertDescription>
                  {t("auth.confirmEmailBody", { email: needsConfirmation })}
                </AlertDescription>
              </Alert>

              <p className="mt-8 text-center text-sm text-muted-foreground">
                <Link
                  to="/login"
                  className="font-medium text-primary hover:underline cursor-pointer"
                >
                  {t("auth.backToLogin")}
                </Link>
              </p>
            </>
          ) : (
            <>
              <header className="mb-8">
                <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
                  {t("auth.signupTitle")}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t("auth.signupSubtitle")}
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
                  <Label htmlFor="fullName">{t("auth.fullName")}</Label>
                  <Input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    className="h-12"
                    placeholder={t("auth.fullNamePlaceholder")}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? "name-error" : undefined}
                  />
                  {fieldErrors.name ? (
                    <p id="name-error" className="text-xs text-danger" role="alert">
                      {fieldErrors.name}
                    </p>
                  ) : null}
                </div>

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
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <PasswordField
                    id="password"
                    autoComplete="new-password"
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

                <div className="space-y-1.5">
                  <Label htmlFor="confirm">{t("auth.confirmPassword")}</Label>
                  <PasswordField
                    id="confirm"
                    autoComplete="new-password"
                    className="h-12"
                    placeholder={t("auth.confirmPasswordPlaceholder")}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.confirm)}
                    aria-describedby={fieldErrors.confirm ? "confirm-error" : undefined}
                  />
                  {fieldErrors.confirm ? (
                    <p id="confirm-error" className="text-xs text-danger" role="alert">
                      {fieldErrors.confirm}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="terms" className="flex cursor-pointer items-start gap-3">
                    <input
                      id="terms"
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-input bg-background accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      aria-invalid={Boolean(fieldErrors.terms)}
                      aria-describedby={fieldErrors.terms ? "terms-error" : undefined}
                    />
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {t("auth.termsPrefix")}{" "}
                      <Link
                        to="/"
                        className="font-medium text-primary hover:underline cursor-pointer"
                      >
                        {t("auth.terms")}
                      </Link>{" "}
                      {t("auth.termsAnd")}{" "}
                      <Link
                        to="/"
                        className="font-medium text-primary hover:underline cursor-pointer"
                      >
                        {t("auth.privacy")}
                      </Link>
                    </span>
                  </label>
                  {fieldErrors.terms ? (
                    <p id="terms-error" className="text-xs text-danger" role="alert">
                      {fieldErrors.terms}
                    </p>
                  ) : null}
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full text-base"
                  disabled={submitting || loading}
                >
                  {submitting ? t("auth.signingUp") : t("auth.signup")}
                </Button>
              </form>

              <p className="mt-8 text-center text-sm text-muted-foreground">
                {t("auth.haveAccount")}{" "}
                <Link
                  to="/login"
                  className="font-medium text-primary hover:underline cursor-pointer"
                >
                  {t("auth.login")}
                </Link>
              </p>
            </>
          )}

          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            {t("auth.rememberFor")} · {t("auth.languageNote")}
          </p>
        </div>
      </div>
    </div>
  );
}
