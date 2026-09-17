import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { cn } from "@/lib/utils.ts";
import { ACCOUNT_GROUP_LABELS } from "@/lib/accounting.ts";

type Props = {
  fromDate: string;
  toDate: string;
  onExportCsv: (rows: string[][], filename: string) => void;
};

const TYPE_ORDER = ["asset", "liability", "income", "expense", "equity"];

export default function TrialBalanceReport({ fromDate, toDate, onExportCsv }: Props) {
  const data = useQuery(api.financialReports.getTrialBalance, { fromDate, toDate });

  if (!data) return <Skeleton className="h-64 w-full" />;

  // Group by type
  const byType = new Map<string, typeof data.rows>();
  for (const row of data.rows) {
    if (!byType.has(row.type)) byType.set(row.type, []);
    byType.get(row.type)!.push(row);
  }

  const handleExport = () => {
    const headers = ["Code", "Account", "Type", "Group", "Opening Bal", "Debit", "Credit", "Balance"];
    const rows = data.rows.map((r) => [
      r.code, r.name, r.type, r.group,
      r.openingBalance.toFixed(2), r.totalDebit.toFixed(2),
      r.totalCredit.toFixed(2), r.balance.toFixed(2),
    ]);
    onExportCsv([headers, ...rows], "trial-balance.csv");
  };

  return (
    <div className="space-y-4">
      {/* Balance status */}
      <div className="flex items-center gap-3">
        {data.isBalanced ? (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-2 text-sm text-green-800 dark:text-green-300">
            <CheckCircle2 className="size-4" /> Books are balanced
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2 text-sm text-destructive">
            <AlertCircle className="size-4" /> Books do not balance — check for missing entries
          </div>
        )}
        <button onClick={handleExport} className="ml-auto text-xs text-muted-foreground hover:text-foreground cursor-pointer underline">
          Export CSV
        </button>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs font-medium text-muted-foreground uppercase">
              <th className="px-4 py-2 text-left w-16">Code</th>
              <th className="px-4 py-2 text-left">Account Name</th>
              <th className="px-4 py-2 text-left">Group</th>
              <th className="px-4 py-2 text-right">Debit (₹)</th>
              <th className="px-4 py-2 text-right">Credit (₹)</th>
              <th className="px-4 py-2 text-right">Balance (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {TYPE_ORDER.map((type) => {
              const rows = byType.get(type);
              if (!rows?.length) return null;
              const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
              return (
                <>
                  <tr key={`hdr-${type}`} className="bg-muted/20">
                    <td colSpan={6} className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {typeLabel}s
                    </td>
                  </tr>
                  {rows.map((row) => (
                    <tr key={row.accountId} className="hover:bg-muted/10">
                      <td className="px-4 py-2 text-xs text-muted-foreground tabular-nums">{row.code}</td>
                      <td className="px-4 py-2">{row.name}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {ACCOUNT_GROUP_LABELS[row.group as keyof typeof ACCOUNT_GROUP_LABELS] ?? row.group}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-sm">
                        {row.totalDebit > 0 ? formatCompactInr(row.totalDebit) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-sm">
                        {row.totalCredit > 0 ? formatCompactInr(row.totalCredit) : "—"}
                      </td>
                      <td className={cn(
                        "px-4 py-2 text-right tabular-nums font-medium text-sm",
                        row.balance < 0 ? "text-destructive" : "",
                      )}>
                        {formatCompactInr(Math.abs(row.balance))}
                        {row.balance < 0 ? " (Cr)" : ""}
                      </td>
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/40 font-semibold text-sm">
              <td className="px-4 py-2" colSpan={3}>Total</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCompactInr(data.totalDebit)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCompactInr(data.totalCredit)}</td>
              <td className="px-4 py-2 text-right">
                <Badge variant={data.isBalanced ? "default" : "destructive"} className="text-xs">
                  {data.isBalanced ? "Balanced" : "Unbalanced"}
                </Badge>
              </td>
            </tr>
          </tfoot>
        </table>
        {data.rows.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No transactions found for the selected period.
          </div>
        )}
      </div>
    </div>
  );
}
