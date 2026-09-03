import { useI18n } from "../../context/PreferencesContext";

/**
 * Landing statistics band — the four reference metrics (Farmers Helped,
 * Accuracy, Crops Supported, AI Support) shown as large green values with
 * gray labels inside a single white rounded container beneath the hero.
 */
export function LandingStats() {
  const { t } = useI18n();

  const STATS = [
    { value: "10K+", label: t("stats.farmersLabel") },
    { value: "98%", label: t("stats.accuracyLabel") },
    { value: "25+", label: t("stats.cropsLabel") },
    { value: "24/7", label: t("stats.supportLabel") },
  ];

  return (
    <section aria-label={t("stats.sectionLabel")} className="pb-16 sm:pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl border border-border bg-card px-6 py-8 shadow-soft sm:px-10 sm:py-10">
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4 lg:divide-x lg:divide-border">
            {STATS.map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center gap-1 text-center"
              >
                <p className="font-heading text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
                  {item.value}
                </p>
                <p className="text-sm font-medium text-muted-foreground">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
