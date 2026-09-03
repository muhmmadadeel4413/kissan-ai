import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CloudSun,
  Droplets,
  Leaf,
  MapPin,
  Sprout,
  Sun,
  TrendingUp,
  Wheat,
} from "lucide-react";
import { Button } from "../ui/button";
import { useI18n } from "../../context/PreferencesContext";

/**
 * Landing hero — reference composition.
 *
 * Left column: pill badge, three-line bold headline, supporting copy,
 * green primary CTA ("Get Started Free") and a lighter secondary CTA
 * ("Learn More"). Right column: a rich green farm-field panel with a
 * circular field scene, crop rows, a rising sun and floating leaves,
 * overlaid with floating white app cards (weather chip, yield chart
 * card, accuracy chip) — the same green-dense right half with a white
 * card cluster seen in the reference. Columns stack on mobile.
 */
export function LandingHero() {
  const { t } = useI18n();

  return (
    <section id="home" className="relative overflow-hidden bg-background">
      {/* Soft mint wash + leaf texture, kept subtle per the design system */}
      <div
        className="pointer-events-none absolute inset-0 bg-hero-wash"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-leaf-grid opacity-40"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-16 pb-24 pt-28 sm:pt-32 lg:grid-cols-2 lg:gap-10 lg:pb-32">
          {/* ---- Left: badge + headline + copy + CTAs ---- */}
          <div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary-soft px-4 py-1.5 text-sm font-medium text-primary shadow-soft">
              <Leaf className="h-4 w-4" aria-hidden="true" />
              {t("hero.badge")}
            </p>
            <h1 className="font-heading text-4xl font-extrabold leading-[1.12] tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem]">
              {t("hero.titleA")}
              <br />
              {t("hero.titleB")}
              <br />
              <span className="text-primary">{t("hero.titleC")}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
              {t("hero.subtitle")}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <Button asChild size="lg" className="w-full shadow-lift sm:w-auto">
                <Link to="/signup">
                  {t("hero.cta")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full border-primary/40 bg-card/80 text-primary hover:bg-primary-soft hover:text-primary sm:w-auto"
              >
                <Link to="/dashboard">{t("hero.explore")}</Link>
              </Button>
            </div>
          </div>

          {/* ---- Right: green farm-field panel with floating app cards ---- */}
          <FarmVisual />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Farm visual — rich green field panel + floating white app cards     */
/* ------------------------------------------------------------------ */

/** Crop row hues: alternating greens (KISSAN palette), visibly dense. */
const CROP_ROWS = [
  { top: "0%", bg: "bg-primary/55" },
  { top: "18%", bg: "bg-primary/70" },
  { top: "36%", bg: "bg-accent/60" },
  { top: "54%", bg: "bg-primary/75" },
  { top: "72%", bg: "bg-accent/65" },
  { top: "90%", bg: "bg-primary/55" },
];

/** Static demo bars for the floating yield chart card. */
const CHART_BARS = [42, 58, 48, 66, 54, 74, 62, 84, 70, 90, 78, 96];

function FarmVisual() {
  const { t } = useI18n();

  return (
    <div className="relative ml-auto w-full max-w-[560px]">
      {/* Soft ground glow behind the panel */}
      <div
        className="pointer-events-none absolute -bottom-7 left-1/2 h-16 w-3/4 -translate-x-1/2 rounded-[100%] bg-primary/25 blur-2xl"
        aria-hidden="true"
      />

      {/* Rich green field panel */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary-deep to-[#22301f] shadow-pop ring-1 ring-primary-deep/40">
        {/* Soft mint glow at the top of the panel */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/10 to-transparent"
          aria-hidden="true"
        />

        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-inset ring-white/20">
                <Sprout className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-heading text-base font-bold tracking-tight text-white">
                  {t("brand.name")}
                </p>
                <p className="text-[11px] font-medium text-white/60">
                  {t("brand.tagline")}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/20">
              {t("stats.sectionLabel")}
            </span>
          </div>

          {/* Circular field scene inside the panel */}
          <div className="relative mx-auto mt-6 aspect-square w-full max-w-[320px] overflow-hidden rounded-full border-[6px] border-white/90 shadow-lift">
            {/* Sky gradient */}
            <div
              className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-[#eaf4e0] to-[#f6faf0]"
              aria-hidden="true"
            />
            {/* Rising sun */}
            <div
              className="absolute right-[16%] top-[9%] h-12 w-12 rounded-full bg-accent/70"
              aria-hidden="true"
            />
            {/* Rolling field base */}
            <div
              className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-primary-deep via-primary to-[#6b8a54]"
              aria-hidden="true"
            />

            {/* Crop rows */}
            {CROP_ROWS.map((row) => (
              <div
                key={row.top}
                className={`absolute inset-x-0 h-[15%] ${row.bg}`}
                style={{ top: row.top }}
                aria-hidden="true"
              />
            ))}

            {/* Row texture: little wheat stalks */}
            {[10, 28, 46, 64, 82].map((top) => (
              <div
                key={top}
                className="absolute inset-x-[6%] flex items-end justify-between"
                style={{ top: `${top}%` }}
                aria-hidden="true"
              >
                {Array.from({ length: 11 }).map((_, i) => (
                  <span
                    key={i}
                    className="w-[3px] rounded-full bg-[#1c2519]/35"
                    style={{ height: `${7 + ((i * 7) % 9)}px` }}
                  />
                ))}
              </div>
            ))}

            {/* Decorative floating leaves inside the scene */}
            <Leaf
              className="pointer-events-none absolute left-[8%] top-[12%] h-7 w-7 -rotate-[24deg] text-primary/40"
              aria-hidden="true"
            />
            <Leaf
              className="pointer-events-none absolute right-[8%] top-[46%] h-9 w-9 rotate-[18deg] text-accent/50"
              aria-hidden="true"
            />
            <Sun
              className="pointer-events-none absolute right-[18%] top-[10%] h-4 w-4 text-accent"
              aria-hidden="true"
            />
          </div>

          {/* Panel bottom row */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-white/85">
              <Wheat className="h-4 w-4 text-accent" aria-hidden="true" />
              <span className="text-xs font-semibold">
                {t("solution.preview1Label")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs font-medium">Punjab, Pakistan</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating weather chip (top-left, overlapping panel edge) */}
      <div className="absolute -left-2 top-[13%] flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-lift sm:-left-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <CloudSun className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("solution.preview2Label")}
          </p>
          <p className="text-sm font-bold text-foreground">
            {t("solution.preview2Value")}
          </p>
        </div>
      </div>

      {/* Floating app card (right) — mini dashboard preview */}
      <div className="absolute -right-1 top-[30%] w-56 rounded-2xl border border-border/70 bg-card p-4 shadow-pop sm:-right-6">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-deep text-primary-foreground">
            <Sprout className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="font-heading text-sm font-bold tracking-tight text-foreground">
            {t("brand.name")}
          </p>
          <span className="ml-auto rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
            {t("dashboard.healthGood")}
          </span>
        </div>

        <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("hero.phone.yield")}
        </p>
        <div className="mt-2 flex h-16 items-end gap-1">
          {CHART_BARS.map((height, i) => (
            <span
              key={i}
              style={{ height: `${height}%` }}
              className={
                i % 3 === 1
                  ? "flex-1 rounded-t-sm bg-accent/70"
                  : "flex-1 rounded-t-sm bg-primary"
              }
            />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Wheat className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {t("solution.preview1Label")}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            Punjab
          </div>
        </div>
      </div>

      {/* Floating metric chip (bottom-left) */}
      <div className="absolute -left-2 bottom-[10%] flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-lift sm:-left-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <TrendingUp className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-heading text-lg font-extrabold leading-none tracking-tight text-primary">
            98%
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
            {t("stats.accuracyLabel")}
          </p>
        </div>
      </div>

      {/* Decorative leaves around the panel */}
      <Leaf
        className="pointer-events-none absolute -top-9 left-[10%] h-10 w-10 rotate-[18deg] text-primary/30"
        aria-hidden="true"
      />
      <Leaf
        className="pointer-events-none absolute bottom-[4%] right-[3%] h-11 w-11 -rotate-[30deg] text-accent/35"
        aria-hidden="true"
      />
      <Droplets
        className="pointer-events-none absolute bottom-[24%] right-[28%] h-5 w-5 text-white/40"
        aria-hidden="true"
      />
      <BarChart3
        className="pointer-events-none absolute left-[28%] top-[6%] h-5 w-5 text-accent/50"
        aria-hidden="true"
      />
    </div>
  );
}
