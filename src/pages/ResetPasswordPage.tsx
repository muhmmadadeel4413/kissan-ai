import * as React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { PasswordField } from "../components/auth/PasswordField";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription } from "../components/ui/alert";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";

interface FieldErrors {
  password?: string;
  confirm?: string;
}

const MIN_PASSWORD = 6;

export default function ResetPasswordPage() {
  const { t } = usePreferences();
  const { updatePassword, isAuthenticated, loading } = useAuth();

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  function validate(): boolean {
    const e: FieldErrors = {};
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
      await updatePassword(password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.errResetFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  // While the recovery session from the email link is resolving, hold off.
  const resolving = loading && !isAuthenticated;

  if (done) {
    return (
      <AuthLayout
        title={t("auth.resetSuccess")}
        footer={
          <Link
            to="/login"
            className="text-sm font-medium text-primary hover:underline cursor-pointer"
          >
            {t("auth.redirectLogin")}
          </Link>
        }
      >
        <Alert className="border-border bg-background">
          <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
          <AlertDescription>{t("auth.resetSuccessBody")}</AlertDescription>
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("auth.resetTitle")}
      subtitle={t("auth.resetSubtitle")}
      footer={
        <Link
          to="/login"
          className="text-sm font-medium text-primary hover:underline cursor-pointer"
        >
          {t("auth.backToLogin")}
        </Link>
      }
    >
      {error ? (
        <Alert variant="danger" className="mb-4">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {resolving ? (
        <p className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          {t("auth.loadingSession")}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">{t("auth.newPassword")}</Label>
            <PasswordField
              id="new-password"
              autoComplete="new-password"
              placeholder={t("auth.newPasswordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? "password-error" : undefined
              }
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
              aria-describedby={
                fieldErrors.confirm ? "confirm-error" : undefined
              }
            />
            {fieldErrors.confirm ? (
              <p id="confirm-error" className="text-xs text-danger" role="alert">
                {fieldErrors.confirm}
              </p>
            ) : null}
          </div>

          <Button type="submit" className="w-full" disabled={submitting || loading}>
            {submitting ? t("auth.updatingPassword") : t("auth.updatePassword")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}