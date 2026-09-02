import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Globe,
  Moon,
  Sun,
  Mail,
  KeyRound,
  LogOut,
  Info,
  Shield,
  HelpCircle,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { PageHeader, SectionHeader } from "../components/layout/page-header";
import { usePreferences } from "../context/PreferencesContext";
import { useAuth } from "../context/AuthContext";
import { LANGUAGE_OPTIONS, Language } from "../lib/i18n";
import { cn } from "../lib/utils";

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */

const APP_VERSION = "1.0.0";

/* ------------------------------------------------------------------ */
/* Settings Page                                                        */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const { t, language, setLanguage, theme, toggleTheme } = usePreferences();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [loggingOut, setLoggingOut] = React.useState(false);
  const [passwordMsg, setPasswordMsg] = React.useState<string | null>(null);

  const dark = theme === "dark";

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch {
      // AuthContext already wraps signOut errors in friendly messages.
    } finally {
      setLoggingOut(false);
    }
  }

  function handleChangePassword() {
    setPasswordMsg(t("settings.passwordResetHint"));
    navigate("/reset-password");
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("page.settings")}
        subtitle={t("settings.subtitle")}
      />

      {/* ============================================================ */}
      {/* Preferences                                                    */}
      {/* ============================================================ */}
      <section className="space-y-4">
        <SectionHeader
          title={t("settings.preferences")}
          subtitle={t("settings.preferencesHint")}
        />

        <Card>
          <CardContent className="divide-y divide-border p-0">
            {/* Language */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
                  <Globe className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("common.language")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.languageHint")}
                  </p>
                </div>
              </div>
              <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
                {LANGUAGE_OPTIONS.map((opt) => {
                  const selected = language === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLanguage(opt.value as Language)}
                      className={cn(
                        "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer",
                        selected
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Theme */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
                  {dark ? (
                    <Moon className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Sun className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("settings.theme")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dark ? t("common.dark") : t("common.light")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                  "relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 cursor-pointer",
                  dark ? "bg-primary" : "bg-muted"
                )}
                aria-pressed={dark}
                aria-label={dark ? t("common.light") : t("common.dark")}
              >
                <span
                  className={cn(
                    "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                    dark ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ============================================================ */}
      {/* Account                                                        */}
      {/* ============================================================ */}
      <section className="space-y-4">
        <SectionHeader
          title={t("settings.account")}
          subtitle={t("settings.accountHint")}
        />

        <Card>
          <CardContent className="divide-y divide-border p-0">
            {/* Email */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("auth.email")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.email ?? "—"}
                  </p>
                </div>
              </div>
              <Badge variant="success">{t("settings.verified")}</Badge>
            </div>

            {/* Change password */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
                  <KeyRound className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("settings.changePassword")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.changePasswordHint")}
                  </p>
                  {passwordMsg ? (
                    <p className="mt-1 text-xs text-primary">{passwordMsg}</p>
                  ) : null}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleChangePassword}>
                {t("settings.resetPassword")}
              </Button>
            </div>

            {/* Sign out */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-soft text-danger ring-1 ring-inset ring-danger/10">
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("auth.logout")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.logoutHint")}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={loggingOut}
                className="border-danger/20 text-danger hover:bg-danger-soft hover:text-danger"
              >
                {loggingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                {loggingOut ? t("common.loading") : t("auth.logout")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ============================================================ */}
      {/* About                                                          */}
      {/* ============================================================ */}
      <section className="space-y-4">
        <SectionHeader
          title={t("settings.about")}
          subtitle={t("settings.aboutHint")}
        />

        <Card>
          <CardContent className="divide-y divide-border p-0">
            {/* Version */}
            <div className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
                  <Info className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("settings.version")}
                  </p>
                </div>
              </div>
              <Badge variant="neutral">v{APP_VERSION}</Badge>
            </div>

            {/* Help / FAQ */}
            <div className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
                  <HelpCircle className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("settings.helpFaq")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.helpFaqHint")}
                  </p>
                </div>
              </div>
            </div>

            {/* Contact support */}
            <div className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
                  <MessageSquare className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("settings.contactSupport")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.contactSupportHint")}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ============================================================ */}
      {/* Danger Zone                                                    */}
      {/* ============================================================ */}
      <section className="space-y-4">
        <SectionHeader title={t("settings.dangerZone")} />

        <Card className="border-danger/20">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger ring-1 ring-inset ring-danger/10">
                  <Shield className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("settings.deleteAccount")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.deleteAccountHint")}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-danger/30 text-danger hover:bg-danger-soft hover:text-danger"
                onClick={() => {
                  // Supabase does not expose client-side account deletion
                  // (requires admin API or RLS trigger). Direct users to
                  // contact support or use the Supabase dashboard.
                  alert(t("settings.deleteAccountMsg"));
                }}
              >
                {t("settings.deleteAccount")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
