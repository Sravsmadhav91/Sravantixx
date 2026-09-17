import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { cn } from "@/lib/utils.ts";
import { ACCOUNT_GROUP_LABELS } from "@/lib/accounting.ts";

type Props = {
  fromDate: string;
  toDate: string;
  onExportCsv: (rows: string[][], filename: string) => void;
};

type Section = { groups: { group: string; amount: number }[]; subtotal: number };

export default function CashFlowStatementReport({ fromDate, toDate, onExportCsv }: Props) {
  const data = useQuery(api.financialReports.getCashFlowStatement, { fromDate, toDate });

  if (!data) return <Skeleton className="h-64 w-full" />;

  const netChangeMatches = Math.abs(data.closingCashBalance - data.openingCashBalance - data.netCashFlow) < 1;

  const handleExport = () => {
    const rows: string[][] = [["Activity", "Group", "Amount"]];
    const push = (label: string, section: Section) => {
      for (const g of section.groups) {
        rows.push([label, ACCOUNT_GROUP_LABELS[g.group as keyof typeof ACCOUNT_GROUP_LABELS] ?? g.group, g.amount.toFixed(2)]);
      }
      rows.push([label, "Net", section.subtotal.toFixed(2)]);
    };
    push("Operating Activities", data.operating);
    push("Investing Activities", data.investing);
    push("Financing Activities", data.financing);
    rows.push(["", "Net Change in Cash", data.netCashFlow.toFixed(2)]);
    rows.push(["", "Opening Cash Balance", data.openingCashBalance.toFixed(2)]);
    rows.push(["", "Closing Cash Balance", data.closingCashBalance.toFixed(2)]);
    onExportCsv(rows, "cash-flow-statement.csv");
  };

  const isInflow = data.netCashFlow >= 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold",
            isInflow
              ? "bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800"
              : "bg-destructive/10 text-destructive border border-destructive/20",
          )}
        >
          {isInflow ? <ArrowUpCircle className="size-4" /> : <ArrowDownCircle className="size-4" />}
          Net {isInflow ? "Cash Inflow" : "Cash Outflow"}: {formatCompactInr(Math.abs(data.netCashFlow))}
        </div>
        <button onClick={handleExport} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline">
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CFSection title="Operating Activities" color="blue" section={data.operating} />
        <CFSection title="Investing Activities" color="amber" section={data.investing} />
        <CFSection title="Financing Activities" color="purple" section={data.financing} />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold bg-muted/30">Cash Reconciliation</div>
        <div className="divide-y text-sm">
          <div className="flex justify-between px-4 py-2">
            <span className="text-muted-foreground">Opening Cash & Bank Balance</span>
            <span className="font-medium tabular-nums">{formatCompactInr(data.openingCashBalance)}</span>
          </div>
          <div className="flex justify-between px-4 py-2">
            <span className="text-muted-foreground">Net Change in Cash</span>
            <span className={cn("font-medium tabular-nums", isInflow ? "text-green-700 dark:text-green-400" : "text-destructive")}>
              {isInflow ? "+" : "-"}{formatCompactInr(Math.abs(data.netCashFlow))}
            </span>
          </div>
          <div className="flex justify-between px-4 py-3 font-semibold">
            <span>Closing Cash & Bank Balance</span>
            <span className="tabular-nums">{formatCompactInr(data.closingCashBalance)}</span>
          </div>
        </div>
        {!netChangeMatches && (
          <p className="px-4 py-2 text-xs text-destructive border-t">
            Note: closing balance does not exactly match opening + net change. This can happen with entries dated outside
            posted status changes — review the day book for this period.
          </p>
        )}
      </div>
    </div>
  );
}

type CFSectionProps = {
  title: string;
  color: "blue" | "amber" | "purple";
  section: Section;
};

const COLOR_MAP = {
  blue: "bg-blue-50/50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300",
  amber: "bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300",
  purple: "bg-purple-50/50 dark:bg-purple-950/20 text-purple-800 dark:text-purple-300",
};

function CFSection({ title, color, section }: CFSectionProps) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className={cn("px-4 py-2 text-sm font-semibold flex justify-between", COLOR_MAP[color])}>
        <span>{title}</span>
        <span className="tabular-nums">{formatCompactInr(section.subtotal)}</span>
      </div>
      <div className="divide-y">
        {section.groups.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">No movements in this period</p>
        ) : (
          section.groups.map((g) => (
            <div key={g.group} className="flex justify-between px-4 py-1.5 text-sm hover:bg-muted/10">
              <span className="text-muted-foreground text-xs">
                {ACCOUNT_GROUP_LABELS[g.group as keyof typeof ACCOUNT_GROUP_LABELS] ?? g.group}
              </span>
              <span className={cn("tabular-nums text-xs font-medium", g.amount < 0 && "text-destructive")}>
                {g.amount < 0 ? "-" : ""}{formatCompactInr(Math.abs(g.amount))}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
