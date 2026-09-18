import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, User, UserPlus, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { BookingWithDetails } from "@/convex/bookings.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import {
  cancelMigrationBooking,
  updateMigrationBooking,
} from "@/lib/migration-api.ts";
import { useMigrationBuyers } from "@/hooks/use-migration-buyers.ts";

type Props = { booking: BookingWithDetails; showBuyer?: boolean };

export default function MigrationBookingRow({ booking, showBuyer }: Props) {
  const [manageOpen, setManageOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[]>(
    booking.coBuyerIds ?? [],
  );
  const [saleAgreementDone, setSaleAgreementDone] = useState(
    Boolean((booking as BookingWithDetails & { saleAgreementDone?: boolean }).saleAgreementDone),
  );
  const [saleDeedDone, setSaleDeedDone] = useState(
    Boolean((booking as BookingWithDetails & { saleDeedDone?: boolean }).saleDeedDone),
  );
  const buyers = useMigrationBuyers("") ?? [];

  const cancel = async () => {
    if (
      !window.confirm(
        "Cancel this booking? The unit will become available again.",
      )
    )
      return;
    try {
      await cancelMigrationBooking(booking._id);
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not cancel booking",
      );
    }
  };

  const saveCoBuyers = async () => {
    try {
      await updateMigrationBooking(booking._id, { coBuyerIds: pendingIds });
      toast.success("Co-buyers updated");
      setManageOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update co-buyers",
      );
    }
  };

  const toggleDocumentStatus = async (field: "saleAgreementDone" | "saleDeedDone", value: boolean) => {
    if (field === "saleAgreementDone") setSaleAgreementDone(value);
    else setSaleDeedDone(value);
    try {
      await updateMigrationBooking(booking._id, { [field]: value });
      toast.success(value ? "Document marked complete" : "Document marked incomplete");
    } catch (error) {
      if (field === "saleAgreementDone") setSaleAgreementDone(!value);
      else setSaleDeedDone(!value);
      toast.error(error instanceof Error ? error.message : "Could not update document status");
    }
  };

  const buyerOptions = buyers
    .filter(
      (buyer) =>
        buyer._id !== booking.buyerId && !pendingIds.includes(buyer._id),
    )
    .map((buyer) => ({
      value: buyer._id,
      label: `${buyer.name}${buyer.phone ? ` · ${buyer.phone}` : ""}`,
    }));
  return (
    <>
      <Card className={booking.status !== "active" ? "opacity-60" : ""}>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <Link
                  to={`/projects/${booking.unit.projectId}`}
                  className="font-medium hover:text-primary"
                >
                  {booking.unit.projectName}
                </Link>
                <span>·</span>
                <span className="font-medium">{booking.unit.number}</span>
              </div>
              <div className="pl-6">
                {booking.allBuyers.map((buyer, index) => (
                  <div key={buyer._id} className="flex items-center gap-1.5">
                    <User className="size-3.5 text-muted-foreground" />
                    {showBuyer ? (
                      <Link
                        to={`/buyers/${buyer._id}`}
                        className="text-sm hover:text-primary"
                      >
                        {buyer.name}
                      </Link>
                    ) : (
                      <span className="text-sm">{buyer.name}</span>
                    )}
                    {index === 0 && booking.allBuyers.length > 1 && (
                      <span className="text-xs text-muted-foreground">
                        (primary)
                      </span>
                    )}
                    {index > 0 && (
                      <span className="text-xs text-muted-foreground">
                        (co-buyer)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <Badge
              variant={booking.status === "active" ? "default" : "secondary"}
            >
              {booking.status}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-muted/60 p-2">
              <p className="text-xs text-muted-foreground">Booked on</p>
              <p className="text-sm font-medium">
                {formatDate(booking.bookingDate)}
              </p>
            </div>
            <div className="rounded-md bg-muted/60 p-2">
              <p className="text-xs text-muted-foreground">Agreement</p>
              <p className="text-sm font-semibold">
                {formatCompactInr(booking.agreementValue)}
              </p>
            </div>
            <div className="rounded-md bg-muted/60 p-2">
              <p className="text-xs text-muted-foreground">Booking amt</p>
              <p className="text-sm font-semibold">
                {formatCompactInr(booking.bookingAmount)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 rounded-md border bg-muted/20 px-3 py-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={saleAgreementDone}
                onChange={(event) => void toggleDocumentStatus("saleAgreementDone", event.target.checked)}
                className="size-4 accent-primary"
              />
              Sale Agreement done
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={saleDeedDone}
                onChange={(event) => void toggleDocumentStatus("saleDeedDone", event.target.checked)}
                className="size-4 accent-primary"
              />
              Sale Deed done
            </label>
          </div>
          {booking.status === "active" && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPendingIds(booking.coBuyerIds ?? []);
                  setManageOpen(true);
                }}
              >
                <UserPlus className="size-4" /> Co-Buyers (
                {booking.allBuyers.length - 1})
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => void cancel()}
              >
                <XCircle className="size-4" /> Cancel booking
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Co-Buyers / Joint Purchasers</DialogTitle>
            <DialogDescription>
              Search and add existing buyers to this booking.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {pendingIds.map((id) => {
              const buyer = buyers.find((item) => item._id === id);
              return (
                <div
                  key={id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>{buyer?.name ?? id}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingIds((current) =>
                        current.filter((item) => item !== id),
                      )
                    }
                  >
                    <X className="size-4" />
                  </button>
                </div>
              );
            })}
            <SearchableSelect
              options={buyerOptions}
              value=""
              onValueChange={(value) =>
                setPendingIds((current) => [...current, value])
              }
              placeholder="Search buyers…"
              emptyText="No more buyers to add"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setManageOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveCoBuyers()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
