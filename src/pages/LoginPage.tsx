import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { PasswordField } from "../components/auth/PasswordField";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription } from "../components/ui/alert";
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
    <AuthLayout
      title={t("auth.loginTitle")}
      subtitle={t("auth.loginSubtitle")}
      footer={
        <>
          <span className="text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link
              to="/signup"
              className="font-medium text-primary hover:underline cursor-pointer"
            >
              {t("auth.createAccount")}
            </Link>
          </span>
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

        <Button type="submit" className="w-full" disabled={submitting || loading}>
          {submitting ? t("auth.signingIn") : t("auth.login")}
        </Button>
      </form>
    </AuthLayout>
  );
}