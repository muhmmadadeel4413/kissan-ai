import { Bug, CalendarX, CloudRain, Globe } from "lucide-react";
import { useI18n } from "../../context/PreferencesContext";

export function LandingProblem() {
  const { t } = useI18n();

  const PROBLEMS = [
    { icon: CloudRain, title: t("problem.p1"), text: t("problem.p1Text") },
    { icon: Bug, title: t("problem.p2"), text: t("problem.p2Text") },
    { icon: Globe, title: t("problem.p3"), text: t("problem.p3Text") },
    { icon: CalendarX, title: t("problem.p4"), text: t("problem.p4Text") },
  ];

  return (
    <section id="problem" className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t("problem.eyebrow")}
          </p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t("problem.title")}
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            {t("problem.subtitle")}
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEMS.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-soft"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-soft text-danger">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}