import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { ScrollText } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import BookingRow from "../buyers/_components/booking-row.tsx";
import ApprovalNotificationsPanel from "@/components/approval-notifications.tsx";
import LoadMoreButton from "@/components/load-more-button.tsx";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { useMigrationBookings } from "@/hooks/use-migration-bookings.ts";

const PAGE_SIZE = 20;

export default function BookingsPage() {
  if (migrationApiEnabled) return <MigrationBookingsPage />;
  return <ConvexBookingsPage />;
}

function MigrationBookingsPage() {
  const [filter, setFilter] = useState<"all" | "active" | "cancelled">("all");
  const bookings = useMigrationBookings(filter);
  return <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8"><div className="space-y-1"><h1 className="font-serif text-3xl font-semibold tracking-tight">Bookings</h1><p className="text-sm text-muted-foreground">All unit bookings across your projects.</p></div><div className="flex gap-2">{(["all", "active", "cancelled"] as const).map((s) => <button key={s} onClick={() => setFilter(s)} className={filter === s ? "rounded-md bg-primary px-3 py-1.5 text-sm capitalize text-primary-foreground" : "rounded-md bg-secondary px-3 py-1.5 text-sm capitalize"}>{s}</button>)}</div>{bookings === undefined ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div> : bookings.length === 0 ? <Empty><EmptyHeader><EmptyMedia variant="icon"><ScrollText /></EmptyMedia><EmptyTitle>No bookings</EmptyTitle></EmptyHeader></Empty> : <div className="space-y-3">{bookings.map((booking) => <BookingRow key={booking._id} booking={booking} showBuyer readOnly migrationMode />)}</div>}</div>;
}

function ConvexBookingsPage() {
  const [filter, setFilter] = useState<"all" | "active" | "cancelled">("all");

  const {
    results: bookings,
    status,
    loadMore,
    isLoading,
  } = usePaginatedQuery(
    api.bookings.listPaginated,
    filter === "all" ? {} : { status: filter },
    { initialNumItems: PAGE_SIZE },
  );
  const migrationBookings = useMigrationBookings(filter);
  const displayedBookings = migrationApiEnabled ? migrationBookings ?? [] : bookings;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Bookings
        </h1>
        <p className="text-sm text-muted-foreground">
          All unit bookings across your projects.
        </p>
      </div>

      {!migrationApiEnabled && <ApprovalNotificationsPanel />}

      <div className="flex gap-2">
        {(["all", "active", "cancelled"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={[
              "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors cursor-pointer",
              filter === s
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            ].join(" ")}
          >
            {s}
          </button>
        ))}
      </div>

      {(migrationApiEnabled ? migrationBookings === undefined : status === "LoadingFirstPage") ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : displayedBookings.length === 0 && !isLoading ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScrollText />
            </EmptyMedia>
            <EmptyTitle>No bookings</EmptyTitle>
            <EmptyDescription>
              Book a unit from the project inventory page.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="space-y-3">
            {displayedBookings.map((booking) => (
              <BookingRow key={booking._id} booking={booking} showBuyer readOnly={migrationApiEnabled} />
            ))}
          </div>
          {!migrationApiEnabled && <LoadMoreButton status={status} onLoadMore={() => loadMore(PAGE_SIZE)} pageSize={PAGE_SIZE} />}
        </>
      )}
    </div>
  );
}
