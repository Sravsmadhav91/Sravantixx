import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { Search, HardHat, CheckCircle2, Link2, X } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import { useDebounce } from "@/hooks/use-debounce.ts";

type BankTx = {
  _id: Id<"bankTransactions">;
  date: string;
  description: string;
  debit: number;
  reference?: string;
  labourLinkId?: Id<"labourers">;
};

type Props = {
  transaction: BankTx;
  open: boolean;
  onClose: () => void;
};

/** Links a bank debit line to a labourer/group, recording it as a "payment" in their ledger. */
export default function LinkLabourerDialog({ transaction, open, onClose }: Props) {
  const linkLabourer = useMutation(api.banking.recordLabourPaymentFromBankTx);
  const unlinkLabourer = useMutation(api.banking.unlinkLabourPaymentFromTransaction);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch] = useDebounce(searchInput, 300);
  const [selectedLabourerId, setSelectedLabourerId] = useState<Id<"labourers"> | null>(null);
  const [saving, setSaving] = useState(false);

  const labourers = useQuery(api.labour.searchLabourersForLink, open ? { search: debouncedSearch } : "skip");

  const handleLink = async () => {
    if (!selectedLabourerId) {
      toast.error("Select a labourer first");
      return;
    }
    setSaving(true);
    try {
      await linkLabourer({ transactionId: transaction._id, labourerId: selectedLabourerId });
      toast.success("Labourer linked and payment recorded");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to link labourer");
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    setSaving(true);
    try {
      await unlinkLabourer({ transactionId: transaction._id });
      toast.success("Labourer link removed");
      onClose();
    } catch {
      toast.error("Failed to unlink");
    } finally {
      setSaving(false);
    }
  };

  const isAlreadyLinked = !!transaction.labourLinkId;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4 text-primary" />
            Link Labourer to Transaction
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-muted/50 border p-3 space-y-1 text-sm">
          <div className="flex justify-between items-start gap-2">
            <span className="text-muted-foreground truncate">{transaction.description}</span>
            <span className="font-semibold shrink-0 text-red-600 dark:text-red-400">
              -{formatCompactInr(transaction.debit)}
            </span>
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>{formatDate(transaction.date)}</span>
            {transaction.reference && <span>Ref: {transaction.reference}</span>}
          </div>
        </div>

        {isAlreadyLinked ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <CheckCircle2 className="size-4 shrink-0" />
              This transaction is already linked to a labourer. Remove the link to re-assign.
            </div>
            <Button variant="destructive" size="sm" onClick={handleUnlink} disabled={saving}>
              <X className="size-4" /> Remove labour link
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <HardHat className="size-3.5 text-primary" /> Select Labourer / Group
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search labourer by name…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8"
              />
            </div>
            {labourers === undefined ? (
              <Skeleton className="h-24 w-full" />
            ) : labourers.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1">No labourers found</p>
            ) : (
              <div className="border rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                {labourers.map((l) => (
                  <button
                    key={l._id}
                    onClick={() => setSelectedLabourerId(l._id)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-muted/50 transition-colors",
                      selectedLabourerId === l._id && "bg-primary/10 font-medium",
                    )}
                  >
                    <span>
                      {l.name}
                      {l.skill && <span className="text-xs text-muted-foreground"> — {l.skill}</span>}
                    </span>
                    <span className={cn("text-xs", l.balance > 0.01 ? "text-amber-600" : "text-muted-foreground")}>
                      Owed {formatCompactInr(l.balance)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!isAlreadyLinked && (
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleLink} disabled={saving || !selectedLabourerId}>
              <CheckCircle2 className="size-4" />
              {saving ? "Linking…" : "Link & Record Payment"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
