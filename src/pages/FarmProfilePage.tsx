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
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { PageHeader } from "../components/layout/page-header";
import { EmptyState } from "../components/layout/empty-state";
import { buildFarmContext } from "../lib/farm-context";
import { useFarm } from "../context/FarmContext";

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

export default function FarmProfilePage() {
  const { farm } = useFarm();

  if (!farm) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={<Sprout className="h-6 w-6" />}
          title="No farm profile yet"
          description="Set up your farm to see your profile and manage your details."
          action={
            <Button asChild>
              <Link to="/farm-setup">Set Up Farm</Link>
            </Button>
          }
        />
      </div>
    );
  }

  // Single source of Farm Context — farm data from the active farm combined
  // with deterministic growth info, recomputed on every render.
  const farmContext = buildFarmContext(farm);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Farm Profile"
        subtitle="Your farm details and settings"
        action={
          <Button asChild variant="outline">
            <Link to="/farm-setup">
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit Farm
            </Link>
          </Button>
        }
      />

      {/* Farm ID placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IdCard className="h-5 w-5 text-primary" aria-hidden="true" />
            Farm ID
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-sm text-foreground">{farm.id}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your secure cloud Farm ID — it links all of your Kissan AI data together.
          </p>
        </CardContent>
      </Card>

      {/* Farmer Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" aria-hidden="true" />
            Farmer Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={<User className="h-4 w-4" />} label="Farmer name" value={farm.farmerName} />
          <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={farm.phone ?? ""} />
          <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={farm.email ?? ""} />
        </CardContent>
      </Card>

      {/* Farm Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
            Farm Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={farm.location} />
          <InfoRow icon={<Ruler className="h-4 w-4" />} label="Land area" value={farm.landArea} />
          <InfoRow icon={<Leaf className="h-4 w-4" />} label="Soil type" value={farm.soilType} />
          <InfoRow
            icon={<Droplets className="h-4 w-4" />}
            label="Irrigation method"
            value={farm.irrigationMethod}
          />
        </CardContent>
      </Card>

      {/* Crop Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sprout className="h-5 w-5 text-primary" aria-hidden="true" />
            Crop Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={<Sprout className="h-4 w-4" />} label="Current crop" value={farm.currentCrop} />
          <InfoRow
            icon={<Leaf className="h-4 w-4" />}
            label="Variety"
            value={farm.currentCropVariety ?? ""}
          />
          <InfoRow
            icon={<CalendarDays className="h-4 w-4" />}
            label="Planting date"
            value={
              farm.plantingDate
                ? new Date(farm.plantingDate + "T00:00:00").toLocaleDateString()
                : ""
            }
          />
          <InfoRow
            icon={<Sprout className="h-4 w-4" />}
            label="Crop age"
            value={farmContext.growth.cropAgeDays !== null ? `${farmContext.growth.cropAgeDays} days` : ""}
          />
          <InfoRow
            icon={<Leaf className="h-4 w-4" />}
            label="Growth stage"
            value={farmContext.growth.stageLabel === "Growth stage unavailable" ? "" : farmContext.growth.stageLabel}
          />
        </CardContent>
      </Card>
    </div>
  );
}