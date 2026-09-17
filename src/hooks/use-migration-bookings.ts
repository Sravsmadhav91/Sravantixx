import { useEffect, useState } from "react";
import { listMigrationBookings } from "@/lib/migration-api.ts";
import type { BookingWithDetails } from "@/convex/bookings.ts";

export function useMigrationBookings(status: "all" | "active" | "cancelled") {
  const [bookings, setBookings] = useState<BookingWithDetails[] | undefined>();

  useEffect(() => {
    let active = true;
    setBookings(undefined);
    listMigrationBookings(status === "all" ? undefined : status)
      .then((value) => active && setBookings(value))
      .catch(() => active && setBookings([]));
    return () => {
      active = false;
    };
  }, [status]);

  return bookings;
}