import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  History,
  ImageOff,
  ImagePlus,
  Leaf,
  ListChecks,
  Loader2,
  ScanLine,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { PageHeader } from "../components/layout/page-header";
import CameraCapture from "../components/camera-capture";
import { useFarm } from "../context/FarmContext";
import { useI18n } from "../context/PreferencesContext";
import { buildFarmContext } from "../lib/farm-context";
import {
  analyzeCropPhoto,
  fetchDiagnoses,
  prepareImageFile,
  uploadCropImage,
} from "../lib/diagnosis-service";
import type { Diagnosis, Severity } from "../types";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 10;
const RECENT_LIMIT = 4;

type Phase = "idle" | "preparing" | "uploading" | "analyzing" | "result" | "error";

const SEVERITY_META: Record<
  Severity,
  { labelKey: string; variant: "success" | "warning" | "danger" }
> = {
  low: { labelKey: "cropDoctor.lowSeverity", variant: "success" },
  medium: { labelKey: "cropDoctor.mediumSeverity", variant: "warning" },
  high: { labelKey: "cropDoctor.highSeverity", variant: "danger" },
};

/** Compact date label, e.g. "12 Jan · 10:30" — same data, tighter rhythm. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CropDoctorPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { farm } = useFarm();
  const { t } = useI18n();

  const [phase, setPhase] = useState<Phase>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  // Farm context to make the analysis specific to the farmer's crop.
  const farmContext = farm ? buildFarmContext(farm) : null;

  const busy = phase === "preparing" || phase === "uploading" || phase === "analyzing";

  /* ---------------------------------------------------------------- */
  /* Recent diagnoses (REAL data — same query as the history page)     */
  /* ---------------------------------------------------------------- */
  const [recent, setRecent] = useState<Diagnosis[] | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);

  const loadRecent = useCallback(async () => {
    setRecentError(null);
    setRecent(null);
    try {
      const rows = await fetchDiagnoses(farm?.id);
      setRecent(rows.slice(0, RECENT_LIMIT));
    } catch (err) {
      setRecentError(
        err instanceof Error ? err.message : t("dashboard.couldntLoadRecent")
      );
    }
  }, [farm?.id, t]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  // Refresh the list after a completed analysis so the new result appears.
  useEffect(() => {
    if (phase === "result") void loadRecent();
  }, [phase, loadRecent]);

  const openPicker = () => inputRef.current?.click();

  function handleFile(next: File | undefined | null) {
    if (!next) return;
    setError(null);

    if (!ACCEPTED.includes(next.type)) {
      setPhase("error");
      setError(t("cropDoctor.formatUnsupported"));
      return;
    }
    if (next.size > MAX_SIZE_MB * 1024 * 1024) {
      setPhase("error");
      setError(t("cropDoctor.tooLarge", { n: MAX_SIZE_MB }));
      return;
    }

    // Clear any previous result, then show a fresh preview ready to analyze.
    setDiagnosis(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setFileName(next.name);
    setPreviewUrl(URL.createObjectURL(next));
    setPhase("idle");
  }

  function handleCameraCapture(capturedFile: File) {
    handleFile(capturedFile);
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileName(null);
    setFile(null);
    setError(null);
    setDiagnosis(null);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function runAnalysis() {
    if (!file) return;
    setError(null);
    setDiagnosis(null);
    try {
      setPhase("preparing");
      const prepared = await prepareImageFile(file);

      setPhase("uploading");
      const imageUrl = await uploadCropImage(prepared, file, farm?.id);

      setPhase("analyzing");
      const result = await analyzeCropPhoto({
        imageUrl,
        farmId: farm?.id,
        cropName: farm ? farm.currentCrop : undefined,
        growthStage: farmContext?.growth.stageLabel,
        variety: farm?.currentCropVariety,
        location: farm?.location,
      });

      setDiagnosis(result);
      setPhase("result");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("cropDoctor.analysisFailed")
      );
      setPhase("error");
    }
  }

  const busyLabel =
    phase === "preparing"
      ? t("cropDoctor.preparing")
      : phase === "uploading"
        ? t("cropDoctor.uploading")
        : t("cropDoctor.analyzing");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("cropDoctor.title")}
        subtitle={t("cropDoctor.subtitle")}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/diagnosis-history">
              <History className="h-4 w-4" aria-hidden="true" />
              {t("diagHistory.viewHistory")}
            </Link>
          </Button>
        }
      />

      {/* Farm context note — kept from the original page */}
      {farm ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-soft">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Leaf className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="min-w-0 text-sm text-foreground">
            <span className="font-semibold">{t("cropDoctor.analyzingForFarm", { crop: farm.currentCrop })}</span>
            <span className="text-muted-foreground">
              {" "}
              · {[farmContext?.growth.stageLabel, farm.location].filter(Boolean).join(" · ")}
            </span>
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-soft">
          <span className="font-semibold text-foreground">{t("cropDoctor.noFarmSelected")}</span>
          <span className="text-muted-foreground">
            {t("cropDoctor.noFarmHint")}{" "}
            <Link
              to="/farm-setup"
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              {t("cropDoctor.setupFarmLink")}
            </Link>{" "}
            {t("cropDoctor.setupFarmHintTail")}
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
        aria-label={t("cropDoctor.choosePhotoAria")}
      />

      {/* Main two-column grid — upload (left) + recent diagnoses (right) */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* LEFT — Upload Crop Image */}
        {phase === "result" && diagnosis ? (
          <DiagnosisResult diagnosis={diagnosis} onReset={reset} />
        ) : (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                <ImagePlus className="h-5 w-5 text-primary" aria-hidden="true" />
                {t("cropDoctor.uploadCropImage")}
              </CardTitle>
              <CardDescription>
                {t("cropDoctor.uploadSubtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Idle — dashed dropzone */}
              {phase === "idle" && !previewUrl ? (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={t("cropDoctor.dropzoneAria")}
                  onClick={openPicker}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openPicker();
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFile(e.dataTransfer.files?.[0]);
                  }}
                  className="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-primary/30 bg-muted/40 px-6 py-10 text-center outline-none transition-colors duration-200 hover:border-primary/60 hover:bg-primary-soft/40 focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft">
                    <Upload className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <div className="space-y-1.5">
                    <p className="text-base font-semibold text-foreground">
                      {t("cropDoctor.dragDrop")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("cropDoctor.orBrowse")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button type="button" onClick={(e) => { e.stopPropagation(); openPicker(); }}>
                      <ScanLine className="h-4 w-4" aria-hidden="true" />
                      {t("cropDoctor.browseImage")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); setCameraOpen(true); }}
                    >
                      <Camera className="h-4 w-4" aria-hidden="true" />
                      {t("cropDoctor.takePhoto")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("cropDoctor.formatHint", { n: MAX_SIZE_MB })}
                  </p>
                </div>
              ) : null}

              {/* Busy — preparing / uploading / analyzing */}
              {busy ? (
                <div className="space-y-4 animate-fade-in" role="status" aria-live="polite">
                  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-muted/40 px-6 py-8 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-base font-semibold text-foreground">{busyLabel}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("cropDoctor.busyHint")}
                      </p>
                    </div>
                  </div>
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={`Analyzing ${fileName ?? "crop photo"}`}
                      className="max-h-64 w-full rounded-xl object-contain bg-muted"
                    />
                  ) : null}
                </div>
              ) : null}

              {/* Preview + analyze */}
              {!busy && previewUrl && !diagnosis && phase !== "result" && phase !== "error" ? (
                <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft animate-fade-in">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-success">
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                      <p className="font-semibold">{t("cropDoctor.photoReady")}</p>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={reset} aria-label={t("cropDoctor.removePhoto")}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                  <img
                    src={previewUrl}
                    alt={`Preview of ${fileName ?? "crop photo"}`}
                    className="max-h-72 w-full rounded-xl object-contain bg-muted"
                  />
                  <p className="truncate text-xs text-muted-foreground">{fileName}</p>
                  <Button size="lg" className="w-full" onClick={() => void runAnalysis()}>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    {t("cropDoctor.analyzeCrop")}
                  </Button>
                </div>
              ) : null}

              {/* Error */}
              {phase === "error" && error ? (
                <div className="space-y-3 rounded-2xl border border-danger/30 bg-danger-soft/60 p-5 animate-fade-in">
                  <p className="text-sm font-semibold text-danger">
                    {t("cropDoctor.errorTitle")}
                  </p>
                  <p className="text-sm leading-relaxed text-foreground">{error}</p>
                  <Button variant="outline" size="sm" onClick={reset}>
                    {t("cropDoctor.tryAnother")}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* RIGHT — Recent Diagnoses (real history data) */}
        <section
          aria-label={t("cropDoctor.recentDiagnoses")}
          className="flex h-fit flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-primary to-primary-deep text-primary-foreground shadow-lift ring-1 ring-inset ring-white/10"
        >
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-primary-foreground ring-1 ring-inset ring-white/15">
              <History className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="font-heading text-base font-bold tracking-tight text-primary-foreground">
                {t("cropDoctor.recentDiagnoses")}
              </h2>
              <p className="text-xs text-primary-foreground/70">
                {t("cropDoctor.recentDiagnosesSub")}
              </p>
            </div>
          </div>

          <div className="flex-1">
            {recent === null && !recentError ? (
              <div className="space-y-1 p-2" role="status" aria-label={t("cropDoctor.loadingRecentAria")}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-3">
                    <span className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-white/15" />
                    <div className="flex-1 space-y-2">
                      <span className="block h-3.5 w-2/3 animate-pulse rounded-full bg-white/15" />
                      <span className="block h-3 w-1/3 animate-pulse rounded-full bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentError ? (
              <div className="px-5 py-6 text-center">
                <p className="text-sm leading-relaxed text-primary-foreground/80">
                  {recentError}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => void loadRecent()}
                >
                  {t("common.tryAgain")}
                </Button>
              </div>
            ) : !recent || recent.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
                  <ImageOff className="h-6 w-6" aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-primary-foreground">
                  {t("cropDoctor.noDiagnosesYet")}
                </p>
                <p className="mx-auto mt-1 max-w-[24ch] text-xs leading-relaxed text-primary-foreground/70">
                  {t("cropDoctor.noDiagnosesDesc")}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/10 p-2">
                {recent.map((d) => {
                  const severity = SEVERITY_META[d.severity] ?? SEVERITY_META.medium;
                  return (
                    <li key={d.id}>
                      <Link
                        to="/diagnosis-history"
                        className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors duration-150 hover:bg-white/10"
                      >
                        {d.imageUrl ? (
                          <img
                            src={d.imageUrl}
                            alt={`Crop photo for ${d.diagnosis}`}
                            loading="lazy"
                            className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-inset ring-white/20"
                          />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/15">
                            <ImageOff className="h-5 w-5 text-primary-foreground/80" aria-hidden="true" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-primary-foreground">
                            {d.diagnosis || t("cropDoctor.cropDiagnosis")}
                          </p>
                          <p className="mt-1 flex items-center gap-1.5">
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                severity.variant === "success"
                                  ? "bg-success"
                                  : severity.variant === "warning"
                                    ? "bg-warning"
                                    : "bg-danger"
                              }`}
                              aria-hidden="true"
                            />
                            <span className="text-xs font-medium text-primary-foreground/90">
                              {t(severity.labelKey)}
                            </span>
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-primary-foreground/70">
                            <CalendarDays className="h-3 w-3" aria-hidden="true" />
                            {formatDate(d.createdAt)} · {d.crop}
                          </p>
                        </div>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-primary-foreground/60"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="p-3 pt-2">
            <Button asChild variant="secondary" className="w-full">
              <Link to="/diagnosis-history">
                <History className="h-4 w-4" aria-hidden="true" />
                {t("cropDoctor.viewAllHistory")}
              </Link>
            </Button>
          </div>
        </section>
      </div>

      {/* BOTTOM — How to capture better image? */}
      <section
        aria-label={t("cropDoctor.howToCapture")}
        className="rounded-2xl border border-primary/15 bg-primary-soft/70 p-6 shadow-soft"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <Camera className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-bold tracking-tight text-foreground">
              {t("cropDoctor.howToCapture")}
            </h2>
            <ul className="mt-3 grid gap-x-8 gap-y-2.5 text-sm leading-relaxed text-foreground sm:grid-cols-2">
              {[
                t("cropDoctor.tip1"),
                t("cropDoctor.tip2"),
                t("cropDoctor.tip3"),
                t("cropDoctor.tip4"),
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Camera capture dialog — only activates when the user clicks "Take Photo". */}
      <CameraCapture
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={handleCameraCapture}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Result card                                                         */
/* ------------------------------------------------------------------ */

function DiagnosisResult({
  diagnosis,
  onReset,
}: {
  diagnosis: Diagnosis;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const severity = SEVERITY_META[diagnosis.severity] ?? SEVERITY_META.medium;
  const causes = diagnosis.causes ?? [];
  const actions = diagnosis.recommendedActions ?? [];

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("cropDoctor.aiDiagnosis", { crop: diagnosis.crop })}
              </p>
              <CardTitle className="mt-1 text-xl text-foreground">
                {diagnosis.diagnosis}
              </CardTitle>
            </div>
            <Badge variant={severity.variant} className="shrink-0">
              {t(severity.labelKey)}
            </Badge>
          </div>
          {diagnosis.imageUrl ? (
            <img
              src={diagnosis.imageUrl}
              alt={`Analyzed crop photo showing ${diagnosis.diagnosis}`}
              className="max-h-64 w-full rounded-xl object-contain bg-muted"
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {t("diagHistory.confidencePercent", { n: diagnosis.confidence })}
            </Badge>
            <Badge variant="neutral">
              {new Date(diagnosis.createdAt).toLocaleString()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {diagnosis.description ? (
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-foreground">{t("cropDoctor.whatsHappening")}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {diagnosis.description}
              </p>
            </div>
          ) : null}

          {causes.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{t("cropDoctor.likelyCauses")}</h3>
              <ul className="space-y-1.5">
                {causes.map((cause, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    <span>{cause}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {actions.length > 0 ? (
            <div className="space-y-2 rounded-xl bg-primary-soft p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
                <ListChecks className="h-4 w-4" aria-hidden="true" />
                {t("cropDoctor.whatToDoNext")}
              </h3>
              <ol className="space-y-2">
                {actions.map((action, i) => (
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

          {diagnosis.notes ? (
            <p className="rounded-xl border border-border bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
              {diagnosis.notes}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("cropDoctor.advisoryNote")}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={onReset}>
          <ScanLine className="h-4 w-4" aria-hidden="true" />
          {t("cropDoctor.analyzeAnother")}
        </Button>
        <Button asChild>
          <Link to="/diagnosis-history">
            <History className="h-4 w-4" aria-hidden="true" />
            {t("cropDoctor.viewAllDiagnoses")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
