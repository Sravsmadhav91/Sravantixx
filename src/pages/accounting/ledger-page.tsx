import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { Authenticated } from "convex/react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { ScrollText } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLORS, ACCOUNT_GROUP_LABELS } from "@/lib/accounting.ts";
import { migrationApiEnabled, migrationGet } from "@/lib/migration-api.ts";
import PageHeader from "@/components/page-header.tsx";

export default function AccountLedgerPage() {
  if (migrationApiEnabled) {
    return <MigrationLedgerPage />;
  }

  return (
    <Authenticated>
      <LedgerPageInner />
    </Authenticated>
  );
}

function MigrationLedgerPage() {
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId as string | undefined;

  const thisYear = new Date().getFullYear();
  const [fromDate, setFromDate] = useState(`${thisYear}-04-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [ledger, setLedger] = useState<any | null | undefined>(undefined);

  useEffect(() => {
    if (!accountId) {
      setLedger(null);
      return;
    }

    let active = true;
    const params = new URLSearchParams();
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    const query = params.toString() ? `?${params.toString()}` : "";

    migrationGet<any>(`/api/accounting/ledger/${encodeURIComponent(accountId)}${query}`)
      .then((value) => {
        if (active) setLedger(value);
      })
      .catch(() => {
        if (active) setLedger(null);
      });

    return () => {
      active = false;
    };
  }, [accountId, fromDate, toDate]);

  if (!accountId) {
    return <div className="p-8 text-muted-foreground">Invalid account.</div>;
  }

  if (ledger === undefined) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 md:p-8">
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (ledger === null) {
    return <div className="p-8 text-muted-foreground">Account not found.</div>;
  }

  const accountType = String(ledger.account.type) as keyof typeof ACCOUNT_TYPE_LABELS;
  const accountGroup = String(ledger.account.group) as keyof typeof ACCOUNT_GROUP_LABELS;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={ledger.account.name ?? "Account Ledger"}
        breadcrumbs={[{ label: "Accounting", to: "/accounting" }, { label: ledger.account.name ?? "…" }]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-36" />
        <span className="text-muted-foreground text-sm">to</span>
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-36" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3">
        <span className="font-mono text-sm text-muted-foreground">{ledger.account.code}</span>
        <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", ACCOUNT_TYPE_COLORS[accountType])}>
          {ACCOUNT_TYPE_LABELS[accountType]}
        </span>
        <span className="text-sm text-muted-foreground">{ACCOUNT_GROUP_LABELS[accountGroup]}</span>
        <div className="ml-auto flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Opening Balance</p>
            <p className="text-sm font-medium tabular-nums">{formatCompactInr(ledger.openingBalance)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Closing Balance</p>
            <p className={cn("text-sm font-semibold tabular-nums", ledger.closingBalance < 0 && "text-destructive")}>
              {formatCompactInr(Math.abs(ledger.closingBalance))}
              {ledger.closingBalance < 0 && " (Cr)"}
            </p>
          </div>
        </div>
      </div>

      {ledger.rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><ScrollText /></EmptyMedia>
            <EmptyTitle>No transactions</EmptyTitle>
            <EmptyDescription>No posted transactions in this date range</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Entry No.</th>
                <th className="px-3 py-2">Narration</th>
                <th className="px-3 py-2">Ref</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Credit</th>
                <th className="px-3 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr className="bg-muted/30 text-xs text-muted-foreground">
                <td colSpan={6} className="px-3 py-1.5">Opening Balance</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                  {formatCompactInr(ledger.openingBalance)}
                </td>
              </tr>
              {ledger.rows.map((row: any, idx: number) => (
                <tr key={idx} className="hover:bg-muted/30">
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.date)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.entryNumber}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate">{row.narration}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{row.reference ?? ""}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-green-700 dark:text-green-400">
                    {row.debit > 0 ? formatCompactInr(row.debit) : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                    {row.credit > 0 ? formatCompactInr(row.credit) : ""}
                  </td>
                  <td className={cn("px-3 py-2 text-right tabular-nums font-medium", row.balance < 0 && "text-destructive")}>
                    {formatCompactInr(Math.abs(row.balance))}
                    {row.balance < 0 && " Cr"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/20 font-semibold text-sm">
                <td colSpan={4} className="px-3 py-2 text-right text-muted-foreground">Totals</td>
                <td className="px-3 py-2 text-right tabular-nums text-green-700 dark:text-green-400">
                  {formatCompactInr(ledger.rows.reduce((s: number, r: any) => s + r.debit, 0))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                  {formatCompactInr(ledger.rows.reduce((s: number, r: any) => s + r.credit, 0))}
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums", ledger.closingBalance < 0 && "text-destructive")}>
                  {formatCompactInr(Math.abs(ledger.closingBalance))}
                  {ledger.closingBalance < 0 && " Cr"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function LedgerPageInner() {
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId as Id<"accounts"> | undefined;

  const thisYear = new Date().getFullYear();
  const [fromDate, setFromDate] = useState(`${thisYear}-04-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  const ledger = useQuery(
    api.accounting.getAccountLedger,
    accountId ? { accountId, fromDate, toDate } : "skip",
  );

  if (!accountId) {
    return (
      <div className="p-8 text-muted-foreground">Invalid account.</div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={ledger?.account.name ?? "Account Ledger"}
        breadcrumbs={[
          { label: "Accounting", to: "/accounting" },
          { label: ledger?.account.name ?? "…" },
        ]}
      />

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-36" />
        <span className="text-muted-foreground text-sm">to</span>
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-36" />
      </div>

      {ledger === undefined ? (
        <Skeleton className="h-64 w-full" />
      ) : ledger === null ? (
        <div className="text-muted-foreground">Account not found.</div>
      ) : (
        <>
          {/* Account info bar */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3">
            <span className="font-mono text-sm text-muted-foreground">{ledger.account.code}</span>
            <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", ACCOUNT_TYPE_COLORS[ledger.account.type])}>
              {ACCOUNT_TYPE_LABELS[ledger.account.type]}
            </span>
            <span className="text-sm text-muted-foreground">{ACCOUNT_GROUP_LABELS[ledger.account.group]}</span>
            <div className="ml-auto flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Opening Balance</p>
                <p className="text-sm font-medium tabular-nums">{formatCompactInr(ledger.openingBalance)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Closing Balance</p>
                <p className={cn("text-sm font-semibold tabular-nums", ledger.closingBalance < 0 && "text-destructive")}>
                  {formatCompactInr(Math.abs(ledger.closingBalance))}
                  {ledger.closingBalance < 0 && " (Cr)"}
                </p>
              </div>
            </div>
          </div>

          {/* Ledger table */}
          {ledger.rows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><ScrollText /></EmptyMedia>
                <EmptyTitle>No transactions</EmptyTitle>
                <EmptyDescription>No posted transactions in this date range</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Entry No.</th>
                    <th className="px-3 py-2">Narration</th>
                    <th className="px-3 py-2">Ref</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr className="bg-muted/30 text-xs text-muted-foreground">
                    <td colSpan={6} className="px-3 py-1.5">Opening Balance</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                      {formatCompactInr(ledger.openingBalance)}
                    </td>
                  </tr>
                  {ledger.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.date)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.entryNumber}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate">{row.narration}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{row.reference ?? ""}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-green-700 dark:text-green-400">
                        {row.debit > 0 ? formatCompactInr(row.debit) : ""}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                        {row.credit > 0 ? formatCompactInr(row.credit) : ""}
                      </td>
                      <td className={cn(
                        "px-3 py-2 text-right tabular-nums font-medium",
                        row.balance < 0 && "text-destructive",
                      )}>
                        {formatCompactInr(Math.abs(row.balance))}
                        {row.balance < 0 && " Cr"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/20 font-semibold text-sm">
                    <td colSpan={4} className="px-3 py-2 text-right text-muted-foreground">Totals</td>
                    <td className="px-3 py-2 text-right tabular-nums text-green-700 dark:text-green-400">
                      {formatCompactInr(ledger.rows.reduce((s, r) => s + r.debit, 0))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                      {formatCompactInr(ledger.rows.reduce((s, r) => s + r.credit, 0))}
                    </td>
                    <td className={cn(
                      "px-3 py-2 text-right tabular-nums",
                      ledger.closingBalance < 0 && "text-destructive",
                    )}>
                      {formatCompactInr(Math.abs(ledger.closingBalance))}
                      {ledger.closingBalance < 0 && " Cr"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
