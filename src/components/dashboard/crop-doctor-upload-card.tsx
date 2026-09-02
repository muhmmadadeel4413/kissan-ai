import { Link } from "react-router-dom";
import { ScanLine, Camera, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { usePreferences } from "../../context/PreferencesContext";

/**
 * Inline Crop Doctor upload card for the dashboard. Provides a quick-access
 * entry point that links directly to the Crop Doctor page for photo analysis.
 */
export function CropDoctorUploadCard() {
  const { t } = usePreferences();

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
            <Camera className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("dashboard.cropDoctorTitle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("dashboard.cropDoctorHint")}
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/crop-doctor">
            <ScanLine className="h-4 w-4" aria-hidden="true" />
            {t("dashboard.analyzeNow")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
