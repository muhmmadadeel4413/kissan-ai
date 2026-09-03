import * as React from "react";
import { Link } from "react-router-dom";
import {
  HelpCircle,
  Info,
  KeyRound,
  LifeBuoy,
  LogOut,
  Mail,
  ShieldAlert,
  UserCircle,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { PageHeader } from "../components/layout/page-header";
import { LanguageToggle, ThemeToggle } from "../components/layout/preference-controls";
import { LogoutButton } from "../components/auth/LogoutButton";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/PreferencesContext";

/**
 * Settings page — preferences (language + theme), account, and about.
 * Preferences are persisted by the PreferencesProvider; account actions go
 * through the real Supabase auth context (never fabricated).
 */
export default function SettingsPage() {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const [busy, setBusy] = React.useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
      window.location.href = "/";
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader title={t("page.settings")} subtitle={t("settings.subtitle")} />

      {/* Preferences */}
      <section className="space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("settings.preferences")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("settings.preferencesHint")}</p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-5 py-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{t("common.language")}</p>
              <p className="text-xs text-muted-foreground/80">{t("settings.languageHint")}</p>
              <LanguageToggle />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{t("settings.theme")}</p>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Account */}
      <section className="space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("settings.account")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("settings.accountHint")}</p>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <UserCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {user?.email ?? "—"}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  {user?.email_confirmed_at || user?.confirmed_at ? (
                    <Badge variant="success">{t("settings.verified")}</Badge>
                  ) : (
                    t("settings.accountHint")
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button asChild variant="outline" size="sm">
                <Link to="/reset-password">
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  {t("settings.changePassword")}
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleSignOut()} disabled={busy}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {busy ? t("common.loading") : t("auth.logout")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* About */}
      <section className="space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("settings.about")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("settings.aboutHint")}</p>
          </CardHeader>
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Info className="h-4 w-4 text-primary" aria-hidden="true" />
                {t("settings.version")}
              </span>
              <span className="text-sm text-muted-foreground">1.0.0</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <HelpCircle className="h-4 w-4 text-primary" aria-hidden="true" />
                {t("settings.helpFaq")}
              </span>
              <Button asChild variant="ghost" size="sm">
                <Link to="/#faq">{t("settings.helpFaqHint")}</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <LifeBuoy className="h-4 w-4 text-primary" aria-hidden="true" />
                {t("settings.contactSupport")}
              </span>
              <Button asChild variant="ghost" size="sm">
                <a href="mailto:support@kissan.ai">{t("settings.contactSupportHint")}</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Danger zone */}
      <section className="space-y-3">
        <Card className="border-danger/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-danger">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              {t("settings.dangerZone")}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <div className="flex flex-col gap-3 rounded-xl border border-danger/20 bg-danger-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t("settings.deleteAccount")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("settings.deleteAccountMsg")}
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <a href="mailto:support@kissan.ai?subject=Account%20deletion%20request">
                  {t("settings.contactSupport")}
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Standalone logout also available at the bottom for discoverability */}
      <div className="max-w-xs">
        <LogoutButton />
      </div>
    </div>
  );
}
