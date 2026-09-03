import { Users, Target, Sprout, Headphones } from "lucide-react";
import { useI18n } from "../../context/PreferencesContext";

/**
 * Landing impact statistics band.
 *
 * Rendered between the hero and the problem section. Shows four headline
 * figures (farmers helped, accuracy, crops supported, AI support) with an
 * eyebrow label, using the same card styling as the other landing sections.
 */
export function LandingStats() {
  const { t } = useI18n();

  const STATS = [
    {
      icon: Users,
      value: "25,000+",
      label: t("stats.farmersLabel"),
    },
    {
      icon: Target,
      value: "95%",
      label: t("stats.accuracyLabel"),
    },
    {
      icon: Sprout,
      value: "40+",
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
      className="relative overflow-hidden bg-hero-wash py-14 sm:py-16"
      aria-label={t("stats.sectionLabel")}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-leaf-grid opacity-70"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t("stats.sectionLabel")}
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-border bg-card p-5 text-center shadow-soft sm:p-6"
            >
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <stat.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
