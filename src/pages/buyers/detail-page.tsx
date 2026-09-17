import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { AlertTriangleIcon, ClipboardList, FolderOpen, History, Mail, MapPin, Pencil, Phone } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  ErrorState,
  ErrorStateContent,
  ErrorStateDescription,
  ErrorStateHeader,
  ErrorStateMedia,
  ErrorStateTitle,
} from "@/components/ui/error-state.tsx";
import { ScrollText } from "lucide-react";
import PageHeader from "@/components/page-header.tsx";
import BuyerFormDialog from "./_components/buyer-form-dialog.tsx";
import BookingRow from "./_components/booking-row.tsx";
import ActivityTimeline from "@/components/crm/activity-timeline.tsx";
import TaskList from "@/components/crm/task-list.tsx";
import DocumentPanel from "@/components/documents/document-panel.tsx";
import { cn } from "@/lib/utils.ts";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { useMigrationBuyerDetail } from "@/hooks/use-migration-buyer-detail.ts";

type Tab = "bookings" | "activity" | "tasks" | "documents";

export default function BuyerDetailPage() {
  const params = useParams<{ buyerId: string }>();
  const buyerId = params.buyerId as Id<"buyers"> | undefined;
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("bookings");

  const buyer = useQuery(api.buyers.get, buyerId ? { buyerId } : "skip");
  const bookings = useQuery(
    api.bookings.listByBuyer,
    buyerId ? { buyerId } : "skip",
  );
  const migrationDetail = useMigrationBuyerDetail(buyerId);
  const displayedBuyer = migrationApiEnabled ? migrationDetail.buyer : buyer;
  const displayedBookings = migrationApiEnabled ? migrationDetail.bookings : bookings;

  if (!buyerId) {
    return (
      <div className="p-8">
        <ErrorState>
          <ErrorStateHeader>
            <ErrorStateMedia variant="icon"><AlertTriangleIcon /></ErrorStateMedia>
            <ErrorStateTitle>Buyer not found</ErrorStateTitle>
          </ErrorStateHeader>
          <ErrorStateContent>
            <Button size="sm" asChild>
              <Link to="/buyers">Back to buyers</Link>
            </Button>
          </ErrorStateContent>
        </ErrorState>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof ScrollText }[] = [
    { id: "bookings", label: "Bookings", icon: ScrollText },
    ...(!migrationApiEnabled ? [
      { id: "activity" as const, label: "Activity", icon: History },
      { id: "tasks" as const, label: "Tasks", icon: ClipboardList },
      { id: "documents" as const, label: "Documents", icon: FolderOpen },
    ] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={displayedBuyer?.name ?? "Buyer"}
        breadcrumbs={[
          { label: "Buyers", to: "/buyers" },
          { label: displayedBuyer?.name ?? "…" },
        ]}
        actions={
          !migrationApiEnabled && buyer && (
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
          )
        }
      />

      {displayedBuyer === undefined ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : displayedBuyer === null ? (
        <ErrorState>
          <ErrorStateHeader>
            <ErrorStateMedia variant="icon"><AlertTriangleIcon /></ErrorStateMedia>
            <ErrorStateTitle>Buyer not available</ErrorStateTitle>
            <ErrorStateDescription>It may have been removed.</ErrorStateDescription>
          </ErrorStateHeader>
        </ErrorState>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
              {displayedBuyer.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div className="space-y-1">
              {displayedBuyer.pan && (
                <p className="text-sm text-muted-foreground">PAN: {displayedBuyer.pan}</p>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="size-4 text-muted-foreground" />
                <span>{displayedBuyer.phone}</span>
              </div>
              {displayedBuyer.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="size-4 text-muted-foreground" />
                  <span className="break-all">{displayedBuyer.email}</span>
                </div>
              )}
              {displayedBuyer.address && (
                <div className="flex items-start gap-2 text-sm sm:col-span-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>{displayedBuyer.address}</span>
                </div>
              )}
              {displayedBuyer.notes && (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  {displayedBuyer.notes}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border pb-0">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors border-b-2 -mb-px",
                  tab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "bookings" && (
            <>
              {displayedBookings === undefined ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : displayedBookings.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><ScrollText /></EmptyMedia>
                    <EmptyTitle>No bookings yet</EmptyTitle>
                    <EmptyDescription>
                      Book a unit from the project inventory page.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="space-y-3">
                  {displayedBookings.map((booking) => (
                    <BookingRow key={booking._id} booking={booking} readOnly={migrationApiEnabled} />
                  ))}
                </div>
              )}
            </>
          )}

          {!migrationApiEnabled && tab === "activity" && (
            <ActivityTimeline
              linkedType="buyer"
              linkedId={buyerId}
            />
          )}

          {!migrationApiEnabled && tab === "tasks" && (
            <TaskList
              linkedType="buyer"
              linkedId={buyerId}
              linkedName={displayedBuyer.name}
            />
          )}

          {!migrationApiEnabled && tab === "documents" && (
            <DocumentPanel
              linkedType="buyer"
              linkedId={buyerId}
              linkedName={displayedBuyer.name}
            />
          )}

          {!migrationApiEnabled && <BuyerFormDialog open={editOpen} onOpenChange={setEditOpen} buyer={buyer} />}
        </>
      )}
    </div>
  );
}
