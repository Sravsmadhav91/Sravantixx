import { useQuery } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { api } from "@/convex/_generated/api.js";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { Building2, Download } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import * as XLSX from "xlsx";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function ProjectPnLChart() {
  const data = useQuery(api.reports.getProjectPnL, {});

  if (data === undefined) return <Skeleton className="h-80 w-full" />;

  if (data.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Building2 /></EmptyMedia>
          <EmptyTitle>No project data</EmptyTitle>
          <EmptyDescription>Create projects and record bookings to see P&L.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const chartData = data.map((r) => ({
    name: r.name.length > 14 ? r.name.slice(0, 14) + "…" : r.name,
    fullName: r.name,
    "Revenue Collected": r.totalCollected,
    "Construction Cost": r.constructionCost,
    "Gross Profit": r.grossProfit,
  }));

  const handleExport = () => {
    const rows = data.map((r) => ({
      Project: r.name,
      "Total Booking Value": r.totalBookingValue,
      "Revenue Collected": r.totalCollected,
      "Construction Cost": r.constructionCost,
      "Gross Profit": r.grossProfit,
      "Margin %": r.grossMarginPct,
      "Units Sold": r.unitsSold,
      "Units Booked": r.unitsBooked,
      "Total Units": r.totalUnits,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Project P&L");
    XLSX.writeFile(wb, "project-pnl.xlsx");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download className="size-4" /> Export Excel
        </Button>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v: number) => formatCompactInr(v)} tick={{ fontSize: 11 }} width={72} />
          <Tooltip
            formatter={(v, name) => [INR.format(Number(v ?? 0)), name]}
            labelFormatter={(l, payload) => ((payload as unknown as { payload?: { fullName?: string } }[])?.[0]?.payload?.fullName ?? String(l))}
          />
          <Legend />
          <Bar dataKey="Revenue Collected" fill="oklch(0.55 0.13 175)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Construction Cost" fill="oklch(0.72 0.15 70)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Gross Profit" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.grossProfit >= 0 ? "oklch(0.42 0.11 175)" : "oklch(0.56 0.2 27)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs font-medium text-muted-foreground uppercase">
              <th className="px-3 py-2 text-left">Project</th>
              <th className="px-3 py-2 text-right">Booking Value</th>
              <th className="px-3 py-2 text-right">Collected</th>
              <th className="px-3 py-2 text-right">Cost</th>
              <th className="px-3 py-2 text-right">Gross Profit</th>
              <th className="px-3 py-2 text-right">Margin</th>
              <th className="px-3 py-2 text-right">Units</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((r) => (
              <tr key={r.projectId}>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatCompactInr(r.totalBookingValue)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(r.totalCollected)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">{formatCompactInr(r.constructionCost)}</td>
                <td className={cn("px-3 py-2 text-right tabular-nums font-semibold", r.grossProfit >= 0 ? "text-primary" : "text-destructive")}>
                  {formatCompactInr(r.grossProfit)}
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums text-xs font-medium", r.grossMarginPct >= 0 ? "text-primary" : "text-destructive")}>
                  {r.grossMarginPct}%
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {r.unitsSold + r.unitsBooked}/{r.totalUnits}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
