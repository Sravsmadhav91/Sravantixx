import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { cn } from "@/lib/utils.ts";
import { ACCOUNT_GROUP_LABELS } from "@/lib/accounting.ts";

type Props = {
  asOfDate: string;
  onExportCsv: (rows: string[][], filename: string) => void;
};

export default function BalanceSheetReport({ asOfDate, onExportCsv }: Props) {
  const data = useQuery(api.financialReports.getBalanceSheet, { asOfDate });

  if (!data) return <Skeleton className="h-64 w-full" />;

  const handleExport = () => {
    const rows: string[][] = [["Side", "Type", "Group", "Account", "Balance"]];

    for (const g of data.assets.groups) {
      for (const a of g.accounts) rows.push(["Assets", "Asset", g.group, a.name, Math.abs(a.balance).toFixed(2)]);
    }
    rows.push(["", "", "", "Total Assets", data.totalAssets.toFixed(2)]);

    for (const g of data.liabilities.groups) {
      for (const a of g.accounts) rows.push(["Liabilities & Equity", "Liability", g.group, a.name, Math.abs(a.balance).toFixed(2)]);
    }
    for (const g of data.equity.groups) {
      for (const a of g.accounts) rows.push(["Liabilities & Equity", "Equity", g.group, a.name, Math.abs(a.balance).toFixed(2)]);
    }
    rows.push(["", "", "", "Retained Earnings", data.retainedEarnings.toFixed(2)]);
    rows.push(["", "", "", "Total Liabilities & Equity", data.totalLiabilitiesAndEquity.toFixed(2)]);

    onExportCsv(rows, "balance-sheet.csv");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {data.isBalanced ? (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-2 text-sm text-green-800 dark:text-green-300">
            <CheckCircle2 className="size-4" /> Balance sheet is balanced
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2 text-sm text-destructive">
            <AlertCircle className="size-4" /> Assets ≠ Liabilities + Equity
          </div>
        )}
        <span className="text-xs text-muted-foreground">As of {asOfDate}</span>
        <button onClick={handleExport} className="ml-auto text-xs text-muted-foreground hover:text-foreground cursor-pointer underline">
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Assets */}
        <BSColumn
          title="Assets"
          color="blue"
          sections={[data.assets]}
          total={data.totalAssets}
          footerLabel="Total Assets"
        />

        {/* Liabilities + Equity */}
        <div className="space-y-3">
          <BSColumn
            title="Liabilities"
            color="amber"
            sections={[data.liabilities]}
            total={data.liabilities.total}
            footerLabel="Total Liabilities"
          />
          <BSColumn
            title="Equity"
            color="purple"
            sections={[data.equity]}
            extra={data.retainedEarnings !== 0 ? { label: "Retained Earnings / (Loss)", value: data.retainedEarnings } : undefined}
            total={data.equity.total + data.retainedEarnings}
            footerLabel="Total Equity"
          />
          <div className="rounded-lg border bg-muted/30 flex justify-between px-4 py-3 text-sm font-semibold">
            <span>Total Liabilities + Equity</span>
            <span className={cn("tabular-nums", !data.isBalanced && "text-destructive")}>
              {formatCompactInr(data.totalLiabilitiesAndEquity)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

type Section = {
  type: string;
  groups: { group: string; accounts: { code: string; name: string; balance: number }[]; subtotal: number }[];
  total: number;
};

type BSColumnProps = {
  title: string;
  color: "blue" | "amber" | "purple";
  sections: Section[];
  extra?: { label: string; value: number };
  total: number;
  footerLabel: string;
};

const COLOR_MAP = {
  blue: "bg-blue-50/50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300",
  amber: "bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300",
  purple: "bg-purple-50/50 dark:bg-purple-950/20 text-purple-800 dark:text-purple-300",
};

function BSColumn({ title, color, sections, extra, total, footerLabel }: BSColumnProps) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className={cn("px-4 py-2 text-sm font-semibold flex justify-between", COLOR_MAP[color])}>
        <span>{title}</span>
        <span className="tabular-nums">{formatCompactInr(total)}</span>
      </div>
      <div className="divide-y">
        {sections.map((sec) =>
          sec.groups.length === 0 ? (
            <p key={sec.type} className="px-4 py-4 text-center text-xs text-muted-foreground">No {title.toLowerCase()} entries</p>
          ) : sec.groups.map((g) => (
            <div key={g.group}>
              <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground bg-muted/20 flex justify-between">
                <span>{ACCOUNT_GROUP_LABELS[g.group as keyof typeof ACCOUNT_GROUP_LABELS] ?? g.group}</span>
                <span className="tabular-nums">{formatCompactInr(g.subtotal)}</span>
              </div>
              {g.accounts.map((a) => (
                <div key={a.code} className="flex justify-between px-4 py-1.5 hover:bg-muted/10">
                  <span className="text-xs text-muted-foreground">{a.name}</span>
                  <span className="text-xs tabular-nums font-medium">{formatCompactInr(Math.abs(a.balance))}</span>
                </div>
              ))}
            </div>
          ))
        )}
        {extra && (
          <div className="flex justify-between px-4 py-2 text-sm">
            <span className={cn("text-muted-foreground", extra.value < 0 && "text-destructive")}>{extra.label}</span>
            <span className={cn("font-medium tabular-nums", extra.value < 0 ? "text-destructive" : "text-green-700 dark:text-green-400")}>
              {extra.value < 0 ? `-${formatCompactInr(Math.abs(extra.value))}` : formatCompactInr(extra.value)}
            </span>
          </div>
        )}
      </div>
      <div className="border-t bg-muted/20 flex justify-between px-4 py-2 text-sm font-semibold">
        <span>{footerLabel}</span>
        <span className="tabular-nums">{formatCompactInr(total)}</span>
      </div>
    </div>
  );
}
