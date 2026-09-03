import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { YieldComparisonPoint } from "../../lib/yield-service";

/**
 * Yield Comparison chart (UI redesign).
 *
 * Renders the real, data-derived season comparison: Previous Season
 * (reference baseline for the saved crop) vs Current Prediction (deterministic
 * projection from the saved farm profile). The chart is a pure presentation of
 * `buildYieldComparison` — it never invents monthly values itself.
 */

const PREVIOUS_COLOR = "#b9c9a8"; // muted sage — previous season
const CURRENT_COLOR = "#4c6b3d"; // brand olive — current prediction
const CURRENT_ACCENT = "#7f9b36"; // lime — used for highlights

function ChartLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-[3px]"
          style={{ backgroundColor: PREVIOUS_COLOR }}
          aria-hidden="true"
        />
        Previous Season
      </span>
      <span className="inline-flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-[3px]"
          style={{ backgroundColor: CURRENT_COLOR }}
          aria-hidden="true"
        />
        Current Prediction
      </span>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number; name?: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lift">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <dl className="mt-1 space-y-0.5">
        {payload.map((entry) => (
          <div key={String(entry.dataKey)} className="flex items-center gap-2 text-xs">
            <dt className="text-muted-foreground">{entry.name}:</dt>
            <dd className="font-semibold text-foreground">{entry.value} tons/acre</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function YieldComparisonChart({ data }: { data: YieldComparisonPoint[] }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">
          Yield Comparison
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Previous season vs current prediction, month by month
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 py-3">
        <ChartLegend />
        <div className="h-72 w-full" role="img" aria-label="Monthly yield comparison chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dce4d2" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={{ stroke: "#dce4d2" }}
                tick={{ fontSize: 11, fill: "#6b7a5e" }}
                interval={0}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#6b7a5e" }}
                unit=""
                width={44}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(124, 155, 54, 0.08)" }} />
              <Bar
                dataKey="previous"
                name="Previous Season"
                fill={PREVIOUS_COLOR}
                radius={[4, 4, 0, 0]}
                maxBarSize={14}
              />
              <Bar
                dataKey="current"
                name="Current Prediction"
                fill={CURRENT_COLOR}
                radius={[4, 4, 0, 0]}
                maxBarSize={14}
                activeBar={{ fill: CURRENT_ACCENT }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
