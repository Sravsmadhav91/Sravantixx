import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Building2, CheckCircle2, Sparkles, AlertTriangle } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";

type Props = {
  statementId: Id<"bankStatements">;
  open: boolean;
  onClose: () => void;
};

type TxLite = { _id: Id<"bankTransactions">; date: string; description: string; debit: number };

/**
 * Reviews every unmatched debit line in a statement against the auto-detected
 * vendor payment / expense-category suggestions and lets the user apply the
 * ones they select. Nothing is recorded until "Apply Selected" is clicked.
 */
export default function VendorMatchDialog({ statementId, open, onClose }: Props) {
  const data = useQuery(api.banking.getBankStatement, open ? { statementId } : "skip");
  const suggestions = useQuery(api.banking.suggestVendorMatchesForStatement, open ? { statementId } : "skip");
  const recordVendorPayment = useMutation(api.banking.recordVendorPaymentFromBankTx);
  const postTx = useMutation(api.banking.postBankTransaction);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  const txMap = new Map<Id<"bankTransactions">, TxLite>(
    (data?.transactions ?? []).map((t) => [t._id, t]),
  );

  const vendorMatches = suggestions?.vendorMatches ?? [];
  const expenseSuggestions = suggestions?.expenseSuggestions ?? [];
  const totalSuggestions = vendorMatches.length + expenseSuggestions.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set([
      ...vendorMatches.map((m) => m.transactionId),
      ...expenseSuggestions.map((e) => e.transactionId),
    ]));
  };

  const handleApply = async () => {
    setApplying(true);
    let succeeded = 0;
    let failed = 0;
    try {
      for (const match of vendorMatches) {
        if (!selected.has(match.transactionId)) continue;
        try {
          await recordVendorPayment({
            transactionId: match.transactionId,
            vendorId: match.vendorId,
            allocations: match.allocations.map((a) => ({ invoiceId: a.invoiceId, amount: a.amountToApply })),
          });
          succeeded++;
        } catch {
          failed++;
        }
      }
      for (const exp of expenseSuggestions) {
        if (!selected.has(exp.transactionId)) continue;
        try {
          await postTx({ transactionId: exp.transactionId, contraAccountId: exp.accountId });
          succeeded++;
        } catch {
          failed++;
        }
      }
      if (succeeded > 0) toast.success(`Applied ${succeeded} transaction${succeeded !== 1 ? "s" : ""}`);
      if (failed > 0) toast.error(`${failed} transaction${failed !== 1 ? "s" : ""} failed to apply`);
      setSelected(new Set());
      if (failed === 0) onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Review Vendor Payment Matches
          </DialogTitle>
          <DialogDescription>
            Each debit line below was matched by name against your vendors and outstanding bills.
            Review and select the ones to record — nothing posts until you apply.
          </DialogDescription>
        </DialogHeader>

        {suggestions === undefined || data === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : totalSuggestions === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No new vendor or expense matches found among the unmatched debit lines.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{totalSuggestions} suggestion{totalSuggestions !== 1 ? "s" : ""} found</p>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAll}>Select all</Button>
            </div>

            {vendorMatches.map((match) => {
              const tx = txMap.get(match.transactionId);
              if (!tx) return null;
              return (
                <label
                  key={match.transactionId}
                  className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30"
                >
                  <Checkbox
                    checked={selected.has(match.transactionId)}
                    onCheckedChange={() => toggle(match.transactionId)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm truncate" title={tx.description}>{tx.description}</span>
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400 shrink-0">
                        -{formatCompactInr(tx.debit)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(tx.date)}</span>
                      <Badge variant="secondary" className="gap-1">
                        <Building2 className="size-3" /> {match.vendorName}
                      </Badge>
                      {match.amountMismatch && (
                        <Badge variant="secondary" className="gap-1 text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="size-3" /> Amount doesn't fully match outstanding bills
                        </Badge>
                      )}
                    </div>
                    <div className="rounded-md bg-muted/50 p-2 space-y-1">
                      {match.allocations.map((a) => (
                        <div key={a.invoiceId} className="flex justify-between text-xs">
                          <span>{a.invoiceRef} <span className="text-muted-foreground">(outstanding {formatCompactInr(a.outstanding)})</span></span>
                          <span className="font-medium">Apply {formatCompactInr(a.amountToApply)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </label>
              );
            })}

            {expenseSuggestions.map((exp) => {
              const tx = txMap.get(exp.transactionId);
              if (!tx) return null;
              return (
                <label
                  key={exp.transactionId}
                  className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30"
                >
                  <Checkbox
                    checked={selected.has(exp.transactionId)}
                    onCheckedChange={() => toggle(exp.transactionId)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm truncate" title={tx.description}>{tx.description}</span>
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400 shrink-0">
                        -{formatCompactInr(tx.debit)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(tx.date)}</span>
                      <Badge variant="secondary">No vendor match — suggested category: {exp.accountName}</Badge>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={applying}>Close</Button>
          <Button onClick={handleApply} disabled={applying || selected.size === 0}>
            <CheckCircle2 className="size-4" />
            {applying ? "Applying…" : `Apply Selected (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
