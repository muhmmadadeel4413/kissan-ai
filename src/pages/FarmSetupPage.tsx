import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { PageHeader } from "../components/layout/page-header";
import { LoadingState } from "../components/layout/loading-state";
import { useFarm } from "../context/FarmContext";
import { useI18n } from "../context/PreferencesContext";
import { FarmSetupInput } from "../types";
import { cn } from "../lib/utils";

const SOIL_TYPES = ["Clay", "Sandy", "Loamy", "Silt", "Saline", "Mixed"];
const IRRIGATION_METHODS = ["Drip", "Flood / Furrow", "Sprinkler", "Canal", "Rain-fed"];

type FormErrors = Partial<Record<keyof FarmSetupInput, string>>;

function Section({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
            {step}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
      {message}
    </p>
  );
}

function fieldClass(hasError: boolean) {
  return cn(hasError && "border-danger focus-visible:outline-danger");
}

/** Extract a positive number from a land-area string like "5" or "5 acres". */
function parseLandArea(value: string): number | null {
  const match = value.match(/^\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export default function FarmSetupPage() {
  const { farm, status, saving, createFarm, updateFarm } = useFarm();
  const { t } = useI18n();
  const navigate = useNavigate();
  const isEdit = Boolean(farm);

  const [form, setForm] = useState<FarmSetupInput>({
    farmerName: farm?.farmerName ?? "",
    phone: farm?.phone ?? "",
    email: farm?.email ?? "",
    location: farm?.location ?? "",
    landArea: farm?.landArea ?? "",
    soilType: farm?.soilType ?? "",
    irrigationMethod: farm?.irrigationMethod ?? "",
    currentCrop: farm?.currentCrop ?? "",
    currentCropVariety: farm?.currentCropVariety ?? "",
    plantingDate: farm?.plantingDate ?? "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saved, setSaved] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // The AppLayout gates rendering until status is settled, but guard here too
  // so this page never mounts a stale (empty) form while the farm loads.
  if (status === "loading") {
    return (
      <div className="mx-auto max-w-2xl">
        <LoadingState rows={3} title={t("common.loadingFarm")} />
      </div>
    );
  }

  const setField = <K extends keyof FarmSetupInput>(key: K, value: FarmSetupInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!form.farmerName.trim()) next.farmerName = t("farmSetup.errName");
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim()))
      next.email = t("farmSetup.errEmail");
    if (!form.location.trim()) next.location = t("farmSetup.errLocation");

    if (!form.landArea.trim()) {
      next.landArea = t("farmSetup.errLandArea");
    } else {
      const area = parseLandArea(form.landArea);
      if (area === null || area <= 0) {
        next.landArea = t("farmSetup.errLandAreaPositive");
      }
    }

    if (!form.soilType) next.soilType = t("farmSetup.errSoil");
    if (!form.irrigationMethod) next.irrigationMethod = t("farmSetup.errIrrigation");
    if (!form.currentCrop.trim()) next.currentCrop = t("farmSetup.errCrop");

    if (form.plantingDate) {
      const date = new Date(`${form.plantingDate}T00:00:00`);
      if (Number.isNaN(date.getTime())) {
        next.plantingDate = t("farmSetup.errPlantingDate");
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date.getTime() > today.getTime()) {
          next.plantingDate = t("farmSetup.errPlantingFuture");
        }
      }
    }

    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitError(null);
    try {
      if (isEdit) {
        await updateFarm(form);
      } else {
        await createFarm(form);
      }
      setSaved(true);
      // Short confirmation before advancing to the dashboard.
      window.setTimeout(() => navigate("/dashboard"), 600);
    } catch {
      setSubmitError(t("farmSetup.saveErrorBody"));
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={isEdit ? t("farmSetup.editTitle") : t("farmSetup.createTitle")}
        subtitle={t("farmSetup.subtitle")}
      />

      {saved ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-success/20 bg-success-soft px-5 py-6 text-success animate-fade-in">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              {isEdit ? t("farmSetup.updated") : t("farmSetup.created")}
            </p>
            <p className="text-sm text-success/80">{t("farmSetup.takingYou")}</p>
          </div>
        </div>
      ) : null}

      {submitError ? (
        <Alert variant="danger">
          <AlertTitle>{t("farmSetup.saveErrorTitle")}</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <Section step="1" title={t("farmSetup.sectionFarmer")}>
          <div className="space-y-2">
            <Label htmlFor="farmerName">{t("farmSetup.farmerName")}</Label>
            <Input
              id="farmerName"
              value={form.farmerName}
              onChange={(e) => setField("farmerName", e.target.value)}
              placeholder={t("farmSetup.farmerNamePlaceholder")}
              autoComplete="name"
              aria-invalid={Boolean(errors.farmerName)}
              className={fieldClass(Boolean(errors.farmerName))}
            />
            <FieldError message={errors.farmerName} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">{t("farmSetup.phone")}</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder={t("farmSetup.phonePlaceholder")}
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("farmSetup.email")}</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder={t("farmSetup.emailPlaceholder")}
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                className={fieldClass(Boolean(errors.email))}
              />
              <FieldError message={errors.email} />
            </div>
          </div>
        </Section>

        <Section step="2" title={t("farmSetup.sectionFarm")}>
          <div className="space-y-2">
            <Label htmlFor="location">{t("farmSetup.location")}</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => setField("location", e.target.value)}
              placeholder={t("farmSetup.locationPlaceholder")}
              aria-invalid={Boolean(errors.location)}
              className={fieldClass(Boolean(errors.location))}
            />
            <FieldError message={errors.location} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="landArea">{t("farmSetup.landArea")}</Label>
            <Input
              id="landArea"
              value={form.landArea}
              onChange={(e) => setField("landArea", e.target.value)}
              placeholder={t("farmSetup.landAreaPlaceholder")}
              aria-invalid={Boolean(errors.landArea)}
              className={fieldClass(Boolean(errors.landArea))}
            />
            <FieldError message={errors.landArea} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="soilType">{t("farmSetup.soilType")}</Label>
              <Select value={form.soilType} onValueChange={(v) => setField("soilType", v)}>
                <SelectTrigger id="soilType" className={fieldClass(Boolean(errors.soilType))}>
                  <SelectValue placeholder={t("farmSetup.selectSoil")} />
                </SelectTrigger>
                <SelectContent>
                  {SOIL_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.soilType} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="irrigationMethod">{t("farmSetup.irrigation")}</Label>
              <Select
                value={form.irrigationMethod}
                onValueChange={(v) => setField("irrigationMethod", v)}
              >
                <SelectTrigger id="irrigationMethod" className={fieldClass(Boolean(errors.irrigationMethod))}>
                  <SelectValue placeholder={t("farmSetup.selectIrrigation")} />
                </SelectTrigger>
                <SelectContent>
                  {IRRIGATION_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.irrigationMethod} />
            </div>
          </div>
        </Section>

        <Section step="3" title={t("farmSetup.sectionCrop")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="currentCrop">{t("farmSetup.currentCrop")}</Label>
              <Input
                id="currentCrop"
                value={form.currentCrop}
                onChange={(e) => setField("currentCrop", e.target.value)}
                placeholder={t("farmSetup.currentCropPlaceholder")}
                aria-invalid={Boolean(errors.currentCrop)}
                className={fieldClass(Boolean(errors.currentCrop))}
              />
              <FieldError message={errors.currentCrop} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentCropVariety">{t("farmSetup.variety")}</Label>
              <Input
                id="currentCropVariety"
                value={form.currentCropVariety}
                onChange={(e) => setField("currentCropVariety", e.target.value)}
                placeholder={t("farmSetup.varietyPlaceholder")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plantingDate">{t("farmSetup.plantingDate")}</Label>
            <Input
              id="plantingDate"
              type="date"
              value={form.plantingDate}
              onChange={(e) => setField("plantingDate", e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              aria-invalid={Boolean(errors.plantingDate)}
              className={fieldClass(Boolean(errors.plantingDate))}
            />
            <FieldError message={errors.plantingDate} />
          </div>
        </Section>

        <div className="flex flex-col gap-3 pt-1 sm:flex-row">
          <Button type="submit" size="lg" className="w-full sm:flex-1" disabled={saving}>
            {saving
              ? isEdit
                ? t("farmSetup.saving")
                : t("farmSetup.creating")
              : isEdit
                ? t("farmSetup.updateBtn")
                : t("farmSetup.createBtn")}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {t("farmSetup.secureNote")}
        </p>
      </form>
    </div>
  );
}