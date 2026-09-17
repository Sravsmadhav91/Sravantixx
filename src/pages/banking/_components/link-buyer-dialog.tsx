import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { Search, User, Building2, CheckCircle2, Link2, X, Receipt } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { splitGstInclusive } from "@/lib/gst.ts";

type BankTx = {
  _id: Id<"bankTransactions">;
  date: string;
  description: string;
  credit: number;
  debit: number;
  reference?: string;
  buyerLinkId?: Id<"buyers">;
  bookingLinkId?: Id<"bookings">;
  receiptId?: Id<"receipts">;
};

type Props = {
  transaction: BankTx;
  open: boolean;
  onClose: () => void;
};

export default function LinkBuyerDialog({ transaction, open, onClose }: Props) {
  const isCredit = transaction.credit > 0;
  const amount = isCredit ? transaction.credit : transaction.debit;

  const linkBuyer = useMutation(api.banking.linkBuyerToTransaction);
  const unlinkBuyer = useMutation(api.banking.unlinkBuyerFromTransaction);

  // Step 1: Search buyer
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch] = useDebounce(searchInput, 300);
  const [selectedBuyerId, setSelectedBuyerId] = useState<Id<"buyers"> | null>(null);

  // Step 2: Select booking
  const [selectedBookingId, setSelectedBookingId] = useState<Id<"bookings"> | null>(null);

  // Step 3: Optionally pick installment
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<Id<"paymentInstallments"> | "none">("none");

  // Payment details
  const [paymentMode, setPaymentMode] = useState<"neft" | "rtgs" | "upi" | "cheque" | "cash">("neft");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const buyers = useQuery(api.banking.searchBuyersForLink, { search: debouncedSearch });
  const bookings = useQuery(
    api.banking.getBookingsForBuyer,
    selectedBuyerId ? { buyerId: selectedBuyerId } : "skip",
  );
  const installments = useQuery(
    api.banking.getInstallmentsForBooking,
    selectedBookingId ? { bookingId: selectedBookingId } : "skip",
  );

  const selectBuyer = (id: Id<"buyers">) => {
    setSelectedBuyerId(id);
    setSelectedBookingId(null);
    setSelectedInstallmentId("none");
  };

  const selectBooking = (id: Id<"bookings">) => {
    setSelectedBookingId(id);
    setSelectedInstallmentId("none");
  };

  const pendingInstallments = installments?.filter((i) => i.status !== "paid") ?? [];
  const selectedBooking = bookings?.find((b) => b._id === selectedBookingId);
  const gstSplit = splitGstInclusive(amount, selectedBooking?.gstPercent);

  const handleLink = async () => {
    if (!selectedBuyerId || !selectedBookingId) {
      toast.error("Select a buyer and booking first");
      return;
    }
    setSaving(true);
    try {
      await linkBuyer({
        transactionId: transaction._id,
        buyerId: selectedBuyerId,
        bookingId: selectedBookingId,
        installmentId: selectedInstallmentId !== "none"
          ? selectedInstallmentId as Id<"paymentInstallments">
          : undefined,
        paymentMode,
        notes: notes.trim() || undefined,
      });
      toast.success("Buyer linked and receipt created");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to link buyer");
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    setSaving(true);
    try {
      await unlinkBuyer({ transactionId: transaction._id });
      toast.success("Buyer link removed");
      onClose();
    } catch {
      toast.error("Failed to unlink");
    } finally {
      setSaving(false);
    }
  };

  const isAlreadyLinked = !!transaction.buyerLinkId;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4 text-primary" />
            Link Buyer to Transaction
          </DialogTitle>
        </DialogHeader>

        {/* Transaction summary */}
        <div className="rounded-lg bg-muted/50 border p-3 space-y-1 text-sm">
          <div className="flex justify-between items-start gap-2">
            <span className="text-muted-foreground truncate">{transaction.description}</span>
            <span className={cn("font-semibold shrink-0", isCredit ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
              {isCredit ? "+" : "-"}{formatCompactInr(amount)}
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
              This transaction is already linked to a buyer. Remove the link to re-assign.
            </div>
            <Button variant="destructive" size="sm" onClick={handleUnlink} disabled={saving}>
              <X className="size-4" /> Remove buyer link
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step 1: Search buyer */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <User className="size-3.5 text-primary" /> Step 1 — Select Buyer
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search buyer by name…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8"
                />
              </div>
              {buyers === undefined ? (
                <Skeleton className="h-24 w-full" />
              ) : buyers.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1">No buyers found</p>
              ) : (
                <div className="border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                  {buyers.map((b) => (
                    <button
                      key={b._id}
                      onClick={() => selectBuyer(b._id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-muted/50 transition-colors",
                        selectedBuyerId === b._id && "bg-primary/10 font-medium",
                      )}
                    >
                      <span>{b.name}</span>
                      <span className="text-xs text-muted-foreground">{b.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Select booking */}
            {selectedBuyerId && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-primary" /> Step 2 — Select Booking
                </Label>
                {bookings === undefined ? (
                  <Skeleton className="h-16 w-full" />
                ) : bookings.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1">No active bookings for this buyer</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    {bookings.map((b) => (
                      <button
                        key={b._id}
                        onClick={() => selectBooking(b._id)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors",
                          selectedBookingId === b._id && "bg-primary/10 font-medium",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>Unit {b.unitNumber} — {b.projectName}</span>
                          <span className="text-xs font-semibold text-foreground">{formatCompactInr(b.agreementValue)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Optionally link installment */}
            {selectedBookingId && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Step 3 — Link to Installment <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                {installments === undefined ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={selectedInstallmentId} onValueChange={(v) => setSelectedInstallmentId(v as typeof selectedInstallmentId)}>
                    <SelectTrigger>
                      <SelectValue placeholder="— no installment —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— no installment —</SelectItem>
                      {pendingInstallments.map((i) => (
                        <SelectItem key={i._id} value={i._id}>
                          {i.milestone} — {formatCompactInr(i.amount)}
                          {i.dueDate && <span className="text-muted-foreground ml-1">({i.dueDate.slice(0, 10)})</span>}
                        </SelectItem>
                      ))}
                      {pendingInstallments.length === 0 && (
                        <SelectItem value="none" disabled>No pending installments</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
                {selectedInstallmentId !== "none" && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    This installment will be marked as <strong>paid</strong>.
                  </p>
                )}
              </div>
            )}

            {/* Payment details */}
            {selectedBookingId && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Mode</Label>
                  <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as typeof paymentMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="neft">NEFT</SelectItem>
                      <SelectItem value="rtgs">RTGS</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount (₹)</Label>
                  <Input value={formatCompactInr(amount)} disabled className="bg-muted/50" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Input placeholder="e.g. partial payment…" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                {gstSplit.gstPercent > 0 && (
                  <div className="col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Receipt className="size-3.5" />
                      GST split ({gstSplit.gstPercent}%, inclusive)
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Base amount</span>
                      <span className="font-medium tabular-nums">{formatCompactInr(gstSplit.baseAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">GST amount</span>
                      <span className="font-medium tabular-nums">{formatCompactInr(gstSplit.gstAmount)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!isAlreadyLinked && (
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button
              onClick={handleLink}
              disabled={saving || !selectedBuyerId || !selectedBookingId}
            >
              <CheckCircle2 className="size-4" />
              {saving ? "Linking…" : "Link & Create Receipt"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
