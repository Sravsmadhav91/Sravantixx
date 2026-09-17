import { useQuery } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { api } from "@/convex/_generated/api.js";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { Users } from "lucide-react";

const STAGES = [
  { key: "leads" as const, label: "Total Leads", color: "oklch(0.55 0.13 260)" },
  { key: "contacted" as const, label: "Contacted", color: "oklch(0.55 0.13 175)" },
  { key: "siteVisit" as const, label: "Site Visit", color: "oklch(0.72 0.15 70)" },
  { key: "negotiation" as const, label: "Negotiation", color: "oklch(0.62 0.17 20)" },
  { key: "won" as const, label: "Won", color: "oklch(0.42 0.11 175)" },
  { key: "bookings" as const, label: "Active Bookings", color: "oklch(0.56 0.2 27)" },
];

export default function LeadFunnelChart() {
  const data = useQuery(api.reports.getLeadFunnel, {});

  if (data === undefined) return <Skeleton className="h-64 w-full" />;

  const max = data.leads || 1;

  if (data.leads === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Users /></EmptyMedia>
          <EmptyTitle>No lead data yet</EmptyTitle>
          <EmptyDescription>Add leads to see the conversion funnel.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-lg bg-primary/10 px-4 py-3">
        <p className="text-sm font-medium">Lead → Win conversion rate:</p>
        <p className="text-2xl font-bold text-primary">{data.leadConversionRate}%</p>
      </div>
      <div className="space-y-2">
        {STAGES.map((stage) => {
          const value = data[stage.key];
          const pct = Math.round((value / max) * 100);
          const convPct = stage.key !== "leads" && data.leads > 0
            ? Math.round((value / data.leads) * 100)
            : 100;
          return (
            <div key={stage.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{stage.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {value} {stage.key !== "leads" && <span className="text-xs">({convPct}%)</span>}
                </span>
              </div>
              <div className="h-7 w-full overflow-hidden rounded-md bg-muted">
                <div
                  className="h-full rounded-md transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: stage.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
