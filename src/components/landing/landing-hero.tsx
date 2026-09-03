import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  ChevronRight,
  Droplets,
  HelpCircle,
  History,
  Home,
  Info,
  Leaf,
  Settings,
  Sprout,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "../ui/button";
import { useI18n } from "../../context/PreferencesContext";

/**
 * Landing hero — reference composition.
 *
 * Left column: pill badge (lightning bolt), three-line bold headline,
 * supporting copy, green primary CTA ("Get Started Free") and outline
 * secondary CTA ("Learn More"). Right column: an angled smartphone mockup
 * previewing the real app UI — dark-green KISSAN AI header, tool menu with
 * chevrons, monthly yield bar chart, bottom tab bar — surrounded by
 * floating semi-transparent leaves. Columns stack on mobile.
 */
export function LandingHero() {
  const { t } = useI18n();

  return (
    <section
      id="home"
      className="relative overflow-hidden bg-hero-wash pt-24 sm:pt-28"
    >
      {/* Subtle dot texture */}
      <div
        className="pointer-events-none absolute inset-0 bg-leaf-grid opacity-70"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-14 pb-20 pt-10 sm:pt-14 lg:grid-cols-2 lg:gap-10 lg:pb-28">
          {/* ---- Left: badge + headline + copy + CTAs ---- */}
          <div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary-soft px-4 py-1.5 text-sm font-medium text-primary shadow-soft">
              <Zap className="h-4 w-4" aria-hidden="true" />
              {t("hero.badge")}
            </p>
            <h1 className="font-heading text-4xl font-extrabold leading-[1.15] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {t("hero.titleA")}
              <br />
              {t("hero.titleB")}
              <br />
              {t("hero.titleC")}
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
              {t("hero.subtitle")}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to="/signup">
                  {t("hero.cta")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full border-primary/50 text-primary hover:bg-primary-soft hover:text-primary sm:w-auto"
              >
                <Link to="/dashboard">{t("hero.explore")}</Link>
              </Button>
            </div>
          </div>

          {/* ---- Right: phone mockup with floating leaves ---- */}
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Smartphone mockup — a preview of the real KISSAN AI app UI          */
/* ------------------------------------------------------------------ */

/** Static demo bars for the mini yield chart (green + blue per reference). */
const CHART_BARS = [34, 52, 44, 66, 48, 72, 58, 80, 64, 88, 76, 95];
const CHART_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function PhoneMockup() {
  const { t } = useI18n();

  const MENU = [
    { icon: Leaf, label: t("hero.phone.cropDoctor") },
    { icon: Leaf, label: t("hero.phone.cropRecommendation") },
    { icon: Droplets, label: t("hero.phone.irrigation") },
    { icon: TrendingUp, label: t("hero.phone.yield") },
    { icon: History, label: t("hero.phone.history") },
  ];

  return (
    <div className="relative mx-auto w-fit">
      {/* Floating semi-transparent leaves scattered around the phone */}
      <Leaf
        className="pointer-events-none absolute -left-10 top-8 h-10 w-10 rotate-[-35deg] text-primary/25"
        aria-hidden="true"
      />
      <Leaf
        className="pointer-events-none absolute -right-9 top-14 h-14 w-14 rotate-[25deg] text-accent/25"
        aria-hidden="true"
      />
      <Leaf
        className="pointer-events-none absolute -left-7 bottom-28 h-8 w-8 rotate-[150deg] text-accent/30"
        aria-hidden="true"
      />
      <Leaf
        className="pointer-events-none absolute -right-10 bottom-12 h-12 w-12 rotate-[65deg] text-primary/20"
        aria-hidden="true"
      />
      <Leaf
        className="pointer-events-none absolute -top-7 left-1/2 h-9 w-9 rotate-[10deg] text-primary/20"
        aria-hidden="true"
      />

      {/* Phone body — angled slightly to the left */}
      <div className="relative rotate-[-3deg] rounded-[2.75rem] bg-foreground p-2 shadow-pop ring-1 ring-black/10">
        {/* Screen */}
        <div className="w-[248px] overflow-hidden rounded-[2.25rem] bg-card sm:w-[272px]">
          {/* Notch / speaker area */}
          <div className="flex h-7 items-center justify-center bg-primary-deep">
            <span
              className="h-1.5 w-14 rounded-full bg-black/40"
              aria-hidden="true"
            />
          </div>

          {/* App header */}
          <div className="flex items-center gap-2 bg-primary-deep px-4 pb-3">
            <Sprout className="h-4 w-4 text-white" aria-hidden="true" />
            <span className="font-heading text-sm font-bold tracking-wide text-white">
              {t("brand.name")}
            </span>
          </div>

          {/* Tool menu */}
          <ul className="divide-y divide-border/70">
            {MENU.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="flex-1 truncate text-[11px] font-semibold text-foreground">
                  {item.label}
                </span>
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground rtl:rotate-180"
                  aria-hidden="true"
                />
              </li>
            ))}
          </ul>

          {/* Mini monthly yield chart */}
          <div className="m-3 rounded-xl border border-border/70 bg-background p-3">
            <div className="flex h-20 items-end gap-1">
              {CHART_BARS.map((height, i) => (
                <span
                  key={i}
                  style={{ height: `${height}%` }}
                  className={
                    i % 3 === 1
                      ? "flex-1 rounded-t-sm bg-[#5b8db8]"
                      : "flex-1 rounded-t-sm bg-primary"
                  }
                />
              ))}
            </div>
            <div className="mt-1.5 flex gap-1">
              {CHART_MONTHS.map((month) => (
                <span
                  key={month}
                  className="flex-1 text-center text-[5.5px] font-medium leading-none text-muted-foreground"
                >
                  {month}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom tab bar */}
          <div className="flex items-center justify-around border-t border-border/70 bg-card px-2 py-2.5">
            <Home className="h-4 w-4 text-primary" aria-hidden="true" />
            <BarChart3
              className="h-4 w-4 text-muted-foreground/60"
              aria-hidden="true"
            />
            <HelpCircle
              className="h-4 w-4 text-muted-foreground/60"
              aria-hidden="true"
            />
            <Info className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
            <Settings
              className="h-4 w-4 text-muted-foreground/60"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      {/* Soft ground shadow beneath the phone */}
      <div
        className="pointer-events-none absolute -bottom-7 left-1/2 h-8 w-2/3 -translate-x-1/2 rounded-[100%] bg-primary/20 blur-xl"
        aria-hidden="true"
      />
    </div>
  );
}
