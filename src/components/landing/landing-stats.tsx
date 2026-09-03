import { Users, Target, Sprout, Headphones } from "lucide-react";
import { useI18n } from "../../context/PreferencesContext";

/**
 * Landing impact statistics band.
 *
 * Rendered between the hero and the problem section. Shows four headline
 * figures (farmers helped, accuracy, crops supported, AI support) with an
 * eyebrow label, using the same clean card styling as the other landing
 * sections. Values follow the reference: 10K+ / 98% / 25+ / 24-7.
 */
export function LandingStats() {
  const { t } = useI18n();

  const STATS = [
    {
      icon: Users,
      value: "10K+",
      label: t("stats.farmersLabel"),
    },
    {
      icon: Target,
      value: "98%",
      label: t("stats.accuracyLabel"),
    },
    {
      icon: Sprout,
      value: "25+",
      label: t("stats.cropsLabel"),
    },
    {
      icon: Headphones,
      value: "24/7",
      label: t("stats.supportLabel"),
    },
  ];

  return (
    <section
      id="impact"
      className="relative overflow-hidden bg-background py-14 sm:py-16"
      aria-label={t("stats.sectionLabel")}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t("stats.sectionLabel")}
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-border/80 bg-card p-5 text-center shadow-soft card-sheen sm:p-6"
            >
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <stat.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-3 font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {stat.value}
              </p>
              <p className="mt-1.5 text-sm font-medium text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
