import * as React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, MailCheck } from "lucide-react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import { usePostAuthRedirect } from "../hooks/usePostAuthRedirect";

export default function ForgotPasswordPage() {
  const { t } = usePreferences();
  const { resetPasswordForEmail } = useAuth();

  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const redirect = usePostAuthRedirect("login");
  React.useEffect(() => {
    if (redirect.shouldLeaveAuthPage) redirect.go();
  }, [redirect.shouldLeaveAuthPage, redirect.go]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setEmailError(t("auth.errEmailRequired"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError(t("auth.errEmailInvalid"));
      return;
    }
    setEmailError(null);
    setSubmitting(true);
    try {
      // Always show the neutral confirmation to avoid leaking whether the
      // address is registered.
      await resetPasswordForEmail(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.errGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout
        title={t("auth.emailSent")}
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
          <AlertTitle className="mb-0">{t("auth.emailSent")}</AlertTitle>
          <AlertDescription>{t("auth.emailSentBody", { email })}</AlertDescription>
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("auth.forgotTitle")}
      subtitle={t("auth.forgotSubtitle")}
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
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? "email-error" : undefined}
          />
          {emailError ? (
            <p id="email-error" className="text-xs text-danger" role="alert">
              {emailError}
            </p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? t("auth.sendingReset") : t("auth.sendReset")}
        </Button>
      </form>
    </AuthLayout>
  );
}