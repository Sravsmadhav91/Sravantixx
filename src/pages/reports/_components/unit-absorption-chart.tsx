import { useQuery } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { api } from "@/convex/_generated/api.js";
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils.ts";

const COLORS = [
  "oklch(0.55 0.13 175)",
  "oklch(0.72 0.15 70)",
  "oklch(0.62 0.17 20)",
  "oklch(0.55 0.13 260)",
  "oklch(0.66 0.13 145)",
];

export default function UnitAbsorptionChart() {
  const data = useQuery(api.reports.getUnitAbsorption, {});

  if (data === undefined) return <Skeleton className="h-64 w-full" />;

  if (data.length === 0 || data.every((d) => d.totalUnits === 0)) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Building2 /></EmptyMedia>
          <EmptyTitle>No unit data</EmptyTitle>
          <EmptyDescription>Add units to projects to see absorption rates.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bar progress per project */}
      <div className="space-y-3">
        {data.map((row, i) => (
          <div key={row.projectId} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate max-w-[60%]">{row.name}</span>
              <span className="tabular-nums text-muted-foreground text-xs">
                {row.soldOrBooked}/{row.totalUnits} units · <strong className="text-foreground">{row.absorptionRate}%</strong>
              </span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${row.absorptionRate}%`,
                  backgroundColor: COLORS[i % COLORS.length],
                }}
              />
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="text-emerald-600 dark:text-emerald-400">{row.soldOrBooked} sold/booked</span>
              <span>{row.available} available</span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="rounded-lg bg-muted/40 px-4 py-3 flex flex-wrap gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Total units</p>
          <p className="text-xl font-semibold tabular-nums">{data.reduce((s, d) => s + d.totalUnits, 0)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Sold/Booked</p>
          <p className="text-xl font-semibold tabular-nums text-primary">{data.reduce((s, d) => s + d.soldOrBooked, 0)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Available</p>
          <p className="text-xl font-semibold tabular-nums">{data.reduce((s, d) => s + d.available, 0)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Overall absorption</p>
          <p className="text-xl font-semibold tabular-nums text-primary">
            {data.reduce((s, d) => s + d.totalUnits, 0) > 0
              ? Math.round((data.reduce((s, d) => s + d.soldOrBooked, 0) / data.reduce((s, d) => s + d.totalUnits, 0)) * 100)
              : 0}%
          </p>
        </div>
      </div>
    </div>
  );
}
