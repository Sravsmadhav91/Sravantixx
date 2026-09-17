import { Link, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  AlertTriangleIcon,
  Building2,
  Download,
  FileText,
  FolderOpen,
  IndianRupee,
  Receipt,
  TrendingDown,
  User,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  ErrorState,
  ErrorStateContent,
  ErrorStateDescription,
  ErrorStateHeader,
  ErrorStateMedia,
  ErrorStateTitle,
} from "@/components/ui/error-state.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import {
  INSTALLMENT_STATUS_CLASSES,
  INSTALLMENT_STATUS_LABELS,
  PAYMENT_MODE_LABELS,
} from "@/lib/payments.ts";
import { downloadReceipt } from "@/lib/pdf.ts";
import { cn } from "@/lib/utils.ts";
import PageHeader from "@/components/page-header.tsx";
import { migrationApiEnabled } from "@/lib/migration-api.ts";

type Tab = "schedule" | "documents";

function MigrationPortalBookingDetailPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader title="Booking details" breadcrumbs={[{ label: "My Bookings", to: "/portal" }, { label: "Booking details" }]} />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><FolderOpen /></EmptyMedia>
          <EmptyTitle>Booking details are in migration mode</EmptyTitle>
          <EmptyDescription>The migration backend is currently serving buyer booking details.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}

export default function PortalBookingDetailPage() {
  if (migrationApiEnabled) return <MigrationPortalBookingDetailPage />;

  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId as Id<"bookings"> | undefined;

  const stmt = useQuery(
    api.portal.getMyBookingStatement,
    bookingId ? { bookingId } : "skip",
  );
  const documents = useQuery(
    api.portal.getMyBookingDocuments,
    bookingId ? { bookingId } : "skip",
  );

  if (!bookingId) {
    return (
      <div className="p-8">
        <ErrorState>
          <ErrorStateHeader>
            <ErrorStateMedia variant="icon"><AlertTriangleIcon /></ErrorStateMedia>
            <ErrorStateTitle>Booking not found</ErrorStateTitle>
          </ErrorStateHeader>
          <ErrorStateContent>
            <Button size="sm" asChild><Link to="/portal">Back</Link></Button>
          </ErrorStateContent>
        </ErrorState>
      </div>
    );
  }

  const handleDownloadReceipt = (receiptId: string) => {
    if (!stmt) return;
    const receipt = stmt.receipts.find((r) => r._id === receiptId);
    if (!receipt) return;
    downloadReceipt({
      receiptNumber: receipt._id.slice(-8).toUpperCase(),
      receiptDate: receipt.paymentDate,
      amount: receipt.amount,
      paymentMode: receipt.paymentMode,
      chequeRef: receipt.referenceNumber,
      notes: receipt.notes,
      buyer: {
        name: stmt.buyer?.name ?? "—",
        phone: stmt.buyer?.phone ?? "—",
        email: stmt.buyer?.email,
        pan: stmt.buyer?.pan,
      },
      project: {
        name: stmt.unit?.projectName ?? "—",
        rera: stmt.unit?.projectRera,
      },
      unit: {
        number: stmt.unit?.number ?? "—",
        block: stmt.unit?.block,
        configuration: stmt.unit?.configuration,
      },
      agreementValue: stmt.booking.agreementValue,
      totalReceived: stmt.totalReceived,
      balanceOutstanding: stmt.outstanding,
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={stmt ? `${stmt.unit?.projectName ?? "—"} · ${stmt.unit?.number ?? "—"}` : "Booking"}
        breadcrumbs={[
          { label: "My Bookings", to: "/portal" },
          { label: stmt ? `${stmt.unit?.projectName ?? "—"} · ${stmt.unit?.number ?? "—"}` : "…" },
        ]}
      />

      {stmt === undefined ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={stmt.booking.status === "active" ? "default" : "secondary"}>
              {stmt.booking.status === "active" ? "Active" : "Cancelled"}
            </Badge>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="size-4" />
              {stmt.buyer?.name ?? "—"}
            </span>
            {(stmt.coBuyers ?? []).map((co) => (
              <span key={co._id} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="text-xs">+</span>
                {co.name}
                <span className="text-xs">(co-buyer)</span>
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="size-4" />
              {stmt.unit?.configuration ?? "Unit"}
              {stmt.unit?.areaSqft ? ` · ${stmt.unit.areaSqft} sq ft` : ""}
            </span>
          </div>

          {/* Summary tiles */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Agreement value",
                value: formatCompactInr(stmt.booking.agreementValue),
                icon: IndianRupee,
              },
              {
                label: "Total paid",
                value: formatCompactInr(stmt.totalReceived),
                icon: Receipt,
              },
              {
                label: "Outstanding",
                value: formatCompactInr(Math.max(0, stmt.outstanding)),
                icon: TrendingDown,
                highlight: stmt.outstanding > 0,
              },
            ].map((tile) => {
              const Icon = tile.icon;
              return (
                <Card key={tile.label}>
                  <CardContent className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {tile.label}
                      </p>
                      <Icon className={cn("size-4", tile.highlight ? "text-destructive" : "text-primary")} />
                    </div>
                    <p className={cn("text-2xl font-semibold tabular-nums", tile.highlight && "text-destructive")}>
                      {tile.value}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Payment schedule */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Payment Schedule
            </h2>
            {stmt.installments.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Receipt /></EmptyMedia>
                  <EmptyTitle>No payment schedule yet</EmptyTitle>
                  <EmptyDescription>Your developer has not set up a payment plan yet.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs font-medium text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-2.5">Milestone</th>
                      <th className="px-4 py-2.5">Due Date</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stmt.installments.map((inst) => (
                      <tr key={inst._id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium">{inst.milestone}</td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">
                          {inst.dueDate ? formatDate(inst.dueDate) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {formatCompactInr(inst.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                              INSTALLMENT_STATUS_CLASSES[inst.status],
                            )}
                          >
                            {INSTALLMENT_STATUS_LABELS[inst.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Receipts */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Payment Receipts
            </h2>
            {stmt.receipts.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Receipt /></EmptyMedia>
                  <EmptyTitle>No payments recorded yet</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-2">
                {stmt.receipts.map((receipt) => (
                  <div
                    key={receipt._id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold tabular-nums">
                          {formatCompactInr(receipt.amount)}
                        </span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {PAYMENT_MODE_LABELS[receipt.paymentMode]}
                        </span>
                        {receipt.referenceNumber && (
                          <span className="text-xs text-muted-foreground">
                            Ref: {receipt.referenceNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(receipt.paymentDate)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-primary"
                      onClick={() => handleDownloadReceipt(receipt._id)}
                      aria-label="Download receipt PDF"
                      title="Download receipt"
                    >
                      <Download className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documents */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Documents
            </h2>
            {documents === undefined ? (
              <Skeleton className="h-20 w-full" />
            ) : documents.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><FolderOpen /></EmptyMedia>
                  <EmptyTitle>No documents shared yet</EmptyTitle>
                  <EmptyDescription>
                    Your sale agreement and other documents will appear here once shared.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-1.5">
                {documents.map((doc) => (
                  <div
                    key={doc._id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <FileText className="size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{doc.label ?? doc.fileName}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(doc.uploadedAt)}</p>
                    </div>
                    {doc.url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        asChild
                      >
                        <a href={doc.url} download={doc.fileName} target="_blank" rel="noreferrer">
                          <Download className="size-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
