import {
  AlertTriangle,
  CloudSun,
  ListChecks,
  MessageCircle,
  Mic,
  ScanLine,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "../../context/PreferencesContext";

export function LandingFeatures() {
  const { t } = useI18n();

  const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
    { icon: ScanLine, title: t("features.f1"), text: t("features.f1Text") },
    { icon: MessageCircle, title: t("features.f2"), text: t("features.f2Text") },
    { icon: Mic, title: t("features.f3"), text: t("features.f3Text") },
    { icon: CloudSun, title: t("features.f4"), text: t("features.f4Text") },
    { icon: AlertTriangle, title: t("features.f5"), text: t("features.f5Text") },
    { icon: ListChecks, title: t("features.f6"), text: t("features.f6Text") },
    { icon: TrendingUp, title: t("features.f7"), text: t("features.f7Text") },
  ];

  return (
    <section id="features" className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t("features.eyebrow")}
          </p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t("features.title")}
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            {t("features.subtitle")}
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-soft transition-all duration-200 hover:shadow-lift hover:-translate-y-0.5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-base font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}