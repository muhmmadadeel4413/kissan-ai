import {
  ListChecks,
  ScanLine,
  Sprout,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "../../context/PreferencesContext";

export function LandingHowItWorks() {
  const { t } = useI18n();

  const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
    { icon: Sprout, title: t("how.s1Title"), text: t("how.s1Text") },
    { icon: ScanLine, title: t("how.s2Title"), text: t("how.s2Text") },
    { icon: MessageCircle, title: t("how.s3Title"), text: t("how.s3Text") },
    { icon: ListChecks, title: t("how.s4Title"), text: t("how.s4Text") },
  ];

  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 bg-secondary/50 py-16 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t("how.eyebrow")}
          </p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t("how.title")}
          </h2>
        </div>

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="relative rounded-2xl border border-border bg-card p-5 shadow-soft"
            >
              <span className="absolute right-4 top-4 text-3xl font-extrabold text-muted/70 ltr:right-4 ltr:left-auto rtl:left-4 rtl:right-auto">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <step.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-base font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}