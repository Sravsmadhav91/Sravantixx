import { useEffect, useState } from "react";
import {
  getMigrationBuyer,
  listMigrationBuyerBookings,
} from "@/lib/migration-api.ts";
import type { BookingWithDetails } from "@/convex/bookings.ts";
import type { Doc } from "@/convex/_generated/dataModel";

export function useMigrationBuyerDetail(buyerId: string | undefined) {
  const [buyer, setBuyer] = useState<Doc<"buyers"> | null | undefined>();
  const [bookings, setBookings] = useState<BookingWithDetails[] | undefined>();

  useEffect(() => {
    if (!buyerId) return;
    let active = true;
    setBuyer(undefined);
    setBookings(undefined);
    Promise.all([getMigrationBuyer(buyerId), listMigrationBuyerBookings(buyerId)])
      .then(([buyerValue, bookingValue]) => {
        if (active) {
          setBuyer(buyerValue);
          setBookings(bookingValue);
        }
      })
      .catch(() => {
        if (active) {
          setBuyer(null);
          setBookings([]);
        }
      });
    return () => {
      active = false;
    };
  }, [buyerId]);

  return { buyer, bookings };
}