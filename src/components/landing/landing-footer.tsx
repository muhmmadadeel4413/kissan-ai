import { Link } from "react-router-dom";
import { Sprout } from "lucide-react";
import { useI18n } from "../../context/PreferencesContext";

export function LandingFooter() {
  const { t } = useI18n();

  const PRODUCT_LINKS = [
    { label: t("page.farmSetup"), to: "/farm-setup" },
    { label: t("app.nav.dashboard"), to: "/dashboard" },
    { label: t("app.nav.cropDoctor"), to: "/crop-doctor" },
    { label: t("app.nav.assistant"), to: "/assistant" },
    { label: t("app.nav.weather"), to: "/weather" },
  ];

  const SECTION_LINKS = [
    { label: t("nav.home"), href: "#home" },
    { label: t("nav.problem"), href: "#problem" },
    { label: t("nav.solution"), href: "#solution" },
    { label: t("nav.features"), href: "#features" },
    { label: t("nav.howItWorks"), href: "#how-it-works" },
    { label: t("nav.about"), href: "#about" },
    { label: t("nav.faq"), href: "#faq" },
    { label: t("nav.contact"), href: "#contact" },
  ];

  return (
    <footer id="about" className="scroll-mt-24 border-t border-border bg-secondary/50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#35451f] text-primary-foreground shadow-soft">
                <Sprout className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="font-heading text-lg font-bold tracking-tight text-foreground">
                {t("brand.name")}
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              {t("footer.tagline")}
            </p>
          </div>

          <nav aria-label={t("footer.quickLinks")}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
              {t("footer.quickLinks")}
            </h3>
            <ul className="mt-3 space-y-2">
              {SECTION_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary cursor-pointer"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t("footer.product")}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
              {t("footer.product")}
            </h3>
            <ul className="mt-3 space-y-2">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary cursor-pointer"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {t("brand.name")}. {t("footer.rights")}
          </p>
          <p className="text-xs text-muted-foreground">Bano Qabil Hackathon project</p>
        </div>
      </div>
    </footer>
  );
}