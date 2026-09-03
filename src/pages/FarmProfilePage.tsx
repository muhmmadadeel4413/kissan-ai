import * as React from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  CalendarDays,
  ChevronRight,
  Droplets,
  History,
  Home,
  IdCard,
  Leaf,
  Mail,
  MapPin,
  MessageSquare,
  Mountain,
  Pencil,
  Phone,
  Ruler,
  Sprout,
  Timer,
  User,
  Waves,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { EmptyState } from "../components/layout/empty-state";
import { buildFarmContext } from "../lib/farm-context";
import { useFarm } from "../context/FarmContext";
import { usePreferences } from "../context/PreferencesContext";
import { cn } from "../lib/utils";

/* ------------------------------------------------------------------ */
/* Tab types                                                            */
/* ------------------------------------------------------------------ */

type TabId = "overview" | "fields" | "soil" | "irrigation" | "history";

/**
 * Decorative hero visual for the farm. The app stores no farm photo today,
 * so a representative field image stands in as pure presentation — it is
 * never treated as user data and never replaced by a real upload field.
 */
const FARM_HERO_IMAGE =
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=80";

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
        <p className="truncate text-sm font-semibold text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StatCard — compact label/value tile (bottom info cards)             */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="card-sheen p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-semibold text-foreground">{value || "—"}</p>
        </div>
      </div>
    </Card>
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
    { id: "fields", label: t("farmProfile.tabFields"), icon: Ruler },
    { id: "soil", label: t("farmProfile.tabSoil"), icon: Mountain },
    { id: "irrigation", label: t("farmProfile.tabIrrigation"), icon: Droplets },
    { id: "history", label: t("farmProfile.tabHistory"), icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb — My Farm / Farm Profile */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
        <Link
          to="/dashboard"
          className="font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground cursor-pointer"
        >
          {t("farmProfile.breadcrumbMyFarm")}
        </Link>
        <ChevronRight
          className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180"
          aria-hidden="true"
        />
        <span aria-current="page" className="font-semibold text-foreground">
          {t("page.farmProfile")}
        </span>
      </nav>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Farm profile sections"
        className="flex items-center gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative -mb-px flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors duration-150",
                active
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              <Icon
                className={cn("h-4 w-4", active ? "text-accent" : "text-muted-foreground")}
                aria-hidden="true"
              />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab farm={farm} />}
      {activeTab === "fields" && <FieldsTab farm={farm} farmContext={farmContext} />}
      {activeTab === "soil" && <SoilTab farm={farm} />}
      {activeTab === "irrigation" && <IrrigationTab farm={farm} />}
      {activeTab === "history" && <HistoryTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview Tab — reference layout                                     */
/* ------------------------------------------------------------------ */

function OverviewTab({
  farm,
}: {
  farm: ReturnType<typeof useFarm>["farm"] & object;
}) {
  const { t } = usePreferences();

  const sowingDate = farm.plantingDate
    ? new Date(farm.plantingDate + "T00:00:00").toLocaleDateString()
    : "";

  return (
    <div className="space-y-6">
      {/* Large farm image + Farm Information card */}
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Large farm image */}
        <div className="relative min-h-[260px] overflow-hidden rounded-2xl border border-border bg-muted shadow-soft lg:h-full">
          <img
            src={FARM_HERO_IMAGE}
            alt={t("farmProfile.farmImageAlt")}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-foreground/55 via-foreground/5 to-transparent"
            aria-hidden="true"
          />
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
            <span className="inline-flex max-w-[70%] items-center gap-1.5 rounded-full bg-background/85 px-3 py-1.5 text-xs font-semibold text-foreground shadow-soft backdrop-blur">
              <Sprout className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate">{farm.farmName || farm.currentCrop}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground shadow-soft">
              {t("farmProfile.farmBadge")}
            </span>
          </div>
        </div>

        {/* Farm Information card */}
        <Card className="card-sheen flex flex-col shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IdCard className="h-5 w-5 text-primary" aria-hidden="true" />
              {t("farmProfile.farmInfoCard")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid flex-1 content-start gap-3.5">
            <InfoRow
              icon={<Home className="h-4 w-4" />}
              label={t("farmProfile.farmName")}
              value={farm.farmName ?? ""}
            />
            <InfoRow
              icon={<MapPin className="h-4 w-4" />}
              label={t("farmProfile.location")}
              value={farm.location}
            />
            <InfoRow
              icon={<Ruler className="h-4 w-4" />}
              label={t("farmProfile.totalArea")}
              value={farm.landArea}
            />
            <InfoRow
              icon={<Leaf className="h-4 w-4" />}
              label={t("farmProfile.currentCrop")}
              value={farm.currentCrop}
            />
            <InfoRow
              icon={<CalendarDays className="h-4 w-4" />}
              label={t("farmProfile.sowingDate")}
              value={sowingDate}
            />
            <InfoRow
              icon={<Sprout className="h-4 w-4" />}
              label={t("farmProfile.cropVariety")}
              value={farm.currentCropVariety ?? ""}
            />
          </CardContent>
          <CardFooter className="border-t border-border pt-4">
            <Button asChild className="w-full">
              <Link to="/farm-setup">
                <Pencil className="h-4 w-4" aria-hidden="true" />
                {t("farmProfile.editBtn")}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Bottom info cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Mountain} label={t("farmProfile.soilType")} value={farm.soilType} />
        <StatCard
          icon={Droplets}
          label={t("farmProfile.irrigationMethod")}
          value={farm.irrigationMethod}
        />
        <StatCard icon={Waves} label={t("farmProfile.waterSource")} value={farm.waterSource ?? ""} />
        <StatCard
          icon={Timer}
          label={t("farmProfile.farmAge")}
          value={
            farm.farmAgeYears != null ? t("farmProfile.years", { n: farm.farmAgeYears }) : ""
          }
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fields Tab                                                          */
/* ------------------------------------------------------------------ */

function FieldsTab({
  farm,
  farmContext,
}: {
  farm: ReturnType<typeof useFarm>["farm"] & object;
  farmContext: ReturnType<typeof buildFarmContext>;
}) {
  const { t } = usePreferences();

  return (
    <div className="space-y-6">
      {/* Field details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("farmProfile.fieldDetails")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={<Home className="h-4 w-4" />} label={t("farmProfile.farmName")} value={farm.farmName ?? ""} />
          <InfoRow icon={<Ruler className="h-4 w-4" />} label={t("farmProfile.totalArea")} value={farm.landArea} />
          <InfoRow icon={<MapPin className="h-4 w-4" />} label={t("farmProfile.location")} value={farm.location} />
          <InfoRow icon={<Waves className="h-4 w-4" />} label={t("farmProfile.waterSource")} value={farm.waterSource ?? ""} />
        </CardContent>
      </Card>

      {/* Current crop */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sprout className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("farmProfile.cropCard")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={<Leaf className="h-4 w-4" />} label={t("farmProfile.currentCrop")} value={farm.currentCrop} />
          <InfoRow icon={<Sprout className="h-4 w-4" />} label={t("farmProfile.cropVariety")} value={farm.currentCropVariety ?? ""} />
          <InfoRow
            icon={<CalendarDays className="h-4 w-4" />}
            label={t("farmProfile.sowingDate")}
            value={
              farm.plantingDate
                ? new Date(farm.plantingDate + "T00:00:00").toLocaleDateString()
                : ""
            }
          />
          <InfoRow
            icon={<Timer className="h-4 w-4" />}
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

      {/* Farmer information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("farmProfile.farmerCard")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={<User className="h-4 w-4" />} label={t("farmProfile.farmerName")} value={farm.farmerName} />
          <InfoRow icon={<Phone className="h-4 w-4" />} label={t("farmProfile.phone")} value={farm.phone ?? ""} />
          <InfoRow icon={<Mail className="h-4 w-4" />} label={t("farmProfile.email")} value={farm.email ?? ""} />
          <InfoRow icon={<IdCard className="h-4 w-4" />} label={t("farmProfile.farmIdCard")} value={farm.id} />
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
          <InfoRow icon={<Mountain className="h-4 w-4" />} label={t("farmProfile.soilType")} value={farm.soilType} />
          <InfoRow icon={<MapPin className="h-4 w-4" />} label={t("farmProfile.location")} value={farm.location} />
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
          <InfoRow icon={<Droplets className="h-4 w-4" />} label={t("farmProfile.irrigationMethod")} value={farm.irrigationMethod} />
          <InfoRow icon={<Waves className="h-4 w-4" />} label={t("farmProfile.waterSource")} value={farm.waterSource ?? ""} />
          <InfoRow icon={<Ruler className="h-4 w-4" />} label={t("farmProfile.totalArea")} value={farm.landArea} />
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
