import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { Building2, ScrollText } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import PageHeader from "@/components/page-header.tsx";
import { migrationApiEnabled, migrationPortalGet } from "@/lib/migration-api.ts";
import type { MigrationStatement } from "@/lib/migration-api.ts";

function MigrationPortalHomePage() {
  const [bookings, setBookings] = useState<Array<{ booking: MigrationStatement["booking"]; unit: MigrationStatement["unit"]; projectName: string; isCoBuyer: boolean }> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void migrationPortalGet<typeof bookings>("/api/portal/bookings").then(setBookings).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load bookings")); }, []);
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader title="My Bookings" breadcrumbs={[{ label: "My Bookings" }]} />
      {error ? <Empty><EmptyHeader><EmptyTitle>{error}</EmptyTitle></EmptyHeader></Empty> : !bookings ? <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div> : bookings.length === 0 ? <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><ScrollText /></EmptyMedia>
          <EmptyTitle>No bookings found</EmptyTitle>
          <EmptyDescription>Your signed-in email is not linked to a buyer booking.</EmptyDescription>
        </EmptyHeader>
      </Empty> : <div className="grid gap-4 sm:grid-cols-2">{bookings.map(({ booking, unit, projectName, isCoBuyer }) => <Link key={booking._id} to={`/portal/bookings/${booking._id}`}><Card className="h-full"><CardContent className="space-y-3"><div className="flex items-center justify-between"><Badge>{booking.status}</Badge>{isCoBuyer && <Badge variant="secondary">Co-buyer</Badge>}</div><p className="font-medium">{projectName}</p><p className="text-sm text-muted-foreground">Unit {unit?.number ?? "-"}</p><div className="flex justify-between border-t pt-3 text-sm"><span>Agreement value</span><strong>{formatCompactInr(booking.agreementValue)}</strong></div><p className="text-xs text-muted-foreground">Booked on {formatDate(booking.bookingDate)}</p></CardContent></Card></Link>)}</div>}
    </div>
  );
}

export default function PortalHomePage() {
  if (migrationApiEnabled) return <MigrationPortalHomePage />;
  const bookings = useQuery(api.portal.getMyBookings, {});

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader title="My Bookings" breadcrumbs={[{ label: "My Bookings" }]} />

      {bookings === undefined ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : bookings.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScrollText />
            </EmptyMedia>
            <EmptyTitle>No bookings yet</EmptyTitle>
            <EmptyDescription>
              Once your booking is created by the developer, it will show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {bookings.map(({ booking, unit, projectName, isCoBuyer }) => (
            <Link key={booking._id} to={`/portal/bookings/${booking._id}`}>
              <Card className="h-full transition-colors hover:bg-muted/30">
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant={booking.status === "active" ? "default" : "secondary"}>
                      {booking.status === "active" ? "Active" : "Cancelled"}
                    </Badge>
                    {isCoBuyer && <Badge variant="secondary">Co-buyer</Badge>}
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <Building2 className="size-4 text-primary" />
                      {projectName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Unit {unit?.number ?? "—"}
                      {unit?.configuration ? ` · ${unit.configuration}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">Agreement value</span>
                    <span className="font-semibold tabular-nums">
                      {formatCompactInr(booking.agreementValue)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Booked on {formatDate(booking.bookingDate)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
