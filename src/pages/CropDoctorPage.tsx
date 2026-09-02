import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  CheckCircle2,
  History,
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
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { PageHeader } from "../components/layout/page-header";
import { useFarm } from "../context/FarmContext";
import { buildFarmContext } from "../lib/farm-context";
import {
  analyzeCropPhoto,
  prepareImageFile,
  uploadCropImage,
} from "../lib/diagnosis-service";
import type { Diagnosis, Severity } from "../types";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 10;

type Phase = "idle" | "preparing" | "uploading" | "analyzing" | "result" | "error";

const SEVERITY_META: Record<
  Severity,
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  low: { label: "Low severity", variant: "success" },
  medium: { label: "Medium severity", variant: "warning" },
  high: { label: "High severity", variant: "danger" },
};

export default function CropDoctorPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { farm } = useFarm();

  const [phase, setPhase] = useState<Phase>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);

  // Farm context to make the analysis specific to the farmer's crop.
  const farmContext = farm ? buildFarmContext(farm) : null;

  const busy = phase === "preparing" || phase === "uploading" || phase === "analyzing";

  function handleFile(next: File | undefined | null) {
    if (!next) return;
    setError(null);

    if (!ACCEPTED.includes(next.type)) {
      setPhase("error");
      setError("This format isn't supported yet. Please upload a JPEG or PNG photo.");
      return;
    }
    if (next.size > MAX_SIZE_MB * 1024 * 1024) {
      setPhase("error");
      setError(
        `This photo is over ${MAX_SIZE_MB} MB. Please upload a smaller image so it can be analyzed.`
      );
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
        err instanceof Error ? err.message : "The analysis failed. Please try again."
      );
      setPhase("error");
    }
  }

  const busyLabel =
    phase === "preparing"
      ? "Preparing your photo…"
      : phase === "uploading"
        ? "Uploading your photo…"
        : "Analyzing with AI…";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="AI Crop Doctor"
        subtitle="Diagnose crop problems from a photo"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/diagnosis-history">
              <History className="h-4 w-4" aria-hidden="true" />
              History
            </Link>
          </Button>
        }
      />

      <Alert variant="info">
        <ScanLine className="h-5 w-5" aria-hidden="true" />
        <AlertTitle>How it works</AlertTitle>
        <AlertDescription>
          Take a clear photo of the affected leaf or crop. Kissan AI analyzes it with AI
          and suggests what may be wrong, how serious it is, and what to do next.
        </AlertDescription>
      </Alert>

      {/* Farm context note */}
      {farm ? (
        <Alert variant="default" className="border-border bg-card">
          <Leaf className="h-5 w-5" aria-hidden="true" />
          <AlertTitle className="mb-0">Analyzing for your {farm.currentCrop} farm</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {[farmContext?.growth.stageLabel, farm.location].filter(Boolean).join(" · ")}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="default" className="border-border bg-card">
          <Leaf className="h-5 w-5" aria-hidden="true" />
          <AlertTitle className="mb-0">No farm selected</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              We'll analyze the photo on its own.{" "}
              <Link to="/farm-setup" className="font-semibold text-primary underline-offset-2 hover:underline">
                Set up your farm
              </Link>{" "}
              for advice tailored to your crop.
            </span>
          </AlertDescription>
        </Alert>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
        aria-label="Choose a crop photo"
      />

      {/* Upload area (only when idle & no preview) */}
      {phase === "idle" && !previewUrl ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/30 bg-card p-10 text-center transition-colors hover:border-primary/60"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0]);
          }}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary">
            <ImagePlus className="h-8 w-8" aria-hidden="true" />
          </span>
          <div>
            <p className="text-base font-semibold text-foreground">
              Upload a photo of your crop or affected leaf
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              A clear, close-up photo of the affected part works best. JPEG or PNG, up to
              10 MB.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Choose photo
            </Button>
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <Camera className="h-4 w-4" aria-hidden="true" />
              Take a photo
            </Button>
          </div>
        </div>
      ) : null}

      {/* Busy state */}
      {busy ? (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/30 bg-card p-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-semibold text-foreground">{busyLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This usually takes a few seconds. Please keep this page open.
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
              <p className="font-semibold">Photo ready</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={reset} aria-label="Remove photo">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <img
            src={previewUrl}
            alt={`Preview of ${fileName ?? "crop photo"}`}
            className="max-h-72 w-full rounded-xl object-contain bg-muted"
          />
          <p className="text-xs text-muted-foreground">{fileName}</p>
          <Button size="lg" className="w-full" onClick={() => void runAnalysis()}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Analyze Crop
          </Button>
        </div>
      ) : null}

      {/* Result */}
      {phase === "result" && diagnosis ? (
        <DiagnosisResult diagnosis={diagnosis} onReset={reset} />
      ) : null}

      {/* Error */}
      {phase === "error" && error ? (
        <Alert variant="danger">
          <AlertTitle>We couldn't analyze that photo</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={reset}>
              Try another photo
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
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
                AI Diagnosis · {diagnosis.crop}
              </p>
              <CardTitle className="mt-1 text-xl text-foreground">
                {diagnosis.diagnosis}
              </CardTitle>
            </div>
            <Badge variant={severity.variant} className="shrink-0">
              {severity.label}
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
            <Badge variant="outline">Confidence: {diagnosis.confidence}%</Badge>
            <Badge variant="neutral">
              {new Date(diagnosis.createdAt).toLocaleString()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {diagnosis.description ? (
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-foreground">What's happening</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {diagnosis.description}
              </p>
            </div>
          ) : null}

          {causes.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Likely causes</h3>
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
                What to do next
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
              AI guidance is for information only and is not a substitute for advice from a
              local agricultural officer.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={onReset}>
          <ScanLine className="h-4 w-4" aria-hidden="true" />
          Analyze another
        </Button>
        <Button asChild>
          <Link to="/diagnosis-history">
            <History className="h-4 w-4" aria-hidden="true" />
            View all diagnoses
          </Link>
        </Button>
      </div>
    </div>
  );
}