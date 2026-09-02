import { Link } from "react-router-dom";
import { Sprout } from "lucide-react";
import { usePreferences } from "../../context/PreferencesContext";
import { LanguageToggle, ThemeToggle } from "../layout/preference-controls";

/**
 * Shared shell for the authentication pages (login / signup / forgot & reset
 * password). Centers the branded card on a subtle gradient background and
 * restores the Language + Theme toggles so visitors can switch English/Urdu
 * and Light/Dark without losing their preferences between the landing page and
 * the auth screens.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { t } = usePreferences();

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4 py-10 sm:px-6">
      {/* Premium background wash */}
      <div className="pointer-events-none absolute inset-0 bg-hero-wash" aria-hidden="true" />
      <div className="relative flex w-full max-w-md flex-col items-center">
        {/* Brand mark */}
        <Link
          to="/"
          className="mb-8 flex items-center gap-2.5 cursor-pointer"
          aria-label={t("brand.name")}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-deep text-primary-foreground shadow-lift ring-1 ring-inset ring-white/10">
            <Sprout className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="font-heading text-xl font-bold tracking-tight text-foreground">
            {t("brand.name")}
          </span>
        </Link>

        <div className="w-full">
          <div className="card-sheen rounded-2xl border border-border bg-card p-6 shadow-lift sm:p-8">
            <header className="mb-6 space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span className="h-1 w-5 rounded-full bg-accent" aria-hidden="true" />
                <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  {title}
                </h1>
              </div>
              {subtitle ? (
                <p className="pl-7 text-sm leading-relaxed text-muted-foreground">
                  {subtitle}
                </p>
              ) : null}
            </header>

            {children}
          </div>

          {footer ? (
            <div className="mt-6 flex flex-col items-center gap-2 text-center">
              {footer}
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <LanguageToggle />
            <ThemeToggle />
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {t("auth.rememberFor")} · {t("auth.languageNote")}
          </p>
        </div>
      </div>
    </div>
  );
}