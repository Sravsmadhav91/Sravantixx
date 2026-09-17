import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Eye, EyeOff, Wand2, Link2, User, Building2, Sparkles, HardHat } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { cn } from "@/lib/utils.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import LinkBuyerDialog from "./link-buyer-dialog.tsx";
import LinkLabourerDialog from "./link-labourer-dialog.tsx";
import VendorMatchDialog from "./vendor-match-dialog.tsx";
import QuickCreateAccountDialog from "./quick-create-account-dialog.tsx";

type Props = {
  statementId: Id<"bankStatements">;
  onReconciled: () => void;
};

const TX_STATUS_COLORS: Record<string, string> = {
  unmatched: "bg-muted text-muted-foreground",
  matched: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  posted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  ignored: "bg-muted/50 text-muted-foreground/60",
};

export default function ReconciliationView({ statementId, onReconciled }: Props) {
  const data = useQuery(api.banking.getBankStatement, { statementId });
  const autoMatch = useMutation(api.banking.autoMatchStatement);
  const postTx = useMutation(api.banking.postBankTransaction);
  const ignoreTx = useMutation(api.banking.ignoreBankTransaction);
  const unmatchTx = useMutation(api.banking.unmatchBankTransaction);
  const reconcile = useMutation(api.banking.reconcileStatement);
  const accounts = useQuery(api.accounting.listAccounts, {});

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [contraAccountMap, setContraAccountMap] = useState<Record<string, string>>({});
  const [showIgnored, setShowIgnored] = useState(false);
  const [autoMatching, setAutoMatching] = useState(false);
  const [linkDialogTx, setLinkDialogTx] = useState<(typeof transactions)[0] | null>(null);
  const [linkLabourerDialogTx, setLinkLabourerDialogTx] = useState<(typeof transactions)[0] | null>(null);
  const [vendorMatchOpen, setVendorMatchOpen] = useState(false);
  const [createAccountForTx, setCreateAccountForTx] = useState<string | null>(null);
  const unlinkVendorPayment = useMutation(api.banking.unlinkVendorPaymentFromTransaction);
  const unlinkLabourPayment = useMutation(api.banking.unlinkLabourPaymentFromTransaction);

  if (!data) return <Skeleton className="h-96 w-full" />;

  const { statement, transactions } = data;

  const filtered = transactions.filter((tx) => {
    if (!showIgnored && tx.status === "ignored") return false;
    if (statusFilter !== "all" && tx.status !== statusFilter) return false;
    return true;
  });

  const counts = {
    total: transactions.length,
    unmatched: transactions.filter((t) => t.status === "unmatched").length,
    matched: transactions.filter((t) => t.status === "matched").length,
    posted: transactions.filter((t) => t.status === "posted").length,
    ignored: transactions.filter((t) => t.status === "ignored").length,
  };
  const reconcilable = counts.unmatched === 0;

  const handleAutoMatch = async () => {
    setAutoMatching(true);
    try {
      const r = await autoMatch({ statementId });
      toast.success(`Auto-matched ${r.matched} transactions`);
    } catch {
      toast.error("Auto-match failed");
    } finally {
      setAutoMatching(false);
    }
  };

  const handlePost = async (txId: Id<"bankTransactions">) => {
    const contraId = contraAccountMap[txId];
    if (!contraId) { toast.error("Select a contra account first"); return; }
    try {
      await postTx({ transactionId: txId, contraAccountId: contraId as Id<"accounts"> });
      toast.success("Transaction posted to ledger");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post");
    }
  };

  const handleReconcile = async () => {
    try {
      await reconcile({ statementId });
      toast.success("Statement marked as reconciled");
      onReconciled();
    } catch {
      toast.error("Failed to reconcile");
    }
  };

  return (
    <div className="space-y-4">
      {/* Statement header */}
      <div className="rounded-lg border bg-card p-4 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Account</p>
          <p className="font-semibold text-sm">{statement.accountName}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Period</p>
          <p className="text-sm">{statement.fromDate} — {statement.toDate}</p>
        </div>
        {statement.openingBalance !== undefined && (
          <div>
            <p className="text-xs text-muted-foreground">Opening</p>
            <p className="text-sm font-mono tabular-nums">{formatCompactInr(statement.openingBalance)}</p>
          </div>
        )}
        {statement.closingBalance !== undefined && (
          <div>
            <p className="text-xs text-muted-foreground">Closing</p>
            <p className="text-sm font-mono tabular-nums">{formatCompactInr(statement.closingBalance)}</p>
          </div>
        )}
        {statement.bankFormat && <Badge variant="secondary">{statement.bankFormat}</Badge>}
        <Badge variant={statement.status === "reconciled" ? "default" : "secondary"}>
          {statement.status === "reconciled" ? "Reconciled" : "Pending"}
        </Badge>
        <div className="ml-auto flex gap-2">
          {statement.status !== "reconciled" && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setVendorMatchOpen(true)}>
                <Sparkles className="size-4" /> Match Vendor Payments
              </Button>
              <Button size="sm" variant="secondary" onClick={handleAutoMatch} disabled={autoMatching}>
                <Wand2 className="size-4" /> {autoMatching ? "Matching…" : "Auto-Match"}
              </Button>
              <Button size="sm" onClick={handleReconcile} disabled={!reconcilable}>
                <CheckCircle2 className="size-4" /> Mark Reconciled
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { label: `Total: ${counts.total}`, value: "all", color: "" },
          { label: `Unmatched: ${counts.unmatched}`, value: "unmatched", color: "text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300" },
          { label: `Matched: ${counts.matched}`, value: "matched", color: "text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300" },
          { label: `Posted: ${counts.posted}`, value: "posted", color: "text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-300" },
        ].map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(statusFilter === s.value ? "all" : s.value)}
            className={cn(
              "rounded-full px-3 py-1 font-medium cursor-pointer border transition-colors",
              statusFilter === s.value ? "border-primary" : "border-transparent bg-muted",
              s.color,
            )}
          >
            {s.label}
          </button>
        ))}
        <button
          onClick={() => setShowIgnored(!showIgnored)}
          className="rounded-full px-3 py-1 font-medium cursor-pointer border border-transparent bg-muted text-muted-foreground ml-auto"
        >
          {showIgnored ? <EyeOff className="size-3 inline mr-1" /> : <Eye className="size-3 inline mr-1" />}
          {showIgnored ? "Hide" : "Show"} Ignored ({counts.ignored})
        </button>
      </div>

      {/* Transactions table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs font-medium text-muted-foreground">
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Ref</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Credit</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 min-w-[180px]">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((tx) => (
              <tr
                key={tx._id}
                className={cn(
                  "hover:bg-muted/20",
                  tx.status === "ignored" && "opacity-50",
                )}
              >
                <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDate(tx.date)}</td>
                <td className="px-3 py-2 text-xs max-w-[200px] truncate" title={tx.description}>{tx.description}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-[80px] truncate">{tx.reference ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-xs text-red-600">
                  {tx.debit > 0 ? formatCompactInr(tx.debit) : ""}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs text-green-700 dark:text-green-400">
                  {tx.credit > 0 ? formatCompactInr(tx.credit) : ""}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                  {tx.balance !== undefined ? formatCompactInr(tx.balance) : ""}
                </td>
                <td className="px-3 py-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", TX_STATUS_COLORS[tx.status])}>
                    {tx.status}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  {tx.status === "unmatched" && statement.status !== "reconciled" && (
                    <div className="flex gap-1 items-center flex-wrap">
                      {/* Link buyer button — shown for credit transactions */}
                      {tx.credit > 0 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-6 px-2 text-[10px] gap-1"
                          onClick={() => setLinkDialogTx(tx)}
                        >
                          <Link2 className="size-3" /> Link Buyer
                        </Button>
                      )}
                      {/* Link labourer button — shown for debit transactions */}
                      {tx.debit > 0 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-6 px-2 text-[10px] gap-1"
                          onClick={() => setLinkLabourerDialogTx(tx)}
                        >
                          <HardHat className="size-3" /> Link Labourer
                        </Button>
                      )}
                      <SearchableSelect
                          value={contraAccountMap[tx._id] ?? ""}
                          onValueChange={(v) => setContraAccountMap((m) => ({ ...m, [tx._id]: v }))}
                          options={(accounts ?? []).map((a) => ({ value: a._id, label: a.name, keywords: `${a.code ?? ""} ${a.name}` }))}
                          placeholder="Contra acct…"
                          searchPlaceholder="Search accounts…"
                          size="sm"
                          triggerClassName="h-6 text-[10px] w-36 truncate"
                          onCreateNew={() => setCreateAccountForTx(tx._id)}
                          createNewLabel="+ Create new account"
                        />
                      <Button
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => handlePost(tx._id as Id<"bankTransactions">)}
                        disabled={!contraAccountMap[tx._id]}
                      >
                        Post
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        title="Ignore"
                        onClick={() => ignoreTx({ transactionId: tx._id as Id<"bankTransactions"> })}
                      >
                        <XCircle className="size-3 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                  {tx.status === "matched" && (
                    <div className="flex gap-1 items-center flex-wrap">
                      {tx.buyerLinkId ? (
                        <span className="flex items-center gap-1 text-[10px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded px-1.5 py-0.5">
                          <User className="size-3" /> Buyer linked
                        </span>
                      ) : null}
                      {tx.vendorLinkId ? (
                        <span className="flex items-center gap-1 text-[10px] text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded px-1.5 py-0.5">
                          <Building2 className="size-3" /> Vendor payment
                        </span>
                      ) : null}
                      {tx.labourLinkId ? (
                        <span className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-1.5 py-0.5">
                          <HardHat className="size-3" /> Labour payment
                        </span>
                      ) : null}
                      {statement.status !== "reconciled" && (
                        <>
                          {tx.credit > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px] gap-1"
                              onClick={() => setLinkDialogTx(tx)}
                            >
                              <Link2 className="size-3" /> {tx.buyerLinkId ? "Edit link" : "Link Buyer"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] text-muted-foreground"
                            onClick={() => {
                              if (tx.vendorLinkId) {
                                unlinkVendorPayment({ transactionId: tx._id as Id<"bankTransactions"> });
                              } else if (tx.labourLinkId) {
                                unlinkLabourPayment({ transactionId: tx._id as Id<"bankTransactions"> });
                              } else {
                                unmatchTx({ transactionId: tx._id as Id<"bankTransactions"> });
                              }
                            }}
                          >
                            Undo
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                  {tx.status === "ignored" && statement.status !== "reconciled" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-muted-foreground"
                      onClick={() => unmatchTx({ transactionId: tx._id as Id<"bankTransactions"> })}
                    >
                      Undo
                    </Button>
                  )}
                  {tx.status === "posted" && (
                    <span className="text-[10px] text-green-700 dark:text-green-400">Posted to ledger</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">No transactions match this filter.</div>
        )}
      </div>

      {!reconcilable && statement.status !== "reconciled" && (
        <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
          {counts.unmatched} unmatched transaction{counts.unmatched !== 1 ? "s" : ""} remaining. Post or ignore them before reconciling.
        </p>
      )}

      {/* Link Buyer dialog */}
      {linkDialogTx && (
        <LinkBuyerDialog
          transaction={linkDialogTx}
          open={!!linkDialogTx}
          onClose={() => setLinkDialogTx(null)}
        />
      )}

      {/* Link Labourer dialog */}
      {linkLabourerDialogTx && (
        <LinkLabourerDialog
          transaction={linkLabourerDialogTx}
          open={!!linkLabourerDialogTx}
          onClose={() => setLinkLabourerDialogTx(null)}
        />
      )}

      {/* Vendor Match review dialog */}
      <VendorMatchDialog
        statementId={statementId}
        open={vendorMatchOpen}
        onClose={() => setVendorMatchOpen(false)}
      />

      {/* Quick create account dialog — used from the contra account picker */}
      <QuickCreateAccountDialog
        open={!!createAccountForTx}
        onOpenChange={(o) => { if (!o) setCreateAccountForTx(null); }}
        onCreated={(account) => {
          if (createAccountForTx) {
            setContraAccountMap((m) => ({ ...m, [createAccountForTx]: account.accountId }));
          }
          setCreateAccountForTx(null);
        }}
      />
    </div>
  );
}
