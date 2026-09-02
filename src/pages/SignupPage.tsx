import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, MailCheck } from "lucide-react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { PasswordField } from "../components/auth/PasswordField";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import { useFarm } from "../context/FarmContext";
import { usePostAuthRedirect } from "../hooks/usePostAuthRedirect";

interface FieldErrors {
  email?: string;
  password?: string;
  confirm?: string;
}

const MIN_PASSWORD = 6;

export default function SignupPage() {
  const { t } = usePreferences();
  const { signUp, isAuthenticated, loading } = useAuth();
  const { status } = useFarm();
  const navigate = useNavigate();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
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
    if (!email.trim()) e.email = t("auth.errEmailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = t("auth.errEmailInvalid");
    if (!password) e.password = t("auth.errPasswordRequired");
    else if (password.length < MIN_PASSWORD) e.password = t("auth.errPasswordTooShort");
    if (!confirm) e.confirm = t("auth.errConfirmRequired");
    else if (confirm !== password) e.confirm = t("auth.errPasswordMismatch");
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await signUp(email.trim(), password);
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

  if (needsConfirmation) {
    return (
      <AuthLayout
        title={t("auth.confirmEmailTitle")}
        footer={
          <Link
            to="/login"
            className="text-sm font-medium text-primary hover:underline cursor-pointer"
          >
            {t("auth.backToLogin")}
          </Link>
        }
      >
        <Alert className="border-border bg-background">
          <MailCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <AlertTitle className="mb-0">{t("auth.confirmEmailTitle")}</AlertTitle>
          <AlertDescription>{t("auth.confirmEmailBody", { email: needsConfirmation })}</AlertDescription>
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("auth.signupTitle")}
      subtitle={t("auth.signupSubtitle")}
      footer={
        <>
          <span className="text-sm text-muted-foreground">
            {t("auth.haveAccount")}{" "}
            <Link
              to="/login"
              className="font-medium text-primary hover:underline cursor-pointer"
            >
              {t("auth.login")}
            </Link>
          </span>
          <p className="text-xs text-muted-foreground">{t("auth.signupApproach")}</p>
        </>
      }
    >
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

        <Button type="submit" className="w-full" disabled={submitting || loading}>
          {submitting ? t("auth.signingUp") : t("auth.signup")}
        </Button>
      </form>
    </AuthLayout>
  );
}