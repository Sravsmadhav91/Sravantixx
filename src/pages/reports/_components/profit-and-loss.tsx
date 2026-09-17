import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { cn } from "@/lib/utils.ts";
import { ACCOUNT_GROUP_LABELS } from "@/lib/accounting.ts";

type Props = {
  fromDate: string;
  toDate: string;
  onExportCsv: (rows: string[][], filename: string) => void;
};

const GROUP_ORDER: Record<string, string[]> = {
  income: ["sales_income", "other_income"],
  expense: ["direct_expenses", "indirect_expenses", "finance_charges"],
};

export default function ProfitAndLossReport({ fromDate, toDate, onExportCsv }: Props) {
  const data = useQuery(api.financialReports.getProfitAndLoss, { fromDate, toDate });

  if (!data) return <Skeleton className="h-64 w-full" />;

  const isProfit = data.netProfit >= 0;

  const handleExport = () => {
    const rows: string[][] = [["Section", "Group", "Account", "Amount"]];
    for (const g of data.incomeGroups) {
      for (const a of g.accounts) rows.push(["Income", g.group, a.name, a.balance.toFixed(2)]);
    }
    rows.push(["", "", "Total Income", data.totalIncome.toFixed(2)]);
    for (const g of data.expenseGroups) {
      for (const a of g.accounts) rows.push(["Expenses", g.group, a.name, a.balance.toFixed(2)]);
    }
    rows.push(["", "", "Total Expenses", data.totalExpenses.toFixed(2)]);
    rows.push(["", "", isProfit ? "Net Profit" : "Net Loss", Math.abs(data.netProfit).toFixed(2)]);
    onExportCsv(rows, "profit-and-loss.csv");
  };

  const sortedGroups = <T extends { group: string }>(groups: T[], type: "income" | "expense") => {
    const order = GROUP_ORDER[type] ?? [];
    return [...groups].sort((a, b) => {
      const ia = order.indexOf(a.group);
      const ib = order.indexOf(b.group);
      if (ia === -1 && ib === -1) return a.group.localeCompare(b.group);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className={cn(
          "rounded-lg px-4 py-2 text-sm font-semibold",
          isProfit
            ? "bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800"
            : "bg-destructive/10 text-destructive border border-destructive/20",
        )}>
          {isProfit ? "Net Profit" : "Net Loss"}: {formatCompactInr(Math.abs(data.netProfit))}
        </div>
        <button onClick={handleExport} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline">
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Income */}
        <PLSection
          title="Income"
          color="green"
          groups={sortedGroups(data.incomeGroups, "income")}
          total={data.totalIncome}
        />

        {/* Expenses */}
        <PLSection
          title="Expenses"
          color="red"
          groups={sortedGroups(data.expenseGroups, "expense")}
          total={data.totalExpenses}
        />
      </div>

      {/* Summary */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold bg-muted/30">Summary</div>
        <div className="divide-y text-sm">
          <div className="flex justify-between px-4 py-2">
            <span className="text-muted-foreground">Total Income</span>
            <span className="font-medium tabular-nums text-green-700 dark:text-green-400">{formatCompactInr(data.totalIncome)}</span>
          </div>
          <div className="flex justify-between px-4 py-2">
            <span className="text-muted-foreground">Total Expenses</span>
            <span className="font-medium tabular-nums text-red-700 dark:text-red-400">{formatCompactInr(data.totalExpenses)}</span>
          </div>
          <div className={cn("flex justify-between px-4 py-3 font-semibold", isProfit ? "text-green-700 dark:text-green-400" : "text-destructive")}>
            <span>{isProfit ? "Net Profit" : "Net Loss"}</span>
            <span className="tabular-nums">{formatCompactInr(Math.abs(data.netProfit))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

type PLSectionProps = {
  title: string;
  color: "green" | "red";
  groups: { group: string; accounts: { code: string; name: string; balance: number }[]; subtotal: number }[];
  total: number;
};

function PLSection({ title, color, groups, total }: PLSectionProps) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className={cn(
        "px-4 py-2 text-sm font-semibold flex justify-between",
        color === "green" ? "bg-green-50/50 dark:bg-green-950/20 text-green-800 dark:text-green-300" : "bg-red-50/50 dark:bg-red-950/20 text-red-800 dark:text-red-300",
      )}>
        <span>{title}</span>
        <span className="tabular-nums">{formatCompactInr(total)}</span>
      </div>
      <div className="divide-y">
        {groups.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">No {title.toLowerCase()} entries for this period</p>
        ) : groups.map((g) => (
          <div key={g.group}>
            <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground bg-muted/20 flex justify-between">
              <span>{ACCOUNT_GROUP_LABELS[g.group as keyof typeof ACCOUNT_GROUP_LABELS] ?? g.group}</span>
              <span className="tabular-nums">{formatCompactInr(g.subtotal)}</span>
            </div>
            {g.accounts.map((a) => (
              <div key={a.code} className="flex justify-between px-4 py-1.5 text-sm hover:bg-muted/10">
                <span className="text-muted-foreground text-xs">{a.name}</span>
                <span className="tabular-nums text-xs font-medium">{formatCompactInr(Math.abs(a.balance))}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
