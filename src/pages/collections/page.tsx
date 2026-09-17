import { useState } from "react";
import { Link } from "react-router-dom";
import { usePaginatedQuery, useQuery } from "convex/react";
import { AlertTriangleIcon, Receipt } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { BookingWithDetails } from "@/convex/bookings.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { formatDate } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";
import { OverduePanel, UpcomingDuePanel } from "@/components/payment-alerts.tsx";
import LoadMoreButton from "@/components/load-more-button.tsx";
import CollectionsDashboard from "./_components/collections-dashboard.tsx";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { useMigrationCollectionAlerts } from "@/hooks/use-migration-collection-alerts.ts";
import { useMigrationBookings } from "@/hooks/use-migration-bookings.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";

const PAGE_SIZE = 20;

export default function CollectionsPage() {
  if (migrationApiEnabled) return <MigrationCollectionsPage />;
  return <ConvexCollectionsPage />;
}

/** Per-booking summary card: agreement value, total received, and outstanding. */
function BookingCard({ booking, hasOverdue }: { booking: BookingWithDetails; hasOverdue?: boolean }) {
  const outstanding = Math.max(0, booking.agreementValue - booking.totalReceived);
  return (
    <Link
      to={`/collections/${booking._id}`}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: hasOverdue ? "var(--color-destructive)" : undefined }}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">
            {booking.unit.projectName} · {booking.unit.number}
          </span>
          <Badge variant={booking.status === "active" ? "default" : "secondary"} className="text-xs">
            {booking.status}
          </Badge>
          {hasOverdue && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              <AlertTriangleIcon className="size-3" />
              Overdue
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {booking.buyer.name}
          {booking.unit.configuration ? ` · ${booking.unit.configuration}` : ""}
          {" · "}Booked {formatDate(booking.bookingDate)}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-4 text-sm sm:text-right">
        <div>
          <p className="text-xs text-muted-foreground">Agreement</p>
          <p className="font-semibold tabular-nums">
            {formatCompactInr(booking.agreementValue)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Received</p>
          <p className="font-semibold tabular-nums text-primary">
            {formatCompactInr(booking.totalReceived)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className={cn("font-semibold tabular-nums", outstanding > 0 && "text-destructive")}>
            {formatCompactInr(outstanding)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function MigrationCollectionsPage() {
  const [filter, setFilter] = useState<"all" | "active" | "cancelled">("active");
  const bookings = useMigrationBookings(filter);
  const alerts = useMigrationCollectionAlerts();
  const overdueBookingIds = new Set<string>(alerts?.overdue.map((o) => o.bookingId as string) ?? []);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-4 md:p-8">
      <CollectionsDashboard />

      <div className="space-y-1">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">Bookings</h2>
        <p className="text-sm text-muted-foreground">Payment schedules and receipts for every booking.</p>
      </div>

      {alerts?.overdue.length ? <OverduePanel items={alerts.overdue} readOnly /> : null}
      {alerts?.upcoming.length ? <UpcomingDuePanel items={alerts.upcoming} readOnly /> : null}

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

      {bookings === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : bookings.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Receipt /></EmptyMedia>
            <EmptyTitle>No bookings</EmptyTitle>
            <EmptyDescription>Collections appear once you book a unit.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <BookingCard key={booking._id} booking={booking} hasOverdue={overdueBookingIds.has(booking._id as string)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConvexCollectionsPage() {
  const [filter, setFilter] = useState<"all" | "active" | "cancelled">("active");
  const {
    results: filtered,
    status,
    loadMore,
    isLoading,
  } = usePaginatedQuery(
    api.bookings.listPaginated,
    filter === "all" ? {} : { status: filter },
    { initialNumItems: PAGE_SIZE },
  );
  const overdue = useQuery(api.payments.listOverdue, {});
  const upcoming = useQuery(api.payments.listUpcomingDue, {});
  const migrationAlerts = useMigrationCollectionAlerts();
  const displayedOverdue = migrationApiEnabled ? migrationAlerts?.overdue : overdue;
  const displayedUpcoming = migrationApiEnabled ? migrationAlerts?.upcoming : upcoming;

  // Build a set of booking IDs that have overdue instalments
  const overdueBookingIds = new Set<string>(
    overdue?.map((o) => o.bookingId as string) ?? [],
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-4 md:p-8">
      <CollectionsDashboard />

      <div className="space-y-1">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">Bookings</h2>
        <p className="text-sm text-muted-foreground">
          Payment schedules and receipts for every booking.
        </p>
      </div>

      {/* Alert panels */}
      {((displayedOverdue?.length ?? 0) > 0 || (displayedUpcoming?.length ?? 0) > 0) && (
        <div className="space-y-3">
          {displayedOverdue && displayedOverdue.length > 0 && <OverduePanel items={displayedOverdue} readOnly={migrationApiEnabled} />}
          {displayedUpcoming && displayedUpcoming.length > 0 && <UpcomingDuePanel items={displayedUpcoming} readOnly={migrationApiEnabled} />}
        </div>
      )}

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

      {status === "LoadingFirstPage" ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 && !isLoading ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Receipt /></EmptyMedia>
            <EmptyTitle>No bookings</EmptyTitle>
            <EmptyDescription>
              Collections appear once you book a unit.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="space-y-3">
            {filtered.map((booking) => (
              <BookingCard key={booking._id} booking={booking} hasOverdue={overdueBookingIds.has(booking._id as string)} />
            ))}
          </div>
          <LoadMoreButton status={status} onLoadMore={() => loadMore(PAGE_SIZE)} pageSize={PAGE_SIZE} />
        </>
      )}
    </div>
  );
}

