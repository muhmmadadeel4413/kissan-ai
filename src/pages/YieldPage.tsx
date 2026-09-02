import { Info, TrendingUp } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { PageHeader, SectionHeader } from "../components/layout/page-header";
import { useFarm } from "../context/FarmContext";

export default function YieldPage() {
  const { farm } = useFarm();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yield Prediction"
        subtitle={farm ? `Expected yield for your ${farm.currentCrop} crop` : "Expected yield range and confidence"}
      />

      {/* Prediction display — labeled unavailable, no fake values */}
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <TrendingUp className="h-7 w-7" aria-hidden="true" />
          </span>
          <div>
            <p className="text-3xl font-extrabold text-foreground">—</p>
            <p className="text-sm text-muted-foreground">Estimated yield · unit</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="neutral">Range: — – —</Badge>
            <Badge variant="neutral">Confidence: —</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Key factors */}
      <section className="space-y-3">
        <SectionHeader title="Key Factors" subtitle="What influences this prediction" />
        <Card>
          <CardContent className="space-y-2.5 py-5">
            {[
              "Crop and variety",
              "Soil type and irrigation",
              "Weather conditions",
              "Crop health and history",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {f}
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">
              Factors are listed for context. Actual values and their influence
              will be shown once prediction is enabled.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Disclaimer — verbatim from spec */}
      <Alert variant="info">
        <Info className="h-5 w-5" aria-hidden="true" />
        <AlertDescription>
          Yield predictions are estimates based on available farm information and
          conditions. They are not guaranteed harvest results.
        </AlertDescription>
      </Alert>

      <Card className="bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Why is there no number yet?</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Yield prediction needs crop, weather, and history data, and will be
          enabled in a later phase. We won&apos;t show a made-up estimate.
        </CardContent>
      </Card>
    </div>
  );
}