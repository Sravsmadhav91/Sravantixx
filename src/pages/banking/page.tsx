import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Authenticated } from "convex/react";
import { Plus, Trash2, ChevronRight, FileSpreadsheet, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent,
} from "@/components/ui/empty.tsx";
import { cn } from "@/lib/utils.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import ImportStatementDialog from "./_components/import-statement-dialog.tsx";
import MigrationImportStatementDialog from "./_components/migration-import-statement-dialog.tsx";
import ReconciliationView from "./_components/reconciliation-view.tsx";
import { autoMatchMigrationBankStatement, deleteMigrationBankStatement, deleteMigrationBankTransaction, matchMigrationBankTransaction, migrationApiEnabled, migrationGet } from "@/lib/migration-api.ts";
import { useMigrationFinance } from "@/hooks/use-migration-finance.ts";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import MigrationQuickCreateAccountDialog from "./_components/migration-quick-create-account-dialog.tsx";
import MigrationQuickCreateBuyerDialog from "./_components/migration-quick-create-buyer-dialog.tsx";

function MigrationBankingPage() {
  const statements = useMigrationFinance<any[]>("/api/banking/statements");
  const [importOpen, setImportOpen] = useState(false);
  const removeStatement = async (statement: any) => {
    if (statement.status === "reconciled") return;
    if (!window.confirm("Delete this pending bank statement and its transactions?")) return;
    try {
      await deleteMigrationBankStatement(statement._id);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete statement");
    }
  };
  const [selected, setSelected] = useState<any | null>(null);
  const transactions = useMigrationFinance<any[]>(selected ? "/api/tables/bankTransactions/records" : "");
  const vendors = useMigrationFinance<any[]>(selected ? "/api/tables/vendors/records" : "");
  const labourers = useMigrationFinance<any[]>(selected ? "/api/tables/labourers/records" : "");
  const employees = useMigrationFinance<any[]>(selected ? "/api/tables/employees/records" : "");
  const contracts = useMigrationFinance<any[]>(selected ? "/api/tables/subcontracts/records" : "");
  const accounts = useMigrationFinance<any[]>(selected ? "/api/tables/accounts/records" : "");
  const buyers = useMigrationFinance<any[]>(selected ? "/api/tables/buyers/records" : "");
  const [tdsOptions, setTdsOptions] = useState<Record<string, { enabled: boolean; section: string; gstRegistered: boolean; gstRate: string }>>({});
  const [createAccountForTx, setCreateAccountForTx] = useState<string | null>(null);
  const [contraAccountMap, setContraAccountMap] = useState<Record<string, string>>({});
  const [createBuyerForTx, setCreateBuyerForTx] = useState<string | null>(null);
  const rows = selected && transactions ? transactions.filter((transaction) => transaction.statementId === selected._id) : [];
  const matchTransaction = async (transactionId: string, value: string) => {
    const [entityType, entityId] = value.split(":");
    if (!entityType || !entityId) return;
    try { const tds = tdsOptions[transactionId]; const rates: Record<string, number> = { "194C": 1, "194J": 10, "194Q": 0.1 }; const matchedEntity = entityType === "contract" ? contracts?.find((item) => item._id === entityId) : entityType === "vendor" ? vendors?.find((item) => item._id === entityId) : entityType === "labourer" ? labourers?.find((item) => item._id === entityId) : undefined; const gstRegistered = Boolean(entityType === "vendor" ? matchedEntity?.gstin : entityType === "contract" ? vendors?.some((vendor) => vendor._id === matchedEntity?.vendorId && vendor.gstin) : false); await matchMigrationBankTransaction(transactionId, { entityType: entityType as "buyer" | "vendor" | "contract" | "labourer" | "employee" | "account", entityId, tdsEnabled: Boolean(tds?.enabled), tdsSection: tds?.section, tdsRate: tds ? rates[tds.section] : undefined, gstRegistered, gstRate: gstRegistered ? 18 : undefined }); window.location.reload(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not match transaction"); }
  };
  const autoMatch = async () => {
    try { const result = await autoMatchMigrationBankStatement(selected._id); toast.success(`${result.matched} transactions matched; ${result.unmatched} remain unmatched`); window.location.reload(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not auto-match transactions"); }
  };
  const deletePostedTransaction = async (transactionId: string) => {
    if (!window.confirm("Delete this posted transaction and its accounting entries? This cannot be undone.")) return;
    try { await deleteMigrationBankTransaction(transactionId); toast.success("Posted transaction deleted"); window.location.reload(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete transaction"); }
  };
  if (selected) return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8"><Button variant="ghost" onClick={() => setSelected(null)}>← Back to Statements</Button><PageHeader title={selected.accountName || "Bank statement"} subtitle={`${selected.fromDate} — ${selected.toDate} · ${selected.totalRows} transactions`} breadcrumbs={[{ label: "Bank Reconciliation" }, { label: selected.accountName || "Statement" }]} actions={<Button size="sm" variant="secondary" onClick={() => void autoMatch()}>Auto-Match</Button>} /><div className="rounded-lg border bg-card divide-y">{transactions === undefined ? <Skeleton className="h-48 w-full" /> : rows.map((transaction) => <div key={transaction._id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm"><div className="min-w-0"><p className="font-medium truncate">{transaction.description || transaction.narration || "Transaction"}</p><p className="text-xs text-muted-foreground">{transaction.date} · {transaction.reference || ""}</p></div><div className="flex shrink-0 items-center gap-3"><p className={transaction.debit > 0 ? "text-destructive" : "text-primary"}>{formatCompactInr(Number(transaction.debit || transaction.credit || 0))}</p><Badge variant={transaction.status === "matched" || transaction.status === "posted" ? "default" : "secondary"}>{transaction.status || "unmatched"}</Badge>{transaction.status === "posted" && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => void deletePostedTransaction(transaction._id)}>Delete</Button>}{transaction.status === "unmatched" && <><label className="flex items-center gap-1 text-xs whitespace-nowrap"><input type="checkbox" checked={tdsOptions[transaction._id]?.enabled ?? false} onChange={(event) => setTdsOptions((current) => ({ ...current, [transaction._id]: { enabled: event.target.checked, section: current[transaction._id]?.section || "194C" } }))} />TDS</label>{tdsOptions[transaction._id]?.enabled && <select className="h-7 rounded-md border bg-background px-2 text-xs" value={tdsOptions[transaction._id]?.section || "194C"} onChange={(event) => setTdsOptions((current) => ({ ...current, [transaction._id]: { enabled: true, section: event.target.value } }))}><option value="194C">194C - Contractor</option><option value="194J">194J - Consultant</option><option value="194Q">194Q - Goods</option></select>}{transaction.credit > 0 && <SearchableSelect className="w-56" options={(buyers ?? []).map((buyer) => ({ value: `buyer:${buyer._id}`, label: `Buyer · ${buyer.name}`, keywords: `${buyer.name} ${buyer.phone || ""}` }))} value="" onValueChange={(value) => void matchTransaction(transaction._id, value)} placeholder="Link buyer..." searchPlaceholder="Search buyers..." onCreateNew={() => setCreateBuyerForTx(transaction._id)} createNewLabel="+ Create new buyer" />}<SearchableSelect className="w-56" options={[...(vendors ?? []).map((vendor) => ({ value: `vendor:${vendor._id}`, label: `Vendor · ${vendor.name}` })), ...(contracts ?? []).map((contract) => ({ value: `contract:${contract._id}`, label: `Contract · ${contract.title}` })), ...(labourers ?? []).map((labourer) => ({ value: `labourer:${labourer._id}`, label: `Labourer · ${labourer.name}` })), ...(employees ?? []).map((employee) => ({ value: `employee:${employee._id}`, label: `Employee · ${employee.name}` })), ...(accounts ?? []).filter((account) => account.group === "capital" || /current\s*account|partner/i.test(String(account.name || ""))).map((account) => ({ value: `account:${account._id}`, label: `Partner account · ${account.name}` }))]} value="" onValueChange={(value) => void matchTransaction(transaction._id, value)} placeholder="Link account..." searchPlaceholder="Search vendor, partner, labourer..." onCreateNew={() => setCreateAccountForTx(transaction._id)} createNewLabel="+ Create new account" /></>}</div></div>)}</div><MigrationQuickCreateBuyerDialog open={!!createBuyerForTx} onOpenChange={(open) => { if (!open) setCreateBuyerForTx(null); }} onCreated={(buyer) => { const transactionId = createBuyerForTx; setCreateBuyerForTx(null); if (transactionId) void matchTransaction(transactionId, `buyer:${buyer._id}`); }} /><MigrationQuickCreateAccountDialog open={!!createAccountForTx} onOpenChange={(open) => { if (!open) setCreateAccountForTx(null); }} onCreated={(account) => { if (createAccountForTx) setContraAccountMap((current) => ({ ...current, [createAccountForTx]: account.accountId })); setCreateAccountForTx(null); }} /></div>;
  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8"><PageHeader title="Bank Reconciliation" subtitle="Import bank statements and match transactions against your ledger" breadcrumbs={[{ label: "Bank Reconciliation" }]} actions={<Button onClick={() => setImportOpen(true)}><Plus className="size-4" />Import Statement</Button>} />{statements === undefined ? <Skeleton className="h-48 w-full" /> : statements.length === 0 ? <Empty><EmptyHeader><EmptyMedia variant="icon"><FileSpreadsheet /></EmptyMedia><EmptyTitle>No bank statements yet</EmptyTitle><EmptyDescription>Import a CSV bank statement to start reconciling transactions with your ledger.</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={() => setImportOpen(true)}><Plus className="size-4" />Import Statement</Button></EmptyContent></Empty> : <div className="rounded-lg border bg-card divide-y">{statements.map((statement) => <div key={statement._id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30"><button type="button" onClick={() => setSelected(statement)} className="min-w-0 flex-1 text-left"><p className="font-medium">{statement.accountName || "Bank statement"}</p><p className="text-xs text-muted-foreground">{statement.fromDate} - {statement.toDate} · {statement.totalRows} transactions</p></button><Badge variant={statement.status === "reconciled" ? "default" : "secondary"}>{statement.status || "pending"}</Badge>{statement.status !== "reconciled" && <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Delete ${statement.accountName || "bank statement"}`} onClick={() => void removeStatement(statement)}> <Trash2 className="size-4" /></Button>}</div>)}</div>}<MigrationImportStatementDialog open={importOpen} onOpenChange={setImportOpen} /></div>;
}

export default function BankingPage() {
  if (migrationApiEnabled) return <MigrationBankingPage />;
  return (
    <Authenticated>
      <BankingInner />
    </Authenticated>
  );
}

function BankingInner() {
  const [importOpen, setImportOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<Id<"bankStatements"> | null>(null);

  const statements = useQuery(api.banking.listBankStatements, {});
  const deleteStatement = useMutation(api.banking.deleteBankStatement);

  const handleDelete = async (id: Id<"bankStatements">) => {
    if (!confirm("Delete this bank statement and all its transactions? This cannot be undone.")) return;
    try {
      await deleteStatement({ statementId: id });
      if (selectedId === id) setSelectedId(null);
      toast.success("Statement deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Bank Reconciliation"
        subtitle="Import bank statements and match transactions against your ledger"
        breadcrumbs={[{ label: "Bank Reconciliation" }]}
        actions={
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Plus className="size-4" /> Import Statement
          </Button>
        }
      />

      {selectedId ? (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
            ← Back to Statements
          </Button>
          <ReconciliationView
            statementId={selectedId}
            onReconciled={() => setSelectedId(null)}
          />
        </div>
      ) : (
        <>
          {statements === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : statements.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileSpreadsheet /></EmptyMedia>
                <EmptyTitle>No bank statements yet</EmptyTitle>
                <EmptyDescription>
                  Import a CSV bank statement to start reconciling transactions with your ledger
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setImportOpen(true)}>
                  <Plus className="size-4" /> Import Statement
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card divide-y">
              {statements.map((stmt) => {
                const reconciled = stmt.status === "reconciled";
                const unmatched = stmt.totalRows - stmt.matchedRows - stmt.postedRows;
                return (
                  <div
                    key={stmt._id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer group"
                    onClick={() => setSelectedId(stmt._id)}
                  >
                    <div className={cn(
                      "size-9 shrink-0 rounded-full flex items-center justify-center",
                      reconciled ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30",
                    )}>
                      {reconciled
                        ? <CheckCircle2 className="size-5 text-green-700 dark:text-green-400" />
                        : <Clock className="size-5 text-amber-700 dark:text-amber-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{stmt.accountName}</p>
                        {stmt.bankFormat && <Badge variant="secondary" className="text-xs">{stmt.bankFormat}</Badge>}
                        <Badge
                          variant={reconciled ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {reconciled ? "Reconciled" : "Pending"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {stmt.fromDate} — {stmt.toDate} &nbsp;·&nbsp;
                        {stmt.totalRows} transactions &nbsp;·&nbsp;
                        {stmt.matchedRows + stmt.postedRows} matched &nbsp;·&nbsp;
                        <span className={cn(unmatched > 0 && "text-amber-600 font-medium")}>
                          {unmatched} unmatched
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {stmt.closingBalance !== undefined && (
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-muted-foreground">Closing Balance</p>
                          <p className="text-sm font-mono tabular-nums font-semibold">{formatCompactInr(stmt.closingBalance)}</p>
                        </div>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 opacity-0 group-hover:opacity-100 text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(stmt._id); }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <ImportStatementDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={(id) => setSelectedId(id)}
      />
    </div>
  );
}







