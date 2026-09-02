import * as React from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Droplets,
  IdCard,
  Leaf,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Ruler,
  Sprout,
  User,
  Mountain,
  History,
  MessageSquare,
  Activity,
  Waves,
  Timer,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { PageHeader } from "../components/layout/page-header";
import { EmptyState } from "../components/layout/empty-state";
import { buildFarmContext } from "../lib/farm-context";
import { useFarm } from "../context/FarmContext";
import { usePreferences } from "../context/PreferencesContext";
import { cn } from "../lib/utils";

/* ------------------------------------------------------------------ */
/* Tab types                                                            */
/* ------------------------------------------------------------------ */

type TabId = "overview" | "soil" | "irrigation" | "history";

/* ------------------------------------------------------------------ */
/* InfoRow — shared display helper                                      */
/* ------------------------------------------------------------------ */

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function FarmProfilePage() {
  const { farm } = useFarm();
  const { t } = usePreferences();
  const [activeTab, setActiveTab] = React.useState<TabId>("overview");

  if (!farm) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={<Sprout className="h-6 w-6" />}
          title={t("farmProfile.noFarmTitle")}
          description={t("farmProfile.noFarmDesc")}
          action={
            <Button asChild>
              <Link to="/farm-setup">{t("farmSetup.createBtn")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const farmContext = buildFarmContext(farm);

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview", label: t("farmProfile.tabOverview"), icon: IdCard },
    { id: "soil", label: t("farmProfile.tabSoil"), icon: Mountain },
    { id: "irrigation", label: t("farmProfile.tabIrrigation"), icon: Droplets },
    { id: "history", label: t("farmProfile.tabHistory"), icon: History },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={t("page.farmProfile")}
        subtitle={farm.farmName ? farm.farmName : t("farmProfile.subtitle")}
        action={
          <Button asChild variant="outline">
            <Link to="/farm-setup">
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t("farmProfile.editBtn")}
            </Link>
          </Button>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 cursor-pointer",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab farm={farm} farmContext={farmContext} />}
      {activeTab === "soil" && <SoilTab farm={farm} />}
      {activeTab === "irrigation" && <IrrigationTab farm={farm} />}
      {activeTab === "history" && <HistoryTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview Tab                                                         */
/* ------------------------------------------------------------------ */

function OverviewTab({
  farm,
  farmContext,
}: {
  farm: ReturnType<typeof useFarm>["farm"] & object;
  farmContext: ReturnType<typeof buildFarmContext>;
}) {
  const { t } = usePreferences();

  return (
    <div className="space-y-6">
      {/* Farm ID + name */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IdCard className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("farmProfile.farmIdCard")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="font-mono text-sm text-foreground">{farm.id}</p>
          {farm.farmName ? (
            <div className="flex items-center gap-2">
              <Badge variant="default">{farm.farmName}</Badge>
            </div>
          ) : null}
          {farm.farmAgeYears != null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Timer className="h-4 w-4" aria-hidden="true" />
              {farm.farmAgeYears} {t("farmProfile.yearsOperating")}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t("farmProfile.farmIdHint")}
          </p>
        </CardContent>
      </Card>

      {/* Farmer Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("farmProfile.farmerCard")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={<User className="h-4 w-4" />} label={t("farmSetup.farmerName")} value={farm.farmerName} />
          <InfoRow icon={<Phone className="h-4 w-4" />} label={t("farmSetup.phone")} value={farm.phone ?? ""} />
          <InfoRow icon={<Mail className="h-4 w-4" />} label={t("farmSetup.email")} value={farm.email ?? ""} />
        </CardContent>
      </Card>

      {/* Farm Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("farmProfile.farmInfoCard")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={<MapPin className="h-4 w-4" />} label={t("farmSetup.location")} value={farm.location} />
          <InfoRow icon={<Ruler className="h-4 w-4" />} label={t("farmSetup.landArea")} value={farm.landArea} />
          <InfoRow icon={<Leaf className="h-4 w-4" />} label={t("farmSetup.soilType")} value={farm.soilType} />
          <InfoRow icon={<Droplets className="h-4 w-4" />} label={t("farmSetup.irrigation")} value={farm.irrigationMethod} />
        </CardContent>
      </Card>

      {/* Crop Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sprout className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("farmProfile.cropCard")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={<Sprout className="h-4 w-4" />} label={t("farmSetup.currentCrop")} value={farm.currentCrop} />
          <InfoRow icon={<Leaf className="h-4 w-4" />} label={t("farmSetup.variety")} value={farm.currentCropVariety ?? ""} />
          <InfoRow
            icon={<CalendarDays className="h-4 w-4" />}
            label={t("farmSetup.plantingDate")}
            value={
              farm.plantingDate
                ? new Date(farm.plantingDate + "T00:00:00").toLocaleDateString()
                : ""
            }
          />
          <InfoRow
            icon={<Sprout className="h-4 w-4" />}
            label={t("farmProfile.cropAge")}
            value={
              farmContext.growth.cropAgeDays !== null
                ? `${farmContext.growth.cropAgeDays} ${t("farmProfile.days")}`
                : ""
            }
          />
          <InfoRow
            icon={<Leaf className="h-4 w-4" />}
            label={t("farmProfile.growthStage")}
            value={
              farmContext.growth.stageLabel === "Growth stage unavailable"
                ? ""
                : farmContext.growth.stageLabel
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Soil Tab                                                             */
/* ------------------------------------------------------------------ */

function SoilTab({ farm }: { farm: ReturnType<typeof useFarm>["farm"] & object }) {
  const { t } = usePreferences();

  return (
    <div className="space-y-6">
      {/* Soil details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mountain className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("farmProfile.soilDetails")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={<Mountain className="h-4 w-4" />} label={t("farmSetup.soilType")} value={farm.soilType} />
          <InfoRow icon={<MapPin className="h-4 w-4" />} label={t("farmSetup.location")} value={farm.location} />
        </CardContent>
      </Card>

      {/* Soil test history placeholder */}
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Activity className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-foreground">
            {t("farmProfile.soilTestTitle")}
          </p>
          <p className="max-w-xs text-xs text-muted-foreground">
            {t("farmProfile.soilTestHint")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Irrigation Tab                                                       */
/* ------------------------------------------------------------------ */

function IrrigationTab({ farm }: { farm: ReturnType<typeof useFarm>["farm"] & object }) {
  const { t } = usePreferences();

  return (
    <div className="space-y-6">
      {/* Irrigation details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("farmProfile.irrigationDetails")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={<Droplets className="h-4 w-4" />} label={t("farmSetup.irrigation")} value={farm.irrigationMethod} />
          <InfoRow icon={<Waves className="h-4 w-4" />} label={t("farmSetup.waterSource")} value={farm.waterSource ?? ""} />
          <InfoRow icon={<Ruler className="h-4 w-4" />} label={t("farmSetup.landArea")} value={farm.landArea} />
        </CardContent>
      </Card>

      {/* Link to irrigation advisor */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
              <Droplets className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("farmProfile.irrigationAdvisor")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("farmProfile.irrigationAdvisorHint")}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/irrigation">{t("farmProfile.openAdvisor")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* History Tab                                                          */
/* ------------------------------------------------------------------ */

function HistoryTab() {
  const { t } = usePreferences();

  return (
    <div className="space-y-6">
      {/* Diagnosis history link */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
              <History className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("farmProfile.diagnosisHistory")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("farmProfile.diagnosisHistoryHint")}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/diagnosis-history">{t("farmProfile.viewHistory")}</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Chat history link */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("farmProfile.chatHistory")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("farmProfile.chatHistoryHint")}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/chat-history">{t("farmProfile.viewHistory")}</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Activity history placeholder */}
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Activity className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-foreground">
            {t("farmProfile.activityHistory")}
          </p>
          <p className="max-w-xs text-xs text-muted-foreground">
            {t("farmProfile.activityHistoryHint")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
