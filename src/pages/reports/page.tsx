import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle,
  Download,
  HardHat,
  IndianRupee,
  KeyRound,
  Landmark,
  Scale,
  TrendingUp,
  Users,
  Funnel,
  Percent,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import {
  INSTALLMENT_STATUS_LABELS,
  INSTALLMENT_STATUS_CLASSES,
} from "@/lib/payments.ts";
import { ACCOUNT_GROUP_LABELS } from "@/lib/accounting.ts";
import { cn } from "@/lib/utils.ts";
import * as XLSX from "xlsx";
import TrialBalanceReport from "./_components/trial-balance.tsx";
import ProfitAndLossReport from "./_components/profit-and-loss.tsx";
import BalanceSheetReport from "./_components/balance-sheet.tsx";
import CashFlowStatementReport from "./_components/cash-flow-statement.tsx";
import CostCenterReport from "./_components/cost-center-report.tsx";
import SalesVelocityChart from "./_components/sales-velocity-chart.tsx";
import LeadFunnelChart from "./_components/lead-funnel-chart.tsx";
import ProjectPnLChart from "./_components/project-pnl-chart.tsx";
import UnitAbsorptionChart from "./_components/unit-absorption-chart.tsx";
import TopBuyersTable from "./_components/top-buyers-table.tsx";
import MigrationAccountDialog from "../accounting/_components/migration-account-dialog.tsx";
import {
  getMigrationTopBuyers,
  migrationApiEnabled,
  migrationGet,
  type MigrationTopBuyer,
} from "@/lib/migration-api.ts";
import { useMigrationSalesDashboard } from "@/hooks/use-migration-sales-dashboard.ts";
import { useMigrationCollectionsDashboard } from "@/hooks/use-migration-collections-dashboard.ts";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function MigrationReportsPage() {
  const fy = currentFY();
  const [from, setFrom] = useState(fy.from);
  const [to, setTo] = useState(fy.to);
  const [activeTab, setActiveTab] = useState<ReportTab>("sales-velocity");
  const sales = useMigrationSalesDashboard({
    projectId: "all",
    fromDate: from,
    toDate: to,
  });
  const collections = useMigrationCollectionsDashboard({
    projectId: "all",
    fromDate: from,
    toDate: to,
  });
  const [topBuyers, setTopBuyers] = useState<MigrationTopBuyer[] | undefined>();
  useEffect(() => {
    if (activeTab !== "top-buyers") return;
    setTopBuyers(undefined);
    getMigrationTopBuyers(from, to)
      .then(setTopBuyers)
      .catch(() => setTopBuyers([]));
  }, [activeTab, from, to]);
  const groups = ["analytics", "operations", "financial"] as const;
  if (activeTab !== "sales-velocity" && activeTab !== "top-buyers") {
    return (
      <MigrationReportFrame
        activeTab={activeTab}
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onTabChange={setActiveTab}
      >
        <MigrationOperationalReportPanel
          activeTab={activeTab}
          from={from}
          to={to}
          sales={sales}
          collections={collections}
        />
      </MigrationReportFrame>
    );
  }
  /* superseded by the migration report renderer below
  return ({activeTab === "sales-velocity" ? <Card><CardHeader><CardTitle>Sales Velocity</CardTitle><p className="text-sm text-muted-foreground">Bookings and collections per month with trend.</p></CardHeader><CardContent>{!sales || !collections ? <Skeleton className="h-72 w-full" /> : sales.trend.length === 0 ? <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">No data in this period</div> : <ResponsiveContainer width="100%" height={320}><ComposedChart data={sales.trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis yAxisId="left" tickFormatter={(value: number) => formatCompactInr(value)} tick={{ fontSize: 11 }} width={70} /><YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} width={30} /><Tooltip formatter={(value, name) => [name === "Bookings" ? Number(value ?? 0) : formatCompactInr(Number(value ?? 0)), name]} /><Legend /><Bar yAxisId="left" dataKey="collectedAmount" name="Collections" fill="#00866f" radius={[3, 3, 0, 0]} /><Bar yAxisId="left" dataKey="bookingValue" name="Booking Value" fill="#e89a13" radius={[3, 3, 0, 0]} /><Line yAxisId="right" type="monotone" dataKey="bookingCount" name="Bookings" stroke="#e95555" strokeWidth={2} dot={{ r: 3 }} /></ComposedChart></ResponsiveContainer>}</CardContent></Card> : activeTab === "top-buyers" ? <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Top Buyers</CardTitle><p className="text-sm text-muted-foreground">Buyers ranked by total booking value.</p></div><Button size="sm" variant="secondary" onClick={() => topBuyers && exportCsv([["#", "Buyer", "Bookings", "Booking Value", "Collected", "Outstanding"], ...topBuyers.map((buyer, index) => [String(index + 1), buyer.buyerName, String(buyer.bookingCount), String(buyer.bookingValue), String(buyer.collected), String(buyer.outstanding)])], "top-buyers.csv")}><Download className="size-4" /> Export CSV</Button></div></CardHeader><CardContent>{!topBuyers ? <Skeleton className="h-72 w-full" /> : topBuyers.length === 0 ? <div className="py-16 text-center text-sm text-muted-foreground">No buyers in this period.</div> : <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-2">#</th><th className="px-3 py-2">Buyer</th><th className="px-3 py-2 text-right">Bookings</th><th className="px-3 py-2 text-right">Booking Value</th><th className="px-3 py-2 text-right">Collected</th><th className="px-3 py-2 text-right">Outstanding</th><th className="px-3 py-2" /></tr></thead><tbody className="divide-y">{topBuyers.map((buyer, index) => <tr key={buyer.buyerId}><td className="px-3 py-2 text-xs text-muted-foreground">{index + 1}</td><td className="px-3 py-2"><div className="font-medium">{buyer.buyerName}</div><div className="mt-1 h-1 w-24 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, Math.min(100, (buyer.bookingValue / Math.max(1, topBuyers[0].bookingValue)) * 100))}%` }} /></div></td><td className="px-3 py-2 text-right tabular-nums">{buyer.bookingCount}</td><td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCompactInr(buyer.bookingValue)}</td><td className="px-3 py-2 text-right tabular-nums text-primary">{formatCompactInr(buyer.collected)}</td><td className="px-3 py-2 text-right tabular-nums text-destructive">{formatCompactInr(buyer.outstanding)}</td><td className="px-3 py-2 text-xs text-muted-foreground">View ↗</td></tr>)}</tbody></table></div>}</CardContent></Card> : <Card><CardHeader><CardTitle>{TABS.find((tab) => tab.id === activeTab)?.label}</CardTitle></CardHeader><CardContent className="py-16 text-center text-sm text-muted-foreground">This migration report is being connected to the independent data service.</CardContent></Card>})</div>;
  */
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">REPORTS</p>
          <h1 className="font-serif text-3xl font-semibold">
            Analytics & Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Business intelligence across sales, collections, projects, and
            accounts.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard">← Dashboard</Link>
        </Button>
      </div>
      <div className="space-y-2">
        {groups.map((group) => (
          <div key={group} className="flex flex-wrap gap-1.5">
            {TABS.filter((tab) => tab.group === group).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <Icon className="size-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <DateRangeControls
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
      />
      <Card>
        <CardHeader>
          <CardTitle>
            {activeTab === "top-buyers" ? "Top Buyers" : "Sales Velocity"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {activeTab === "top-buyers"
              ? "Buyers ranked by total booking value."
              : "Bookings and collections per month with trend."}
          </p>
        </CardHeader>
        <CardContent>
          {activeTab === "top-buyers" ? (
            !topBuyers ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Buyer</th>
                      <th className="px-3 py-2 text-right">Bookings</th>
                      <th className="px-3 py-2 text-right">Booking Value</th>
                      <th className="px-3 py-2 text-right">Collected</th>
                      <th className="px-3 py-2 text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {topBuyers.map((buyer, index) => (
                      <tr key={buyer.buyerId}>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{buyer.buyerName}</div>
                          <div className="mt-1 h-1 w-24 rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{
                                width: `${Math.max(8, Math.min(100, (buyer.bookingValue / Math.max(1, topBuyers[0].bookingValue)) * 100))}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {buyer.bookingCount}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {formatCompactInr(buyer.bookingValue)}
                        </td>
                        <td className="px-3 py-2 text-right text-primary">
                          {formatCompactInr(buyer.collected)}
                        </td>
                        <td className="px-3 py-2 text-right text-destructive">
                          {formatCompactInr(buyer.outstanding)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : !sales || !collections ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={sales.trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(value: number) => formatCompactInr(value)}
                />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="collectedAmount"
                  name="Collections"
                  fill="#00866f"
                />
                <Bar
                  yAxisId="left"
                  dataKey="bookingValue"
                  name="Booking Value"
                  fill="#e89a13"
                />
                <Line
                  yAxisId="right"
                  dataKey="bookingCount"
                  name="Bookings"
                  stroke="#e95555"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentFY(): { from: string; to: string } {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: `${year}-04-01`, to: `${year + 1}-03-31` };
}

function exportCsv(rows: string[][], filename: string) {
  const content = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function MigrationReportFrame({
  activeTab,
  from,
  to,
  onFromChange,
  onToChange,
  onTabChange,
  children,
}: {
  activeTab: ReportTab;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onTabChange: (tab: ReportTab) => void;
  children: ReactNode;
}) {
  const groups = ["analytics", "operations", "financial"] as const;
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">REPORTS</p>
          <h1 className="font-serif text-3xl font-semibold">
            Analytics & Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Business intelligence across sales, collections, projects, and
            accounts.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard">← Dashboard</Link>
        </Button>
      </div>
      <div className="space-y-2">
        {groups.map((group) => (
          <div key={group} className="flex flex-wrap gap-1.5">
            {TABS.filter((tab) => tab.group === group).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  <Icon className="size-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <DateRangeControls
        from={from}
        to={to}
        onFromChange={onFromChange}
        onToChange={onToChange}
      />
      {children}
    </div>
  );
}

function MigrationOperationalReportPanel({
  activeTab,
  from,
  to,
  sales,
  collections,
}: {
  activeTab: ReportTab;
  from: string;
  to: string;
  sales: Awaited<ReturnType<typeof useMigrationSalesDashboard>>;
  collections: Awaited<ReturnType<typeof useMigrationCollectionsDashboard>>;
}) {
  const [rows, setRows] = useState<Array<Record<string, string>> | undefined>();
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (activeTab === "lead-funnel" && sales)
        return [
          { label: "Total leads", value: String(sales.kpis.totalLeads) },
          {
            label: "Lead to booking rate",
            value: `${sales.kpis.leadToBookingRate}%`,
          },
        ];
      if (activeTab === "project-pnl" && collections)
        return collections.byProject.map((project) => ({
          label: project.name,
          value: formatCompactInr(
            project.agreementValue - project.collectedAmount,
          ),
          detail: "Estimated outstanding",
        }));
      if (activeTab === "availability") {
        const [projects, units] = await Promise.all([
          migrationGet<Array<Record<string, unknown>>>("/api/projects"),
          migrationGet<Array<Record<string, unknown>>>(
            "/api/tables/units/records",
          ),
        ]);
        const projectMap = new Map(
          projects.map((project) => [
            String(project._id),
            String(project.name || "Project"),
          ]),
        );
        return units
          .slice(0, 100)
          .map((unit) => ({
            label: `${projectMap.get(String(unit.projectId)) || "Project"} · Unit ${String(unit.number || "—")}`,
            value: formatCompactInr(Number(unit.price || 0)),
            detail: `${String(unit.configuration || "")} · ${String(unit.status || "available")}`,
          }));
      }
      if (activeTab === "collections-due") {
        const alerts = await migrationGet<{
          overdue: Array<Record<string, unknown>>;
          upcoming: Array<Record<string, unknown>>;
        }>("/api/collections/alerts");
        return [
          ...alerts.overdue.map((item) => ({
            label: String(item.buyerName || "Buyer"),
            value: formatCompactInr(Number(item.amount || 0)),
            detail: `${String(item.projectName || "Project")} · Overdue · ${String(item.dueDate || "")}`,
          })),
          ...alerts.upcoming.map((item) => ({
            label: String(item.buyerName || "Buyer"),
            value: formatCompactInr(Number(item.amount || 0)),
            detail: `${String(item.projectName || "Project")} · Upcoming · ${String(item.dueDate || "")}`,
          })),
        ];
      }
      if (activeTab === "project-costs") {
        const projects =
          await migrationGet<Array<Record<string, unknown>>>("/api/projects");
        const projectCosts = (
          await Promise.all(
            projects.map((project) =>
              migrationGet<Array<Record<string, unknown>>>(
                `/api/projects/${encodeURIComponent(String(project._id))}/construction/expenses`,
              ),
            ),
          )
        ).flat();
        const filtered = projectCosts.filter(
          (expense) =>
            String(expense.expenseDate || "").slice(0, 10) >= from &&
            String(expense.expenseDate || "").slice(0, 10) <= to,
        );
        const total = filtered.reduce(
          (sum, expense) => sum + Number(expense.amount || 0),
          0,
        );
        const accountingCount = filtered.filter(
          (expense) => expense.source === "accounting",
        ).length;
        return [
          {
            label: "Project expenses",
            value: formatCompactInr(total),
            detail: `${filtered.length} records · ${accountingCount} linked from accounting`,
          },
        ];
      }
      if (activeTab === "trial-balance") {
        const [accounts, lines, entries] = await Promise.all([
          migrationGet<Array<Record<string, unknown>>>(
            "/api/tables/accounts/records",
          ),
          migrationGet<Array<Record<string, unknown>>>(
            "/api/tables/journalLines/records",
          ),
          migrationGet<Array<Record<string, unknown>>>(
            "/api/tables/journalEntries/records",
          ),
        ]);
        const posted = new Set(
          entries
            .filter(
              (entry) =>
                entry.status === "posted" &&
                String(entry.date || "") >= from &&
                String(entry.date || "") <= to,
            )
            .map((entry) => entry._id),
        );
        return accounts
          .map((account) => {
            const ownLines = lines.filter(
              (line) =>
                line.accountId === account._id &&
                posted.has(line.journalEntryId),
            );
            const debit = ownLines.reduce(
              (sum, line) =>
                sum + (line.side === "debit" ? Number(line.amount || 0) : 0),
              0,
            );
            const credit = ownLines.reduce(
              (sum, line) =>
                sum + (line.side === "credit" ? Number(line.amount || 0) : 0),
              0,
            );
            return {
              accountId: String(account._id || ""),
              label: `${String(account.code || "")} — ${String(account.name || "Account")}`,
              value: formatCompactInr(Math.abs(debit - credit)),
              detail: String(account.group || account.type || "Account"),
              code: String(account.code || ""),
              name: String(account.name || "Account"),
              type: String(account.type || ""),
              group: String(account.group || ""),
              openingBalance: Number(account.openingBalance || 0),
              debit: formatCompactInr(debit),
              credit: formatCompactInr(credit),
            };
          })
          .filter((row) => row.debit !== "₹0" || row.credit !== "₹0");
      }
      if (activeTab === "balance-sheet") {
        const balances = await migrationGet<Array<Record<string, unknown>>>(
          "/api/accounting/balances",
        );
        return balances
          .slice(0, 50)
          .map((balance) => ({
            accountId: String(balance.accountId || ""),
            label: `${String(balance.code || "")} — ${String(balance.name || "Account")}`,
            value: formatCompactInr(Number(balance.balance || 0)),
            detail: String(balance.type || balance.group || "Account"),
            balanceRaw: Number(balance.balance || 0),
            code: String(balance.code || ""),
            name: String(balance.name || "Account"),
            type: String(balance.type || ""),
            group: String(balance.group || ""),
            openingBalance: Number(balance.openingBalance || 0),
          }));
      }
      if (activeTab === "profit-loss" || activeTab === "cash-flow") {
        const summary = await migrationGet<{
          totalIncome: number;
          totalExpenses: number;
          cashBalance: number;
          postedEntryCount: number;
            rows: Array<{
              accountId: string;
            code: string;
            name: string;
            type: string;
            group: string;
              openingBalance: number;
            balance: number;
          }>;
        }>(
          `/api/accounting/financial-summary?fromDate=${encodeURIComponent(from)}&toDate=${encodeURIComponent(to)}`,
        );
        if (activeTab === "profit-loss")
          return [
            {
              label: "Total Income",
              value: formatCompactInr(summary.totalIncome),
              detail: `${summary.postedEntryCount} posted entries`,
            },
            {
              label: "Total Expenses",
              value: formatCompactInr(summary.totalExpenses),
              detail: "Posted expense accounts",
            },
            {
              label: "Net Profit",
              value: formatCompactInr(
                summary.totalIncome - summary.totalExpenses,
              ),
              detail: "Income minus expenses",
            },
            ...summary.rows
              .filter((row) => row.type === "expense")
              .map((row) => ({
                label: `${row.code} — ${row.name}`,
                value: formatCompactInr(row.balance),
                detail: row.group,
                balanceRaw: row.balance,
                accountId: row.accountId,
                code: row.code,
                name: row.name,
                type: row.type,
                group: row.group,
                openingBalance: row.openingBalance,
              })),
          ];
        return [
          {
            label: "Cash / Bank balance",
            value: formatCompactInr(summary.cashBalance),
            detail: `${summary.postedEntryCount} posted entries`,
          },
          ...summary.rows
            .filter((row) => row.group === "bank_and_cash")
            .map((row) => ({
              label: `${row.code} — ${row.name}`,
              value: formatCompactInr(row.balance),
              detail: row.group,
              balanceRaw: row.balance,
              accountId: row.accountId,
              code: row.code,
              name: row.name,
              type: row.type,
              group: row.group,
              openingBalance: row.openingBalance,
            })),
        ];
      }
      if (activeTab === "cost-center") {
        const centers = await migrationGet<Array<Record<string, unknown>>>(
          "/api/tables/costCenters/records",
        );
        return centers.map((center) => ({
          label: String(center.name || "Cost center"),
          value: String(center.code || "Active"),
        }));
      }
      const entries = await migrationGet<Array<Record<string, unknown>>>(
        "/api/tables/journalEntries/records",
      );
      return [
        {
          label: "Journal activity",
          value: String(entries.length),
          detail: "Records available from migration accounting",
        },
      ];
    };
    setRows(undefined);
    load()
      .then((value) => active && setRows(value))
      .catch(() => active && setRows([]));
    return () => {
      active = false;
    };
  }, [activeTab, from, to, sales, collections]);
  if (
    rows &&
    [
      "profit-loss",
      "balance-sheet",
      "cash-flow",
      "cost-center",
      "trial-balance",
    ].includes(activeTab)
  ) {
    return <MigrationStructuredReport activeTab={activeTab} rows={rows} />;
  }
  if (rows && activeTab === "availability")
    return <MigrationAvailabilityReport rows={rows} />;
  if (rows && activeTab === "collections-due")
    return <MigrationCollectionsDueReport rows={rows} />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{TABS.find((tab) => tab.id === activeTab)?.label}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Live migration data for the selected period.
        </p>
      </CardHeader>
      <CardContent>
        {rows === undefined ? (
          <Skeleton className="h-56 w-full" />
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No data in this period.
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {rows.map((row, index) => (
              <div
                key={`${row.label}-${index}`}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{row.label}</p>
                  {row.detail && (
                    <p className="text-xs text-muted-foreground">
                      {row.detail}
                    </p>
                  )}
                </div>
                <span className="font-semibold tabular-nums">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MigrationAvailabilityReport({
  rows,
}: {
  rows: Array<Record<string, string>>;
}) {
  const [status, setStatus] = useState("all");
  const filtered =
    status === "all"
      ? rows
      : rows.filter((row) => row.detail?.toLowerCase().includes(status));
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Unit Availability</CardTitle>
            <p className="text-sm text-muted-foreground">
              Current status of all units across projects.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              exportCsv(
                [
                  ["Project / Unit", "Price", "Details"],
                  ...filtered.map((row) => [
                    row.label,
                    row.value,
                    row.detail ?? "",
                  ]),
                ],
                "unit-availability.csv",
              )
            }
          >
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-2">
          {["all", "available", "on_hold", "booked", "sold"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium",
                status === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {value === "all" ? "All" : value.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2">Project / Unit</th>
                <th className="px-3 py-2">Configuration</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((row, index) => {
                const rowStatus = row.detail?.split(" · ").at(-1) || "";
                return (
                  <tr key={index}>
                    <td className="px-3 py-2 font-medium">{row.label}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.detail?.split(" · ")[0] || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.value}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "capitalize",
                          STATUS_BADGE[rowStatus] ||
                            "bg-muted text-muted-foreground",
                        )}
                      >
                        {rowStatus.replace("_", " ") || "—"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function MigrationCollectionsDueReport({
  rows,
}: {
  rows: Array<Record<string, string>>;
}) {
  const [overdueOnly, setOverdueOnly] = useState(false);
  const filtered = overdueOnly
    ? rows.filter((row) => row.detail?.includes("Overdue"))
    : rows;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Collections Due</CardTitle>
            <p className="text-sm text-muted-foreground">
              Outstanding and overdue payment instalments.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              exportCsv(
                [
                  ["Buyer", "Amount", "Details"],
                  ...filtered.map((row) => [
                    row.label,
                    row.value,
                    row.detail ?? "",
                  ]),
                ],
                "collections-due.csv",
              )
            }
          >
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setOverdueOnly(false)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium",
              !overdueOnly
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            All due
          </button>
          <button
            type="button"
            onClick={() => setOverdueOnly(true)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium",
              overdueOnly
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            Overdue only
          </button>
        </div>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle className="mb-3 size-8 text-primary" />
            <p className="font-medium">All clear</p>
            <p className="text-sm text-muted-foreground">
              No pending instalments found.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Buyer</th>
                  <th className="px-3 py-2">Project / Due Date</th>
                  <th className="px-3 py-2 text-right">Amount Due</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((row, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2 font-medium">{row.label}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.detail}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MigrationStructuredReport({
  activeTab,
  rows,
}: {
  activeTab: ReportTab;
  rows: Array<Record<string, any>>;
}) {
  const [editingAccount, setEditingAccount] = useState<any | undefined>();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const title = TABS.find((tab) => tab.id === activeTab)?.label;
  const accountFromRow = (row: Record<string, any>) => row.accountId ? { _id: row.accountId, code: row.code || String(row.label || "").split(" — ")[0], name: row.name || String(row.label || "Account").split(" — ").slice(1).join(" — ") || String(row.label || "Account"), type: row.type || "asset", group: row.group || row.detail || "bank_and_cash", openingBalance: Number(row.openingBalance || 0) } : undefined;
  const linkedLabel = (row: Record<string, any>) => row.accountId ? <Link to={`/accounting/ledger/${row.accountId}`} className="font-medium text-primary hover:underline">{row.label}</Link> : <span className="font-medium">{row.label}</span>;
  const editButton = (row: Record<string, any>) => row.accountId ? <Button size="sm" variant="ghost" onClick={() => setEditingAccount(accountFromRow(row))}>Edit</Button> : null;
  const groupName = (group: string) => ACCOUNT_GROUP_LABELS[group as keyof typeof ACCOUNT_GROUP_LABELS] ?? group.replaceAll("_", " ");
  const groupedLedgers = (values: Array<Record<string, any>>) => Object.values(values.filter((row) => row.accountId).reduce<Record<string, { group: string; total: number; ledgers: Array<Record<string, any>> }>>((acc, row) => { const group = String(row.group || row.detail || "other"); acc[group] ??= { group, total: 0, ledgers: [] }; acc[group].total += Math.abs(Number(row.balanceRaw ?? (String(row.value || "").replace(/[^0-9.-]/g, "") || 0))); acc[group].ledgers.push(row); return acc; }, {})).filter((row) => row.total > 0.01).sort((a, b) => a.group.localeCompare(b.group));
  const groupedRows = (prefix: string, values: ReturnType<typeof groupedLedgers>) => <div className="divide-y">{values.map((row) => { const key = `${prefix}:${row.group}`; const open = expandedGroups[key] === true; return <div key={key}><button type="button" onClick={() => setExpandedGroups((current) => ({ ...current, [key]: !open }))} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/30"><span className="font-medium capitalize">{groupName(row.group)}</span><span className="shrink-0 font-semibold tabular-nums">{formatCompactInr(row.total)}</span></button>{open && <div className="divide-y bg-muted/20">{row.ledgers.map((ledger) => <div key={ledger.accountId} className="flex items-center justify-between gap-3 px-6 py-2 text-sm"><div>{linkedLabel(ledger)}<p className="text-xs text-muted-foreground">Click ledger for transactions</p></div><span className="shrink-0 font-medium tabular-nums">{ledger.value}</span>{editButton(ledger)}</div>)}</div>}</div>; })}</div>;
  if (activeTab === "trial-balance") {
    const totalDebit = rows.reduce(
      (sum, row) =>
        sum + Number(String(row.debit || "").replace(/[^0-9.-]/g, "") || 0),
      0,
    );
    const totalCredit = rows.reduce(
      (sum, row) =>
        sum + Number(String(row.credit || "").replace(/[^0-9.-]/g, "") || 0),
      0,
    );
    const balanced = Math.abs(totalDebit - totalCredit) < 0.01;
    return (
      <>
      <Card>
        <CardHeader>
          <CardTitle>Trial Balance</CardTitle>
          <p className="text-sm text-muted-foreground">
            Debit and credit totals for all accounts.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!balanced && (
            <div className="w-fit rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Books do not balance — check for missing entries
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Account Name</th>
                  <th className="px-3 py-2">Group</th>
                  <th className="px-3 py-2 text-right">Debit (₹)</th>
                  <th className="px-3 py-2 text-right">Credit (₹)</th>
                  <th className="px-3 py-2 text-right">Balance (₹)</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, index) => {
                  const [code, ...nameParts] = row.label.split(" — ");
                  return (
                    <tr key={index}>
                      <td className="px-3 py-2 font-mono text-xs">{code}</td>
                      <td className="px-3 py-2 font-medium">
                        {row.accountId ? <Link to={`/accounting/ledger/${row.accountId}`} className="text-primary hover:underline">{nameParts.join(" — ")}</Link> : nameParts.join(" — ")}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {row.detail}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.debit}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.credit}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.value}
                      </td>
                      <td className="px-3 py-2 text-right">{editButton(row)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/20 font-semibold">
                  <td className="px-3 py-2" colSpan={3}>
                    Total
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCompactInr(totalDebit)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCompactInr(totalCredit)}
                  </td>
                  <td className="px-3 py-2 text-right" colSpan={2}>
                    <Badge variant={balanced ? "default" : "destructive"}>
                      {balanced ? "Balanced" : "Unbalanced"}
                    </Badge>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
      <MigrationAccountDialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(undefined)} account={editingAccount} />
      </>
    );
  }
  if (activeTab === "balance-sheet") {
    const assets = groupedLedgers(rows.filter((row) => row.type === "asset"));
    const liabilities = groupedLedgers(rows.filter((row) => row.type === "liability" || row.type === "equity"));
    const sideTotal = (values: typeof assets) => values.reduce((sum, row) => sum + row.total, 0);
    const column = (heading: string, values: typeof assets) => <div className="rounded-lg border"><div className="border-b bg-muted/30 px-3 py-2 font-semibold tracking-wide">{heading}</div>{values.length === 0 ? <div className="px-3 py-8 text-center text-xs text-muted-foreground">No entries</div> : groupedRows(heading, values)}<div className="flex justify-between border-t bg-muted/20 px-3 py-2 text-sm font-bold"><span>Total {heading}</span><span>{formatCompactInr(sideTotal(values))}</span></div></div>;
    return (
      <>
      <Card>
        <CardHeader>
          <CardTitle>Balance Sheet</CardTitle>
          <p className="text-sm text-muted-foreground">
            Assets, liabilities, and equity as of date.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-3">
              {column("Liabilities", liabilities)}
            </div>
            <div className="space-y-3">
              {column("Assets", assets)}
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Balance validation is based on the imported accounting ledger.
          </div>
        </CardContent>
      </Card>
      <MigrationAccountDialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(undefined)} account={editingAccount} />
      </>
    );
  }
  if (activeTab === "profit-loss" || activeTab === "cash-flow") {
    const title = activeTab === "profit-loss" ? "Profit & Loss" : "Cash Flow Statement";
    if (activeTab === "profit-loss") {
      const grouped = (type: string) => groupedLedgers(rows.filter((row) => row.type === type));
      const expenses = grouped("expense");
      const income = grouped("income");
      const totalExpenses = expenses.reduce((sum, row) => sum + row.total, 0);
      const totalIncome = income.reduce((sum, row) => sum + row.total, 0);
      const net = totalIncome - totalExpenses;
      const side = (heading: string, values: typeof expenses) => <div className="rounded-lg border"><div className="border-b bg-muted/30 px-3 py-2 font-semibold tracking-wide">{heading}</div>{values.length === 0 ? <div className="px-3 py-8 text-center text-xs text-muted-foreground">No entries</div> : groupedRows(heading, values)}</div>;
      return <><Card><CardHeader><CardTitle>Profit & Loss</CardTitle><p className="text-sm text-muted-foreground">Account group summary for the selected period.</p></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-2">{side("Particulars", expenses)}{side("Particulars", income)}</div><div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm md:grid-cols-3"><div><p className="text-xs text-muted-foreground">Total expenses</p><p className="font-semibold tabular-nums">{formatCompactInr(totalExpenses)}</p></div><div><p className="text-xs text-muted-foreground">Total income</p><p className="font-semibold tabular-nums">{formatCompactInr(totalIncome)}</p></div><div><p className="text-xs text-muted-foreground">{net >= 0 ? "Net Profit" : "Net Loss"}</p><p className={cn("font-semibold tabular-nums", net < 0 && "text-destructive")}>{formatCompactInr(Math.abs(net))}</p></div></div></CardContent></Card><MigrationAccountDialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(undefined)} account={editingAccount} /></>;
    }
    const cashGroups = groupedLedgers(rows);
    return <><Card><CardHeader><CardTitle>{title}</CardTitle><p className="text-sm text-muted-foreground">Cash and bank account group summary for the selected period.</p></CardHeader><CardContent>{cashGroups.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No posted accounting data for this period.</p> : <div className="rounded-lg border">{groupedRows("Cash Flow", cashGroups)}</div>}</CardContent></Card><MigrationAccountDialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(undefined)} account={editingAccount} /></>;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profit & Loss</CardTitle>
        <p className="text-sm text-muted-foreground">
          Income and expenses for the selected period.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="w-fit rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Net Loss: {rows[0]?.value ?? "₹0"}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border">
            <div className="border-b bg-primary/5 px-3 py-2 font-medium text-primary">
              Income
            </div>
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              No income entries for this period
            </div>
          </div>
          <div className="rounded-lg border">
            <div className="border-b bg-destructive/5 px-3 py-2 font-medium text-destructive">
              Expenses
            </div>
            <div className="divide-y">
              {rows.map((row, index) => (
                <div
                  key={index}
                  className="flex justify-between px-3 py-2 text-sm"
                >
                  <span>{row.label}</span>
                  <span className="tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-lg border">
          <div className="border-b px-3 py-2 font-medium">Summary</div>
          {[
            ["Total Income", "₹0"],
            ["Total Expenses", rows[0]?.value ?? "₹0"],
            ["Net Loss", rows[0]?.value ?? "₹0"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between border-b px-3 py-2 text-sm last:border-0"
            >
              <span>{label}</span>
              <span className="font-semibold text-destructive">{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
  if (activeTab === "profit-loss" || activeTab === "cash-flow") {
    const title = activeTab === "profit-loss" ? "Profit & Loss" : "Cash Flow Statement";
    return <Card><CardHeader><CardTitle>{title}</CardTitle><p className="text-sm text-muted-foreground">Posted accounting data for the selected period.</p></CardHeader><CardContent>{rows.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No posted accounting data for this period.</p> : <div className="divide-y rounded-lg border">{rows.map((row, index) => <div key={`${row.label}-${index}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm"><div><p className="font-medium">{row.label}</p>{row.detail && <p className="text-xs text-muted-foreground">{row.detail}</p>}</div><span className="font-semibold tabular-nums">{row.value}</span></div>)}</div>}</CardContent></Card>;
  }
  if (activeTab === "cash-flow") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cash Flow Statement</CardTitle>
          <p className="text-sm text-muted-foreground">
            Operating, investing, and financing cash movements for the selected
            period.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="w-fit rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Net Cash Outflow: {rows[0]?.value ?? "₹0"}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              "Operating Activities",
              "Investing Activities",
              "Financing Activities",
            ].map((label, index) => (
              <div key={label} className="rounded-lg border">
                <div className="border-b px-3 py-2 font-medium text-primary">
                  {label}
                </div>
                <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                  {index === 0
                    ? (rows[0]?.value ?? "No movements")
                    : "No movements in this period"}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border">
            <div className="border-b px-3 py-2 font-medium">
              Cash Reconciliation
            </div>
            {[
              ["Opening Cash & Bank Balance", "—"],
              ["Net Change in Cash", rows[0]?.value ?? "₹0"],
              ["Closing Cash & Bank Balance", "—"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between border-b px-3 py-2 text-sm last:border-0"
              >
                <span>{label}</span>
                <span className="font-semibold tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Income and expenses grouped by cost center for the selected period.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2">
                  {activeTab === "cost-center" ? "Cost Center" : "Account"}
                </th>
                <th className="px-3 py-2">Group</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, index) => (
                <tr key={index}>
                  <td className="px-3 py-2 font-medium">{row.label}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.detail ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.value}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportTab =
  | "sales-velocity"
  | "lead-funnel"
  | "project-pnl"
  | "unit-absorption"
  | "top-buyers"
  | "availability"
  | "collections-due"
  | "project-costs"
  | "trial-balance"
  | "profit-loss"
  | "balance-sheet"
  | "cash-flow"
  | "cost-center";

type TabDef = {
  id: ReportTab;
  label: string;
  icon: typeof Building2;
  group: "analytics" | "operations" | "financial";
};

const TABS: TabDef[] = [
  // analytics
  {
    id: "sales-velocity",
    label: "Sales Velocity",
    icon: TrendingUp,
    group: "analytics",
  },
  { id: "lead-funnel", label: "Lead Funnel", icon: Funnel, group: "analytics" },
  {
    id: "project-pnl",
    label: "Project P&L",
    icon: BarChart3,
    group: "analytics",
  },
  {
    id: "unit-absorption",
    label: "Unit Absorption",
    icon: Percent,
    group: "analytics",
  },
  { id: "top-buyers", label: "Top Buyers", icon: Users, group: "analytics" },
  // operations
  {
    id: "availability",
    label: "Unit Availability",
    icon: KeyRound,
    group: "operations",
  },
  {
    id: "collections-due",
    label: "Collections Due",
    icon: IndianRupee,
    group: "operations",
  },
  {
    id: "project-costs",
    label: "Project Costs",
    icon: HardHat,
    group: "operations",
  },
  // financial
  {
    id: "trial-balance",
    label: "Trial Balance",
    icon: BarChart3,
    group: "financial",
  },
  {
    id: "profit-loss",
    label: "Profit & Loss",
    icon: TrendingUp,
    group: "financial",
  },
  {
    id: "balance-sheet",
    label: "Balance Sheet",
    icon: Scale,
    group: "financial",
  },
  {
    id: "cash-flow",
    label: "Cash Flow",
    icon: IndianRupee,
    group: "financial",
  },
  {
    id: "cost-center",
    label: "Cost Centers",
    icon: Landmark,
    group: "financial",
  },
];

// ── Date range controls ───────────────────────────────────────────────────────

type DateRangeProps = {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
};

function DateRangeControls({
  from,
  to,
  onFromChange,
  onToChange,
}: DateRangeProps) {
  const fy = currentFY();
  const presets = [
    { label: "This FY", from: fy.from, to: fy.to },
    {
      label: "Last FY",
      from: `${parseInt(fy.from.slice(0, 4)) - 1}-04-01`,
      to: `${parseInt(fy.from.slice(0, 4))}-03-31`,
    },
    {
      label: "Q1 (Apr–Jun)",
      from: `${fy.from.slice(0, 4)}-04-01`,
      to: `${fy.from.slice(0, 4)}-06-30`,
    },
    {
      label: "Q2 (Jul–Sep)",
      from: `${fy.from.slice(0, 4)}-07-01`,
      to: `${fy.from.slice(0, 4)}-09-30`,
    },
    {
      label: "Q3 (Oct–Dec)",
      from: `${fy.from.slice(0, 4)}-10-01`,
      to: `${fy.from.slice(0, 4)}-12-31`,
    },
    {
      label: "Q4 (Jan–Mar)",
      from: `${parseInt(fy.from.slice(0, 4)) + 1}-01-01`,
      to: `${parseInt(fy.from.slice(0, 4)) + 1}-03-31`,
    },
  ];

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              onFromChange(p.from);
              onToChange(p.to);
            }}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
              from === p.from && to === p.to
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="space-y-0.5">
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
            className="h-7 text-xs w-36"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            className="h-7 text-xs w-36"
          />
        </div>
      </div>
    </div>
  );
}

// ── Unit availability ─────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  available: "bg-primary/10 text-primary",
  on_hold: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  booked: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  sold: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

const STATUS_LABEL: Record<string, string> = {
  available: "Available",
  on_hold: "On hold",
  booked: "Booked",
  sold: "Sold",
};

function UnitAvailabilityReport() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const data = useQuery(api.reports.getUnitAvailability, {});

  if (data === undefined) return <Skeleton className="h-64 w-full" />;

  const filtered =
    statusFilter === "all"
      ? data
      : data.filter((r) => r.status === statusFilter);

  const handleExport = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [
        "Project",
        "Unit",
        "Block",
        "Configuration",
        "Area (sqft)",
        "Price",
        "Status",
      ],
      ...filtered.map((r) => [
        r.projectName,
        r.unitNumber,
        r.block,
        r.configuration,
        r.areaSqft,
        r.price,
        r.status,
      ]),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Unit Availability");
    XLSX.writeFile(wb, "unit-availability.xlsx");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {["all", "available", "on_hold", "booked", "sold"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors cursor-pointer",
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              {s === "all" ? "All" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download className="size-4" /> Export Excel
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRound />
            </EmptyMedia>
            <EmptyTitle>No units found</EmptyTitle>
            <EmptyDescription>Try changing the status filter.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase">
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Block</th>
                <th className="px-4 py-2">Config</th>
                <th className="px-4 py-2 text-right">Area</th>
                <th className="px-4 py-2 text-right">Price</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.unitId}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-2.5 font-medium">{r.projectName}</td>
                  <td className="px-4 py-2.5">{r.unitNumber}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.block}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.configuration}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {r.areaSqft} sqft
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                    {formatCompactInr(r.price)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_BADGE[r.status] ??
                          "bg-muted text-muted-foreground",
                      )}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/40 text-xs font-medium">
                <td className="px-4 py-2" colSpan={5}>
                  {filtered.length} unit{filtered.length !== 1 ? "s" : ""}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatCompactInr(filtered.reduce((s, r) => s + r.price, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Collections due ───────────────────────────────────────────────────────────

function CollectionsDueReport() {
  const [showOverdue, setShowOverdue] = useState(false);
  const now = new Date().toISOString();
  const data = useQuery(api.reports.getCollectionsDue, {});

  if (data === undefined) return <Skeleton className="h-64 w-full" />;

  const filtered = showOverdue ? data.filter((r) => r.dueDate < now) : data;

  const handleExport = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Buyer", "Project", "Unit", "Milestone", "Amount", "Due Date", "Status"],
      ...filtered.map((r) => [
        r.buyerName,
        r.projectName,
        r.unitNumber,
        r.milestone,
        r.amount,
        r.dueDate.slice(0, 10),
        r.status,
      ]),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Collections Due");
    XLSX.writeFile(wb, "collections-due.xlsx");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setShowOverdue(false)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
              !showOverdue
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            All due
          </button>
          <button
            onClick={() => setShowOverdue(true)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
              showOverdue
                ? "bg-destructive text-destructive-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            Overdue only
          </button>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download className="size-4" /> Export Excel
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CheckCircle />
            </EmptyMedia>
            <EmptyTitle>All clear</EmptyTitle>
            <EmptyDescription>No pending instalments found.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase">
                <th className="px-4 py-2">Buyer</th>
                <th className="px-4 py-2">Project · Unit</th>
                <th className="px-4 py-2">Milestone</th>
                <th className="px-4 py-2">Due date</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isOverdue = r.dueDate < now;
                return (
                  <tr
                    key={r.installmentId}
                    className={cn(
                      "border-b border-border last:border-0",
                      isOverdue && "bg-destructive/5",
                    )}
                  >
                    <td className="px-4 py-2.5 font-medium">{r.buyerName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {r.projectName} · {r.unitNumber}
                    </td>
                    <td className="px-4 py-2.5">{r.milestone}</td>
                    <td
                      className={cn(
                        "px-4 py-2.5 tabular-nums",
                        isOverdue && "text-destructive font-medium",
                      )}
                    >
                      {formatDate(r.dueDate)}
                      {isOverdue && (
                        <AlertTriangle className="ml-1 inline size-3 text-destructive" />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {formatCompactInr(r.amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          INSTALLMENT_STATUS_CLASSES[
                            r.status as keyof typeof INSTALLMENT_STATUS_CLASSES
                          ],
                        )}
                      >
                        {
                          INSTALLMENT_STATUS_LABELS[
                            r.status as keyof typeof INSTALLMENT_STATUS_LABELS
                          ]
                        }
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/collections/${r.bookingId}`}
                        className="text-primary hover:underline text-xs"
                      >
                        View <ArrowUpRight className="ml-0.5 inline size-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/40 text-xs font-medium">
                <td className="px-4 py-2" colSpan={4}>
                  {filtered.length} instalment{filtered.length !== 1 ? "s" : ""}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatCompactInr(filtered.reduce((s, r) => s + r.amount, 0))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Project cost summary ──────────────────────────────────────────────────────

function ProjectCostsReport() {
  const data = useQuery(api.reports.getProjectCostSummary, {});

  if (data === undefined) return <Skeleton className="h-64 w-full" />;

  const handleExport = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Project", "Budget", "Spent", "Remaining", "Progress %", "Stages"],
      ...data.map((r) => [
        r.name,
        r.budget ?? "",
        r.spent,
        r.remaining ?? "",
        r.overallProgress,
        r.stageCount,
      ]),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Project Costs");
    XLSX.writeFile(wb, "project-costs.xlsx");
  };

  if (data.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HardHat />
          </EmptyMedia>
          <EmptyTitle>No project cost data</EmptyTitle>
          <EmptyDescription>
            Add expenses in the Construction section.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download className="size-4" /> Export Excel
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase">
              <th className="px-4 py-2">Project</th>
              <th className="px-4 py-2 text-right">Budget</th>
              <th className="px-4 py-2 text-right">Spent</th>
              <th className="px-4 py-2 text-right">Remaining</th>
              <th className="px-4 py-2">Progress</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const overBudget = r.budget != null && r.spent > r.budget;
              const pct =
                r.budget != null
                  ? Math.min(100, Math.round((r.spent / r.budget) * 100))
                  : null;
              return (
                <tr
                  key={r.projectId}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-2.5 font-medium">{r.name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {r.budget != null ? formatCompactInr(r.budget) : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right font-medium tabular-nums",
                      overBudget && "text-destructive",
                    )}
                  >
                    {formatCompactInr(r.spent)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right tabular-nums",
                      overBudget
                        ? "text-destructive font-medium"
                        : "text-muted-foreground",
                    )}
                  >
                    {r.remaining != null ? formatCompactInr(r.remaining) : "—"}
                    {overBudget && " ⚠"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${r.overallProgress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {r.overallProgress}%
                      </span>
                      {pct != null && (
                        <span
                          className={cn(
                            "text-xs",
                            overBudget
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          ({pct}% budget)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/construction/${r.projectId}`}
                      className="text-primary hover:underline text-xs"
                    >
                      Details <ArrowUpRight className="ml-0.5 inline size-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/40 text-xs font-medium">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatCompactInr(
                  data.reduce((s, r) => s + (r.budget ?? 0), 0),
                )}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatCompactInr(data.reduce((s, r) => s + r.spent, 0))}
              </td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Tab group renderer ────────────────────────────────────────────────────────

function TabGroup({
  label,
  tabs,
  activeTab,
  onSelect,
}: {
  label: string;
  tabs: TabDef[];
  activeTab: ReportTab;
  onSelect: (id: ReportTab) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 items-center">
      <span className="text-xs text-muted-foreground mr-1">{label}</span>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
            )}
          >
            <Icon className="size-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Tab title/description map ─────────────────────────────────────────────────

const TAB_META: Record<ReportTab, { title: string; description: string }> = {
  "sales-velocity": {
    title: "Sales Velocity",
    description: "Bookings and collections per month with trend.",
  },
  "lead-funnel": {
    title: "Lead Funnel",
    description: "Lead-to-booking conversion funnel.",
  },
  "project-pnl": {
    title: "Project P&L",
    description: "Revenue collected vs construction cost per project.",
  },
  "unit-absorption": {
    title: "Unit Absorption",
    description: "Percentage of units sold or booked per project.",
  },
  "top-buyers": {
    title: "Top Buyers",
    description: "Buyers ranked by total booking value.",
  },
  availability: {
    title: "Unit Availability",
    description: "Current status of all units across projects.",
  },
  "collections-due": {
    title: "Collections Due",
    description: "Outstanding and overdue payment installments.",
  },
  "project-costs": {
    title: "Project Costs",
    description: "Construction budget vs actual spend.",
  },
  "trial-balance": {
    title: "Trial Balance",
    description: "Debit and credit totals for all accounts.",
  },
  "profit-loss": {
    title: "Profit & Loss",
    description: "Income and expenses for the selected period.",
  },
  "balance-sheet": {
    title: "Balance Sheet",
    description: "Assets, liabilities, and equity as of date.",
  },
  "cash-flow": {
    title: "Cash Flow Statement",
    description:
      "Operating, investing, and financing cash movements for the selected period.",
  },
  "cost-center": {
    title: "Cost Center Report",
    description:
      "Income and expenses grouped by cost center for the selected period.",
  },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  if (migrationApiEnabled) return <MigrationReportsPage />;
  const [activeTab, setActiveTab] = useState<ReportTab>("sales-velocity");
  const fy = currentFY();
  const [fromDate, setFromDate] = useState(fy.from);
  const [toDate, setToDate] = useState(fy.to);

  const needsDates = [
    "trial-balance",
    "profit-loss",
    "balance-sheet",
    "cash-flow",
    "sales-velocity",
    "cost-center",
  ].includes(activeTab);
  const analyticsTabs = TABS.filter((t) => t.group === "analytics");
  const operationalTabs = TABS.filter((t) => t.group === "operations");
  const financialTabs = TABS.filter((t) => t.group === "financial");
  const meta = TAB_META[activeTab];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Reports
          </p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Analytics & Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Business intelligence across sales, collections, projects, and
            accounts.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard">← Dashboard</Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="space-y-2 border-b border-border pb-3">
        <TabGroup
          label="📊 Analytics"
          tabs={analyticsTabs}
          activeTab={activeTab}
          onSelect={setActiveTab}
        />
        <TabGroup
          label="🏗 Operations"
          tabs={operationalTabs}
          activeTab={activeTab}
          onSelect={setActiveTab}
        />
        <TabGroup
          label="📒 Financial"
          tabs={financialTabs}
          activeTab={activeTab}
          onSelect={setActiveTab}
        />
      </div>

      {/* Date range */}
      {needsDates && (
        <DateRangeControls
          from={fromDate}
          to={toDate}
          onFromChange={setFromDate}
          onToChange={setToDate}
        />
      )}

      {/* Report card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            {meta.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </CardHeader>
        <CardContent className="pt-2">
          {activeTab === "sales-velocity" && (
            <SalesVelocityChart fromDate={fromDate} toDate={toDate} />
          )}
          {activeTab === "lead-funnel" && <LeadFunnelChart />}
          {activeTab === "project-pnl" && <ProjectPnLChart />}
          {activeTab === "unit-absorption" && <UnitAbsorptionChart />}
          {activeTab === "top-buyers" && <TopBuyersTable />}
          {activeTab === "availability" && <UnitAvailabilityReport />}
          {activeTab === "collections-due" && <CollectionsDueReport />}
          {activeTab === "project-costs" && <ProjectCostsReport />}
          {activeTab === "trial-balance" && (
            <TrialBalanceReport
              fromDate={fromDate}
              toDate={toDate}
              onExportCsv={exportCsv}
            />
          )}
          {activeTab === "profit-loss" && (
            <ProfitAndLossReport
              fromDate={fromDate}
              toDate={toDate}
              onExportCsv={exportCsv}
            />
          )}
          {activeTab === "balance-sheet" && (
            <BalanceSheetReport asOfDate={toDate} onExportCsv={exportCsv} />
          )}
          {activeTab === "cash-flow" && (
            <CashFlowStatementReport
              fromDate={fromDate}
              toDate={toDate}
              onExportCsv={exportCsv}
            />
          )}
          {activeTab === "cost-center" && (
            <CostCenterReport
              fromDate={fromDate}
              toDate={toDate}
              onExportCsv={exportCsv}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
