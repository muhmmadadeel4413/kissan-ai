import { CloudSun, MessageCircle, ScanLine, Sprout } from "lucide-react";
import { useI18n } from "../../context/PreferencesContext";

export function LandingSolution() {
  const { t } = useI18n();

  const PILLARS = [
    { icon: Sprout, title: t("solution.s1"), text: t("solution.s1Text") },
    { icon: ScanLine, title: t("solution.s2"), text: t("solution.s2Text") },
    { icon: CloudSun, title: t("solution.s3"), text: t("solution.s3Text") },
    { icon: MessageCircle, title: t("solution.s4"), text: t("solution.s4Text") },
  ];

  return (
    <section id="solution" className="scroll-mt-24 bg-secondary/50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t("solution.eyebrow")}
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {t("solution.title")}
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              {t("solution.subtitle")}
            </p>
            <ul className="mt-8 space-y-5">
              {PILLARS.map((item) => (
                <li key={item.title} className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Illustrative dashboard preview */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-lift">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("solution.previewLabel")}
            </p>
            <div className="mt-4 space-y-3">
              <PreviewRow
                label={t("solution.preview1Label")}
                value={t("solution.preview1Value")}
                tone="primary"
              />
              <PreviewRow
                label={t("solution.preview2Label")}
                value={t("solution.preview2Value")}
                tone="primary"
              />
              <PreviewRow
                label={t("solution.preview3Label")}
                value={t("solution.preview3Value")}
                tone="warning"
              />
              <PreviewRow
                label={t("solution.preview4Label")}
                value={t("solution.preview4Value")}
                tone="success"
              />
            </div>
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
              {t("solution.previewNote")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "warning" | "success";
}) {
  const dot =
    tone === "primary"
      ? "bg-primary"
      : tone === "warning"
        ? "bg-warning"
        : "bg-success";
  return (
    <div className="rounded-xl border border-border bg-background p-3.5">
      <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{value}</p>
    </div>
  );
}