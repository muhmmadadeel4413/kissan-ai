import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, Sprout, X } from "lucide-react";
import { Button } from "../ui/button";
import { usePreferences } from "../../context/PreferencesContext";
import { LanguageToggle, ThemeToggle } from "../layout/preference-controls";

/**
 * Landing navigation.
 *
 * Desktop navbar (per the cleanup spec): Logo | Home | Features | Problem |
 * Solution | Login | Get Started — no overcrowding, CTA prominent.
 *
 * The hamburger / mobile menu retains the full set of landing anchors
 * (Home, Features, How It Works, Problem, Solution) plus About, FAQ and
 * Contact in the secondary group, alongside Language, Theme, Login and the
 * Get Started CTA — so the About / FAQ / Contact sections stay reachable
 * without cluttering the desktop bar.
 */
const DESKTOP_LINKS = [
  { key: "nav.home", href: "#home" },
  { key: "nav.features", href: "#features" },
  { key: "nav.problem", href: "#problem" },
  { key: "nav.solution", href: "#solution" },
];

const MOBILE_PRIMARY_LINKS = [
  { key: "nav.home", href: "#home" },
  { key: "nav.features", href: "#features" },
  { key: "nav.howItWorks", href: "#how-it-works" },
  { key: "nav.problem", href: "#problem" },
  { key: "nav.solution", href: "#solution" },
];

const MOBILE_SECONDARY_LINKS = [
  { key: "nav.about", href: "#about" },
  { key: "nav.faq", href: "#faq" },
  { key: "nav.contact", href: "#contact" },
];

export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const { t } = usePreferences();

  // Close the mobile menu with Escape, matching dialog/drawer conventions.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <nav
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
        aria-label={t("nav.main")}
      >
        <a
          href="#home"
          onClick={close}
          className="flex items-center gap-2.5 shrink-0 cursor-pointer"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sprout className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight text-foreground">
            {t("brand.name")}
          </span>
        </a>

        {/* Desktop links — the clean, uncrowded final navbar */}
        <div className="hidden items-center gap-0.5 lg:flex">
          {DESKTOP_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              {t(link.key)}
            </a>
          ))}
        </div>

        {/* Desktop actions + preferences */}
        <div className="hidden items-center gap-2 lg:flex">
          <LanguageToggle className="hidden xl:flex" />
          <ThemeToggle className="hidden xl:flex" />
          <Link
            to="/login"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:text-primary cursor-pointer"
          >
            {t("nav.login")}
          </Link>
          <Button asChild size="sm" className="whitespace-nowrap">
            <Link to="/signup" onClick={close}>
              {t("nav.getStarted")}
            </Link>
          </Button>
        </div>

        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted cursor-pointer lg:hidden"
          aria-expanded={open}
          aria-controls="landing-mobile-menu"
          aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
        >
          {open ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      </nav>

      {open ? (
        <div
          id="landing-mobile-menu"
          className="border-t border-border bg-card px-4 py-4 shadow-lift lg:hidden"
        >
          <div className="flex flex-col gap-1">
            {MOBILE_PRIMARY_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={close}
                className="rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
              >
                {t(link.key)}
              </a>
            ))}

            <div className="my-2 h-px bg-border" />

            {/* About / FAQ / Contact remain reachable from the secondary menu */}
            {MOBILE_SECONDARY_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={close}
                className="rounded-lg px-3 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
              >
                {t(link.key)}
              </a>
            ))}

            <div className="my-2 h-px bg-border" />
            <div className="flex flex-col gap-3 px-1 py-1">
              <LanguageToggle />
              <ThemeToggle />
            </div>
            <div className="my-2 h-px bg-border" />
            <div className="mt-1 flex flex-col gap-2">
              <Link
                to="/login"
                onClick={close}
                className="flex w-full items-center justify-center rounded-xl border border-border bg-background px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
              >
                {t("nav.login")}
              </Link>
              <Button asChild onClick={close} className="w-full">
                <Link to="/signup">{t("nav.getStarted")}</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}