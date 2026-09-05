import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Download,
  History,
  ImageOff,
  Leaf,
  ListChecks,
  ScanLine,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { PageHeader, SectionHeader } from "../components/layout/page-header";
import { EmptyState } from "../components/layout/empty-state";
import { LoadingState } from "../components/layout/loading-state";
import { ErrorState } from "../components/layout/error-state";
import { useFarm } from "../context/FarmContext";
import { useI18n } from "../context/PreferencesContext";
import { fetchDiagnoses } from "../lib/diagnosis-service";
import { exportDiagnosesCsv, downloadCsv } from "../lib/export-utils";
import type { Diagnosis, Severity } from "../types";

const SEVERITY_META: Record<
  Severity,
  { labelKey: string; variant: "success" | "warning" | "danger" }
> = {
  low: { labelKey: "diagHistory.severityLow", variant: "success" },
  medium: { labelKey: "diagHistory.severityMedium", variant: "warning" },
  high: { labelKey: "diagHistory.severityHigh", variant: "danger" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DiagnosisHistoryPage() {
  const { farm } = useFarm();
  const { t } = useI18n();
  const [diagnoses, setDiagnoses] = useState<Diagnosis[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Diagnosis | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setDiagnoses(null);
    try {
      const rows = await fetchDiagnoses(farm?.id);
      setDiagnoses(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("diagHistory.loadError"));
    }
  }, [farm?.id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const loading = diagnoses === null && !error;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("diagnosisHistory.title")}
        subtitle={
          farm
            ? t("diagHistory.subtitle", { crop: farm.currentCrop })
            : t("diagHistory.subtitleNoFarm")
        }
        action={
          <div className="flex items-center gap-2">
            {diagnoses && diagnoses.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const csv = exportDiagnosesCsv(diagnoses);
                  downloadCsv(csv, `kissan-diagnoses-${new Date().toISOString().slice(0, 10)}.csv`);
                }}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {t("diagHistory.exportCsv")}
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link to="/crop-doctor">
                <ScanLine className="h-4 w-4" aria-hidden="true" />
                {t("diagHistory.newDiagnosis")}
              </Link>
            </Button>
          </div>
        }
      />

      {loading ? (
        <LoadingState rows={3} title={t("diagHistory.loadingHistory")} />
      ) : error ? (
        <ErrorState
          title={t("diagHistory.couldntLoad")}
          message={error}
          onRetry={() => void load()}
        />
      ) : !diagnoses || diagnoses.length === 0 ? (
        <EmptyState
          icon={<History className="h-6 w-6" />}
          title={t("diagHistory.noDiagnoses")}
          description={t("diagHistory.noDiagnosesDesc")}
          action={
            <Button asChild>
              <Link to="/crop-doctor">
                <ScanLine className="h-4 w-4" aria-hidden="true" />
                {t("diagHistory.analyzeCropPhoto")}
              </Link>
            </Button>
          }
        />
      ) : (
        <section className="space-y-3">
          <SectionHeader
            title={
              diagnoses.length === 1
                ? t("diagHistory.countSingular", { n: diagnoses.length })
                : t("diagHistory.countPlural", { n: diagnoses.length })
            }
            subtitle={t("diagHistory.latestFirst")}
          />
          {diagnoses.map((d) => {
            const severity = SEVERITY_META[d.severity] ?? SEVERITY_META.medium;
            return (
              <Card
                key={d.id}
                className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
                onClick={() => setSelected(d)}
              >
                {d.imageUrl ? (
                  <img
                    src={d.imageUrl}
                    alt={`Crop photo for ${d.diagnosis}`}
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-xl object-cover bg-muted"
                  />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <ImageOff className="h-6 w-6" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {d.diagnosis || t("diagHistory.cropDiagnosis")}
                    </p>
                    <Badge variant={severity.variant}>{t(severity.labelKey)}</Badge>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatDate(d.createdAt)} · {d.crop}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {t("diagHistory.confidencePercent", { n: d.confidence })}
                    </Badge>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Card>
            );
          })}
        </section>
      )}

      {/* Detail dialog */}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.diagnosis || t("diagHistory.diagnosisDetail")}</DialogTitle>
            <DialogDescription>
              {selected
                ? `${selected.crop} · ${formatDate(selected.createdAt)}`
                : t("diagHistory.diagnosisDetail")}
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4">
              {selected.imageUrl ? (
                <img
                  src={selected.imageUrl}
                  alt={`Crop photo for ${selected.diagnosis}`}
                  className="max-h-56 w-full rounded-xl object-contain bg-muted"
                />
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={SEVERITY_META[selected.severity]?.variant ?? "neutral"}>
                  {t("diagHistory.severityLabel", {
                    level: SEVERITY_META[selected.severity]
                      ? t(SEVERITY_META[selected.severity].labelKey)
                      : selected.severity,
                  })}
                </Badge>
                <Badge variant="outline">
                  {t("diagHistory.confidencePercent", { n: selected.confidence })}
                </Badge>
              </div>

              {selected.description ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {selected.description}
                </p>
              ) : null}

              {selected.causes && selected.causes.length > 0 ? (
                <div className="space-y-1.5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Leaf className="h-4 w-4 text-primary" aria-hidden="true" />
                    {t("diagHistory.likelyCauses")}
                  </h4>
                  <ul className="space-y-1">
                    {selected.causes.map((cause, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                        <span>{cause}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {selected.recommendedActions && selected.recommendedActions.length > 0 ? (
                <div className="space-y-1.5 rounded-xl bg-primary-soft p-4">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <ListChecks className="h-4 w-4" aria-hidden="true" />
                    {t("diagHistory.whatToDoNext")}
                  </h4>
                  <ol className="space-y-1.5">
                    {selected.recommendedActions.map((action, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{action}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {selected.notes ? (
                <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                  {selected.notes}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("diagHistory.advisoryNote")}
                </p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}