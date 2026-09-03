import { Link } from "react-router-dom";
import { ScanLine, UploadCloud } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { useI18n } from "../../context/PreferencesContext";

/**
 * Crop Doctor quick-upload shortcut (Dashboard Phase 2 widget).
 *
 * A visual entry point to the AI Crop Doctor — uploads go to the real
 * /crop-doctor page, which owns the analysis flow.
 */
export function CropDoctorUploadCard() {
  const { t } = useI18n();
  return (
    <Card className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent"
        aria-hidden="true"
      />
      <CardContent className="relative flex flex-col items-start gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
            <ScanLine className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t("dashboard.cropDoctorTitle")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("dashboard.cropDoctorHint")}
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0">
          <Link to="/crop-doctor">
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            {t("dashboard.analyzeNow")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
