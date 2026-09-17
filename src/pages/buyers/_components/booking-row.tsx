import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Building2, CheckCircle2, FileText, User, UserPlus, X, XCircle } from "lucide-react";
import { generateSaleAgreement, downloadSaleAgreement } from "@/lib/sale-agreement.ts";
import type { BookingWithDetails } from "@/convex/bookings.ts";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import { APPROVAL_STATUS_CLASSES, APPROVAL_STATUS_LABELS } from "@/lib/payments.ts";
import { useRole } from "@/hooks/use-role.ts";
import { cn } from "@/lib/utils.ts";
import { cancelMigrationBooking } from "@/lib/migration-api.ts";

type BookingRowProps = {
  booking: BookingWithDetails;
  /** Show buyer name (used on the all-bookings page). */
  showBuyer?: boolean;
  readOnly?: boolean;
  migrationMode?: boolean;
};

export default function BookingRow({ booking, showBuyer, readOnly = false, migrationMode = false }: BookingRowProps) {
  if (readOnly) return <ReadOnlyBookingRow booking={booking} showBuyer={showBuyer} migrationMode={migrationMode} />;
  return <EditableBookingRow booking={booking} showBuyer={showBuyer} />;
}

function ReadOnlyBookingRow({ booking, showBuyer, migrationMode }: BookingRowProps) {
  const handleCancel = async () => {
    if (!window.confirm("Cancel this booking? The unit will become available again.")) return;
    try { await cancelMigrationBooking(booking._id); window.location.reload(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not cancel booking"); }
  };
  return <Card className={booking.status !== "active" ? "opacity-60" : ""}><CardContent className="space-y-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex flex-wrap items-center gap-2"><Building2 className="size-4 text-muted-foreground" /><Link to={`/projects/${booking.unit.projectId}`} className="font-medium hover:text-primary">{booking.unit.projectName}</Link><span>·</span><span className="font-medium">{booking.unit.number}</span></div><div className="pl-6">{booking.allBuyers.map((buyer, index) => <div key={buyer._id} className="flex items-center gap-1.5"><User className="size-3.5 text-muted-foreground" />{showBuyer ? <Link to={`/buyers/${buyer._id}`} className="text-sm hover:text-primary">{buyer.name}</Link> : <span className="text-sm">{buyer.name}</span>}{index === 0 && booking.allBuyers.length > 1 ? <span className="text-xs text-muted-foreground">(primary)</span> : null}</div>)}</div></div><Badge variant={booking.status === "active" ? "default" : "secondary"}>{booking.status}</Badge></div><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-md bg-muted/60 p-2"><p className="text-xs text-muted-foreground">Booked on</p><p className="text-sm font-medium">{formatDate(booking.bookingDate)}</p></div><div className="rounded-md bg-muted/60 p-2"><p className="text-xs text-muted-foreground">Agreement</p><p className="text-sm font-semibold">{formatCompactInr(booking.agreementValue)}</p></div><div className="rounded-md bg-muted/60 p-2"><p className="text-xs text-muted-foreground">Booking amt</p><p className="text-sm font-semibold">{formatCompactInr(booking.bookingAmount)}</p></div></div>{migrationMode && booking.status === "active" && <div className="flex gap-2"><Button size="sm" variant="secondary"><FileText className="size-4" /> Sale Agreement</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => void handleCancel()}><XCircle className="size-4" /> Cancel booking</Button></div>}</CardContent></Card>;
}

function EditableBookingRow({ booking, showBuyer }: BookingRowProps) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [manageCoBuyersOpen, setManageCoBuyersOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const { isOwner } = useRole();
  const cancelBooking = useMutation(api.bookings.cancel);
  const updateCoBuyers = useMutation(api.bookings.updateCoBuyers);
  const approveBooking = useMutation(api.bookings.approveBooking);
  const rejectBooking = useMutation(api.bookings.rejectBooking);
  const project = useQuery(api.projects.get, { projectId: booking.unit.projectId });
  const receipts = useQuery(api.payments.listReceipts, { bookingId: booking._id });
  const allBuyers = useQuery(api.buyers.list, manageCoBuyersOpen ? {} : "skip");

  // Local state for co-buyer editing
  const [pendingCoBuyerIds, setPendingCoBuyerIds] = useState<string[]>([]);

  const openCoBuyerDialog = () => {
    setPendingCoBuyerIds(booking.coBuyerIds ?? []);
    setManageCoBuyersOpen(true);
  };

  const handleCancel = async () => {
    try {
      await cancelBooking({ bookingId: booking._id });
      toast.success("Booking cancelled — unit is now available again");
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not cancel the booking",
      );
    }
  };

  const handleApprove = async () => {
    try {
      await approveBooking({ bookingId: booking._id });
      toast.success("Booking approved");
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not approve the booking",
      );
    }
  };

  const handleReject = async () => {
    try {
      await rejectBooking({ bookingId: booking._id, rejectionReason: rejectReason || undefined });
      toast.success("Booking rejected — unit is now available again");
      setRejectOpen(false);
      setRejectReason("");
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not reject the booking",
      );
    }
  };

  const handleSaveCoBuyers = async () => {
    try {
      await updateCoBuyers({
        bookingId: booking._id,
        coBuyerIds: pendingCoBuyerIds as Id<"buyers">[],
      });
      toast.success("Co-buyers updated");
      setManageCoBuyersOpen(false);
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not update co-buyers",
      );
    }
  };

  const handleGenerateAgreement = async () => {
    if (!project) { toast.error("Project details not loaded yet"); return; }
    setGeneratingDoc(true);
    try {
      // Build co-buyer info from allBuyers
      const coBuyers = booking.allBuyers.slice(1);
      const blob = await generateSaleAgreement({
        developerName: "M/s. MIGHTY HOMES",
        developerAddress: "Flat No.414, 4th Floor, Mighty Marwel, Kannamangala, Bangalore – 560067",
        developerPartner: "Mr. SRINIVAS.P, Managing Partner",
        projectName: booking.unit.projectName,
        projectAddress: project.address ?? project.city ?? "",
        reraNumber: project.reraNumber,
        buyerName: booking.buyer.name,
        buyerPhone: booking.buyer.phone,
        buyerEmail: booking.buyer.email,
        buyerPan: booking.buyer.pan,
        buyerAddress: booking.buyer.address,
        coBuyers: coBuyers.map((b) => ({ name: b.name, pan: b.pan, phone: b.phone })),
        unitNumber: booking.unit.number,
        block: booking.unit.block,
        floor: booking.unit.floor,
        configuration: booking.unit.configuration,
        superBuiltUpAreaSqft: booking.unit.superBuiltUpAreaSqft,
        carpetAreaSqft: booking.unit.carpetAreaSqft,
        balconyAreaSqft: booking.unit.balconyAreaSqft,
        ratePerSqft: booking.unit.ratePerSqft,
        facing: booking.unit.facing,
        agreementValue: booking.agreementValue,
        bookingAmount: booking.bookingAmount,
        bookingDate: booking.bookingDate,
        gstPercent: booking.gstPercent,
        gstAmount: booking.gstAmount,
        carParkingCharges: booking.carParkingCharges,
        maintenanceFund: booking.maintenanceFund,
        corpusFund: booking.corpusFund,
        payments: (receipts ?? []).slice().sort((a, b) => a.paymentDate.localeCompare(b.paymentDate)).map((r) => ({
          amount: r.amount,
          date: r.paymentDate,
          mode: r.paymentMode?.replace(/_/g, " "),
          reference: r.referenceNumber,
        })),
      });
      downloadSaleAgreement(blob, booking.buyer.name, booking.unit.number);
      toast.success("Sale Agreement downloaded");
    } catch {
      toast.error("Could not generate agreement");
    } finally {
      setGeneratingDoc(false);
    }
  };

  const isActive = booking.status === "active";
  const approvalStatus = booking.approvalStatus ?? "approved";
  const isPendingApproval = approvalStatus === "pending_approval";

  const buyerOptions =
    allBuyers
      ?.filter((b) => b._id !== booking.buyerId)
      .map((b) => ({ value: b._id, label: `${b.name}${b.phone ? ` · ${b.phone}` : ""}` })) ?? [];

  return (
    <>
      <Card className={!isActive ? "opacity-60" : ""}>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <Link
                  to={`/projects/${booking.unit.projectId}`}
                  className="font-medium hover:text-primary"
                >
                  {booking.unit.projectName}
                </Link>
                <span className="text-muted-foreground">·</span>
                <span className="font-medium">{booking.unit.number}</span>
                {booking.unit.configuration && (
                  <span className="text-sm text-muted-foreground">
                    ({booking.unit.configuration})
                  </span>
                )}
              </div>
              {/* All buyers */}
              <div className="pl-6 space-y-0.5">
                {booking.allBuyers.map((b, i) => (
                  <div key={b._id} className="flex items-center gap-1.5">
                    <User className="size-3.5 text-muted-foreground" />
                    {showBuyer ? (
                      <Link
                        to={`/buyers/${b._id}`}
                        className="text-sm hover:text-primary"
                      >
                        {b.name}
                      </Link>
                    ) : (
                      <span className="text-sm">{b.name}</span>
                    )}
                    {i === 0 && booking.allBuyers.length > 1 && (
                      <span className="text-xs text-muted-foreground">(primary)</span>
                    )}
                    {i > 0 && (
                      <span className="text-xs text-muted-foreground">(co-buyer)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge variant={isActive ? "default" : "secondary"}>
                {isActive ? "Active" : "Cancelled"}
              </Badge>
              {approvalStatus !== "approved" && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    APPROVAL_STATUS_CLASSES[approvalStatus],
                  )}
                >
                  {APPROVAL_STATUS_LABELS[approvalStatus]}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-muted/60 p-2">
              <p className="text-xs text-muted-foreground">Booked on</p>
              <p className="text-sm font-medium tabular-nums">
                {formatDate(booking.bookingDate)}
              </p>
            </div>
            <div className="rounded-md bg-muted/60 p-2">
              <p className="text-xs text-muted-foreground">Agreement</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatCompactInr(booking.agreementValue)}
              </p>
            </div>
            <div className="rounded-md bg-muted/60 p-2">
              <p className="text-xs text-muted-foreground">Booking amt</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatCompactInr(booking.bookingAmount)}
              </p>
            </div>
          </div>

          {booking.cancellationReason && (
            <p className="text-xs text-muted-foreground">
              Reason: {booking.cancellationReason}
            </p>
          )}

          {/* Owner approval actions */}
          {isActive && isPendingApproval && isOwner && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-400/40 bg-amber-400/5 p-2.5">
              <p className="flex-1 text-xs text-amber-800 dark:text-amber-300">
                This booking was submitted by staff and is waiting for your approval.
              </p>
              <Button size="sm" onClick={() => void handleApprove()}>
                <CheckCircle2 className="size-4" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setRejectOpen(true)}
              >
                <XCircle className="size-4" />
                Reject
              </Button>
            </div>
          )}
          {isActive && isPendingApproval && !isOwner && (
            <p className="rounded-md border border-amber-400/40 bg-amber-400/5 p-2.5 text-xs text-amber-800 dark:text-amber-300">
              Waiting for owner approval before this booking is finalized.
            </p>
          )}

          {isActive && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleGenerateAgreement()}
                disabled={generatingDoc || !project}
              >
                <FileText className="size-4" />
                {generatingDoc ? "Generating…" : "Sale Agreement"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={openCoBuyerDialog}
              >
                <UserPlus className="size-4" />
                Co-Buyers ({booking.allBuyers.length - 1})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmCancel(true)}
              >
                <XCircle className="size-4" />
                Cancel booking
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel dialog */}
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              The unit will be restored to available. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleCancel()}>
              Yes, cancel it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this booking?</DialogTitle>
            <DialogDescription>
              The unit will be restored to available and the booking cancelled. Optionally tell staff why.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleReject()}>
              Reject booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage co-buyers dialog */}
      <Dialog open={manageCoBuyersOpen} onOpenChange={setManageCoBuyersOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Co-Buyers / Joint Purchasers</DialogTitle>
            <DialogDescription>
              Add or remove co-buyers on this booking. The primary buyer ({booking.buyer.name}) cannot be changed here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Current co-buyers */}
            {pendingCoBuyerIds.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Current co-buyers</p>
                {pendingCoBuyerIds.map((id) => {
                  const b = allBuyers?.find((b) => b._id === id);
                  return (
                    <div key={id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div className="flex items-center gap-2">
                        <User className="size-4 text-muted-foreground" />
                        <span className="text-sm">{b?.name ?? id}</span>
                        {b?.pan && <span className="text-xs text-muted-foreground">PAN: {b.pan}</span>}
                      </div>
                      <button
                        type="button"
                        className="rounded p-0.5 hover:bg-muted cursor-pointer"
                        onClick={() => setPendingCoBuyerIds((prev) => prev.filter((c) => c !== id))}
                      >
                        <X className="size-4 text-muted-foreground" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add co-buyer */}
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Add a co-buyer</p>
              <SearchableSelect
                options={buyerOptions.filter((o) => !pendingCoBuyerIds.includes(o.value))}
                value=""
                onValueChange={(val) => {
                  if (val && !pendingCoBuyerIds.includes(val)) {
                    setPendingCoBuyerIds((prev) => [...prev, val]);
                  }
                }}
                placeholder="Search buyers…"
                emptyText="No more buyers to add"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setManageCoBuyersOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveCoBuyers()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
