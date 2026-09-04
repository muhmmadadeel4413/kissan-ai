import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  Plus,
  Ruler,
  Sprout,
  Timer,
  Trash2,
  User,
  Waves,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { EmptyState } from "../components/layout/empty-state";
import { PageHeader } from "../components/layout/page-header";
import { buildFarmContext } from "../lib/farm-context";
import { useFarm } from "../context/FarmContext";
import { usePreferences } from "../context/PreferencesContext";
import { cn } from "../lib/utils";
import type { Farm } from "../types";

/* ------------------------------------------------------------------ */
/* Tab types                                                            */
/* ------------------------------------------------------------------ */

type TabId = "overview" | "fields" | "soil" | "irrigation" | "history";

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
/* StatCard — compact label/value tile                                 */
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
  const { farm, farms, switchFarm, deleteFarm } = useFarm();
  const { t } = usePreferences();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewFarmId = searchParams.get("view");
  const [deleteTarget, setDeleteTarget] = React.useState<Farm | null>(null);

  // Determine which farm to show in detail view
  const viewFarm = viewFarmId ? farms.find((f) => f.id === viewFarmId) ?? null : null;
  const isDetailView = Boolean(viewFarm);

  // ---------- Delete confirmation ----------
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteFarm(deleteTarget.id);
    } catch {
      // Error is already surfaced via context
    }
    setDeleteTarget(null);
  }

  // ---------- Farm List View ----------
  if (!isDetailView) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("farmProfile.myFarms")}
          action={
            <Button asChild>
              <Link to="/farm-setup">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("farmProfile.createNew")}
              </Link>
            </Button>
          }
        />

        {farms.length === 0 ? (
          <EmptyState
            icon={<Sprout className="h-6 w-6" />}
            title={t("farmProfile.createFirstTitle")}
            description={t("farmProfile.createFirst")}
            action={
              <Button asChild>
                <Link to="/farm-setup">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t("farmProfile.createNew")}
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {farms.map((f) => {
              const isActive = f.id === farm?.id;
              const displayName = f.farmName || f.currentCrop || t("farmProfile.untitled");
              const subtitle = [f.landArea, f.currentCrop, f.location].filter(Boolean).join(" • ");

              return (
                <Card
                  key={f.id}
                  className={cn(
                    "card-sheen relative flex flex-col shadow-soft transition-all duration-150",
                    isActive && "ring-2 ring-primary/40"
                  )}
                >
                  {isActive ? (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                      <Sprout className="h-3 w-3" aria-hidden="true" />
                      {t("farmProfile.activeBadge")}
                    </span>
                  ) : null}

                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <Sprout className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="truncate">{displayName}</span>
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-1.5">
                    {subtitle ? (
                      <p className="text-xs text-muted-foreground">{subtitle}</p>
                    ) : null}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      <span className="truncate">{f.location}</span>
                    </div>
                  </CardContent>

                  <CardFooter className="flex gap-2 border-t border-border pt-3">
                    <Button
                      asChild
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                    >
                      <Link to={`/farm-profile?view=${f.id}`}>
                        {t("farmProfile.openFarm")}
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/farm-setup?edit=${f.id}`}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteTarget(f)}
                      aria-label={t("farmProfile.deleteFarm")}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}

            {/* Create New Farm card */}
            <Link to="/farm-setup" className="block cursor-pointer">
              <Card className="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/40 hover:bg-primary-soft/30">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Plus className="h-6 w-6" aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  {t("farmProfile.createNew")}
                </p>
              </Card>
            </Link>
          </div>
        )}

        {/* Delete confirmation dialog */}
        {deleteTarget ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
            <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-pop">
              <h3 className="text-lg font-bold text-foreground">
                {t("farmProfile.deleteConfirmTitle")}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("farmProfile.deleteConfirmBody").replace("{name}", deleteTarget.farmName || deleteTarget.currentCrop || "this farm")}
              </p>
              <div className="mt-5 flex gap-3">
                <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">
                  {t("farmProfile.deleteCancel")}
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {t("farmProfile.deleteConfirmAction")}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // ---------- Farm Detail View ----------
  if (!isDetailView || !viewFarm) {
    return null; // Safety fallback
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        type="button"
        onClick={() => setSearchParams({})}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
      >
        <ChevronRight className="h-4 w-4 rotate-180 rtl:rotate-0" aria-hidden="true" />
        {t("farmProfile.myFarms")}
      </button>

      <FarmDetailView farm={viewFarm} isActive={viewFarm.id === farm?.id} onSwitch={switchFarm} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Farm Detail View (tabbed)                                           */
/* ------------------------------------------------------------------ */

function FarmDetailView({
  farm: f,
  isActive,
  onSwitch,
}: {
  farm: Farm;
  isActive: boolean;
  onSwitch: (id: string) => Promise<void>;
}) {
  const { t } = usePreferences();
  const [activeTab, setActiveTab] = React.useState<TabId>("overview");
  const farmContext = buildFarmContext(f);

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview", label: t("farmProfile.tabOverview"), icon: IdCard },
    { id: "fields", label: t("farmProfile.tabFields"), icon: Ruler },
    { id: "soil", label: t("farmProfile.tabSoil"), icon: Mountain },
    { id: "irrigation", label: t("farmProfile.tabIrrigation"), icon: Droplets },
    { id: "history", label: t("farmProfile.tabHistory"), icon: History },
  ];

  return (
    <>
      {/* Farm name header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Sprout className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">
              {f.farmName || f.currentCrop || t("farmProfile.untitled")}
            </h2>
            <p className="text-xs text-muted-foreground">{f.location}</p>
          </div>
          {isActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">
              {t("farmProfile.activeBadge")}
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          {!isActive ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onSwitch(f.id)}
            >
              Set Active
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link to={`/farm-setup?edit=${f.id}`}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t("farmProfile.editBtn")}
            </Link>
          </Button>
        </div>
      </div>

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
      {activeTab === "overview" && <OverviewTab farm={f} />}
      {activeTab === "fields" && <FieldsTab farm={f} farmContext={farmContext} />}
      {activeTab === "soil" && <SoilTab farm={f} />}
      {activeTab === "irrigation" && <IrrigationTab farm={f} />}
      {activeTab === "history" && <HistoryTab />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Overview Tab                                                         */
/* ------------------------------------------------------------------ */

function OverviewTab({ farm: f }: { farm: Farm }) {
  const { t } = usePreferences();
  const sowingDate = f.plantingDate
    ? new Date(f.plantingDate + "T00:00:00").toLocaleDateString()
    : "";

  return (
    <div className="space-y-6">
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="relative min-h-[260px] overflow-hidden rounded-2xl border border-border bg-muted shadow-soft lg:h-full">
          <img
            src={FARM_HERO_IMAGE}
            alt={t("farmProfile.farmImageAlt")}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/55 via-foreground/5 to-transparent" aria-hidden="true" />
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
            <span className="inline-flex max-w-[70%] items-center gap-1.5 rounded-full bg-background/85 px-3 py-1.5 text-xs font-semibold text-foreground shadow-soft backdrop-blur">
              <Sprout className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate">{f.farmName || f.currentCrop}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground shadow-soft">
              {t("farmProfile.farmBadge")}
            </span>
          </div>
        </div>

        <Card className="card-sheen flex flex-col shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IdCard className="h-5 w-5 text-primary" aria-hidden="true" />
              {t("farmProfile.farmInfoCard")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid flex-1 content-start gap-3.5">
            <InfoRow icon={<Home className="h-4 w-4" />} label={t("farmProfile.farmName")} value={f.farmName ?? ""} />
            <InfoRow icon={<MapPin className="h-4 w-4" />} label={t("farmProfile.location")} value={f.location} />
            <InfoRow icon={<Ruler className="h-4 w-4" />} label={t("farmProfile.totalArea")} value={f.landArea} />
            <InfoRow icon={<Leaf className="h-4 w-4" />} label={t("farmProfile.currentCrop")} value={f.currentCrop} />
            <InfoRow icon={<CalendarDays className="h-4 w-4" />} label={t("farmProfile.sowingDate")} value={sowingDate} />
            <InfoRow icon={<Sprout className="h-4 w-4" />} label={t("farmProfile.cropVariety")} value={f.currentCropVariety ?? ""} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Mountain} label={t("farmProfile.soilType")} value={f.soilType} />
        <StatCard icon={Droplets} label={t("farmProfile.irrigationMethod")} value={f.irrigationMethod} />
        <StatCard icon={Waves} label={t("farmProfile.waterSource")} value={f.waterSource ?? ""} />
        <StatCard icon={Timer} label={t("farmProfile.farmAge")} value={f.farmAgeYears != null ? t("farmProfile.years", { n: f.farmAgeYears }) : ""} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fields Tab                                                          */
/* ------------------------------------------------------------------ */

function FieldsTab({ farm: f, farmContext }: { farm: Farm; farmContext: ReturnType<typeof buildFarmContext> }) {
  const { t } = usePreferences();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("farmProfile.fieldDetails")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={<Home className="h-4 w-4" />} label={t("farmProfile.farmName")} value={f.farmName ?? ""} />
          <InfoRow icon={<Ruler className="h-4 w-4" />} label={t("farmProfile.totalArea")} value={f.landArea} />
          <InfoRow icon={<MapPin className="h-4 w-4" />} label={t("farmProfile.location")} value={f.location} />
          <InfoRow icon={<Waves className="h-4 w-4" />} label={t("farmProfile.waterSource")} value={f.waterSource ?? ""} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sprout className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("farmProfile.cropCard")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={<Leaf className="h-4 w-4" />} label={t("farmProfile.currentCrop")} value={f.currentCrop} />
          <InfoRow icon={<Sprout className="h-4 w-4" />} label={t("farmProfile.cropVariety")} value={f.currentCropVariety ?? ""} />
          <InfoRow icon={<CalendarDays className="h-4 w-4" />} label={t("farmProfile.sowingDate")} value={f.plantingDate ? new Date(f.plantingDate + "T00:00:00").toLocaleDateString() : ""} />
          <InfoRow icon={<Timer className="h-4 w-4" />} label={t("farmProfile.cropAge")} value={farmContext.growth.cropAgeDays !== null ? `${farmContext.growth.cropAgeDays} ${t("farmProfile.days")}` : ""} />
          <InfoRow icon={<Leaf className="h-4 w-4" />} label={t("farmProfile.growthStage")} value={farmContext.growth.stageLabel === "Growth stage unavailable" ? "" : farmContext.growth.stageLabel} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("farmProfile.farmerCard")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={<User className="h-4 w-4" />} label={t("farmProfile.farmerName")} value={f.farmerName} />
          <InfoRow icon={<Phone className="h-4 w-4" />} label={t("farmProfile.phone")} value={f.phone ?? ""} />
          <InfoRow icon={<Mail className="h-4 w-4" />} label={t("farmProfile.email")} value={f.email ?? ""} />
          <InfoRow icon={<IdCard className="h-4 w-4" />} label={t("farmProfile.farmIdCard")} value={f.id} />
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Soil Tab                                                             */
/* ------------------------------------------------------------------ */

function SoilTab({ farm: f }: { farm: Farm }) {
  const { t } = usePreferences();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mountain className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("farmProfile.soilDetails")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={<Mountain className="h-4 w-4" />} label={t("farmProfile.soilType")} value={f.soilType} />
          <InfoRow icon={<MapPin className="h-4 w-4" />} label={t("farmProfile.location")} value={f.location} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Activity className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-foreground">{t("farmProfile.soilTestTitle")}</p>
          <p className="max-w-xs text-xs text-muted-foreground">{t("farmProfile.soilTestHint")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Irrigation Tab                                                       */
/* ------------------------------------------------------------------ */

function IrrigationTab({ farm: f }: { farm: Farm }) {
  const { t } = usePreferences();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("farmProfile.irrigationDetails")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={<Droplets className="h-4 w-4" />} label={t("farmProfile.irrigationMethod")} value={f.irrigationMethod} />
          <InfoRow icon={<Waves className="h-4 w-4" />} label={t("farmProfile.waterSource")} value={f.waterSource ?? ""} />
          <InfoRow icon={<Ruler className="h-4 w-4" />} label={t("farmProfile.totalArea")} value={f.landArea} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
              <Droplets className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{t("farmProfile.irrigationAdvisor")}</p>
              <p className="text-xs text-muted-foreground">{t("farmProfile.irrigationAdvisorHint")}</p>
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
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
              <History className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{t("farmProfile.diagnosisHistory")}</p>
              <p className="text-xs text-muted-foreground">{t("farmProfile.diagnosisHistoryHint")}</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/diagnosis-history">{t("farmProfile.viewHistory")}</Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{t("farmProfile.chatHistory")}</p>
              <p className="text-xs text-muted-foreground">{t("farmProfile.chatHistoryHint")}</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/assistant">{t("farmProfile.viewHistory")}</Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Activity className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-foreground">{t("farmProfile.activityHistory")}</p>
          <p className="max-w-xs text-xs text-muted-foreground">{t("farmProfile.activityHistoryHint")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
