import { useQuery } from "convex/react";
import { Download } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Landmark } from "lucide-react";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  fromDate: string;
  toDate: string;
  onExportCsv: (rows: string[][], filename: string) => void;
};

export default function CostCenterReport({ fromDate, toDate, onExportCsv }: Props) {
  const data = useQuery(api.financialReports.getCostCenterReport, { fromDate, toDate });

  if (data === undefined) return <Skeleton className="h-64 w-full" />;

  if (data.rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Landmark /></EmptyMedia>
          <EmptyTitle>No cost center data</EmptyTitle>
          <EmptyDescription>
            Post journal entries or vouchers tagged with a cost center to see this report.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const handleExport = () => {
    onExportCsv(
      [
        ["Code", "Cost Center", "Income", "Expense", "Net"],
        ...data.rows.map((r) => [r.code, r.name, String(r.income), String(r.expense), String(r.net)]),
        ["", "Total", String(data.totalIncome), String(data.totalExpense), String(data.totalIncome - data.totalExpense)],
      ],
      `cost-center-report-${fromDate}-to-${toDate}.csv`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase">
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Cost Center</th>
              <th className="px-4 py-2 text-right">Income</th>
              <th className="px-4 py-2 text-right">Expense</th>
              <th className="px-4 py-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.costCenterId ?? "unassigned"} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.code}</td>
                <td className={cn("px-4 py-2.5 font-medium", r.costCenterId === null && "text-muted-foreground italic")}>
                  {r.name}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCompactInr(r.income)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCompactInr(r.expense)}</td>
                <td className={cn("px-4 py-2.5 text-right font-medium tabular-nums", r.net < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
                  {formatCompactInr(r.net)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/40 text-xs font-medium">
              <td className="px-4 py-2" colSpan={2}>Total</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCompactInr(data.totalIncome)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCompactInr(data.totalExpense)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCompactInr(data.totalIncome - data.totalExpense)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
