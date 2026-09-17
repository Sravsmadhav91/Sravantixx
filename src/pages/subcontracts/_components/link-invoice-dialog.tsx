import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";

type LinkInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subcontractId: Id<"subcontracts"> | undefined;
  vendorId: Id<"vendors"> | undefined;
};

export default function LinkInvoiceDialog({ open, onOpenChange, subcontractId, vendorId }: LinkInvoiceDialogProps) {
  const [linking, setLinking] = useState<Id<"purchaseInvoices"> | null>(null);
  const invoices = useQuery(
    api.subcontracts.listUnlinkedInvoicesForVendor,
    open && vendorId ? { vendorId } : "skip",
  );
  const linkInvoice = useMutation(api.subcontracts.linkInvoiceToSubcontract);

  const handleLink = async (invoiceId: Id<"purchaseInvoices">) => {
    if (!subcontractId) return;
    setLinking(invoiceId);
    try {
      await linkInvoice({ subcontractId, purchaseInvoiceId: invoiceId });
      toast.success("Invoice linked to subcontract");
    } catch (error) {
      toast.error(
        error instanceof ConvexError ? (error.data as { message: string }).message : "Could not link invoice",
      );
    } finally {
      setLinking(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link a purchase invoice</DialogTitle>
        </DialogHeader>
        {invoices === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : invoices.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No unlinked invoices for this vendor. Create a purchase invoice first from Accounts Payable.
          </p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div
                key={inv._id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{inv.internalRef}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(inv.date)} · {formatCompactInr(inv.total)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={linking === inv._id}
                  onClick={() => handleLink(inv._id)}
                >
                  <Link2 className="size-3.5" /> Link
                </Button>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
