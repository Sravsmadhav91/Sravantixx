import { useQuery } from "convex/react";
import { Authenticated } from "convex/react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_COLORS,
  ACCOUNT_GROUP_LABELS,
  TYPE_ORDER,
} from "@/lib/accounting.ts";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { useMigrationFinance } from "@/hooks/use-migration-finance.ts";
import PageHeader from "@/components/page-header.tsx";

export default function LedgerListPage() {
  if (migrationApiEnabled) {
    return <MigrationLedgerListPage />;
  }

  return (
    <Authenticated>
      <LedgerListInner />
    </Authenticated>
  );
}

function MigrationLedgerListPage() {
  const balances = useMigrationFinance<Array<{ accountId: string; code: string; name: string; type: string; group: string; balance: number }>>("/api/accounting/balances");
  const data = balances ?? [];

  if (balances === undefined) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 md:p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  const grouped = TYPE_ORDER.reduce<Record<string, typeof data>>(
    (acc, type) => {
      acc[type] = data.filter((a) => a.type === type);
      return acc;
    },
    {},
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Account Ledger"
        subtitle="Click any account to view its transaction history"
        breadcrumbs={[{ label: "Accounting", to: "/accounting" }, { label: "Ledger" }]}
      />

      {TYPE_ORDER.map((type) => {
        const typeAccounts = grouped[type] ?? [];
        if (!typeAccounts.length) return null;
        const total = typeAccounts.reduce((s, a) => s + a.balance, 0);
        return (
          <div key={type} className="space-y-1">
            <div className="flex items-center justify-between pb-1">
              <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", ACCOUNT_TYPE_COLORS[type])}>
                {ACCOUNT_TYPE_LABELS[type]}
              </span>
              <span className="text-sm font-medium tabular-nums text-muted-foreground">
                Total: {formatCompactInr(Math.abs(total))}
              </span>
            </div>
            <div className="rounded-lg border bg-card divide-y">
              {typeAccounts.map((a) => (
                <Link
                  key={a.accountId}
                  to={`/accounting/ledger/${a.accountId}`}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors"
                >
                  <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{a.code}</span>
                  <span className="flex-1 text-sm font-medium">{a.name}</span>
                  <span className="hidden text-xs text-muted-foreground sm:block">{ACCOUNT_GROUP_LABELS[a.group as keyof typeof ACCOUNT_GROUP_LABELS]}</span>
                  <span className={cn("min-w-[90px] text-right text-sm font-semibold tabular-nums", a.balance < 0 ? "text-destructive" : "")}>{formatCompactInr(Math.abs(a.balance))}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LedgerListInner() {
  const balances = useQuery(api.accounting.getAccountBalances, {});

  if (balances === undefined) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 md:p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  const grouped = TYPE_ORDER.reduce<Record<string, typeof balances>>(
    (acc, type) => {
      acc[type] = balances.filter((a) => a.type === type);
      return acc;
    },
    {},
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Account Ledger"
        subtitle="Click any account to view its transaction history"
        breadcrumbs={[
          { label: "Accounting", to: "/accounting" },
          { label: "Ledger" },
        ]}
      />

      {TYPE_ORDER.map((type) => {
        const typeAccounts = grouped[type] ?? [];
        if (!typeAccounts.length) return null;
        const total = typeAccounts.reduce((s, a) => s + a.balance, 0);
        return (
          <div key={type} className="space-y-1">
            <div className="flex items-center justify-between pb-1">
              <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", ACCOUNT_TYPE_COLORS[type])}>
                {ACCOUNT_TYPE_LABELS[type]}
              </span>
              <span className="text-sm font-medium tabular-nums text-muted-foreground">
                Total: {formatCompactInr(Math.abs(total))}
              </span>
            </div>
            <div className="rounded-lg border bg-card divide-y">
              {typeAccounts.map((a) => (
                <Link
                  key={a.accountId}
                  to={`/accounting/ledger/${a.accountId}`}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors"
                >
                  <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{a.code}</span>
                  <span className="flex-1 text-sm font-medium">{a.name}</span>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    {ACCOUNT_GROUP_LABELS[a.group as keyof typeof ACCOUNT_GROUP_LABELS]}
                  </span>
                  <span className={cn(
                    "min-w-[90px] text-right text-sm font-semibold tabular-nums",
                    a.balance < 0 ? "text-destructive" : "",
                  )}>
                    {formatCompactInr(Math.abs(a.balance))}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
