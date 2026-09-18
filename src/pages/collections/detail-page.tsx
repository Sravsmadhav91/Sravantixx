import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import {
  AlertTriangleIcon,
  Building2,
  CalendarIcon,
  Download,
  FileText,
  FolderOpen,
  IndianRupee,
  Mail,
  Pencil,
  Plus,
  Receipt,
  Stamp,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
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
} from "@/lib/payments.ts";
import { generateSaleAgreement, downloadSaleAgreement } from "@/lib/sale-agreement.ts";
import { cn } from "@/lib/utils.ts";
import {
  downloadBookingConfirmation,
  downloadDemandNotice,
} from "@/lib/pdf.ts";
import PageHeader from "@/components/page-header.tsx";
import AddInstallmentDialog from "./_components/add-installment-dialog.tsx";
import RecordReceiptDialog from "./_components/record-receipt-dialog.tsx";
import InstallmentRow from "./_components/installment-row.tsx";
import ReceiptRow from "./_components/receipt-row.tsx";
import SendEmailDialog from "./_components/send-email-dialog.tsx";
import DocumentPanel from "@/components/documents/document-panel.tsx";
import MigrationDocumentPanel from "@/components/documents/migration-document-panel.tsx";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { useMigrationStatement } from "@/hooks/use-migration-statement.ts";
import type { MigrationStatement } from "@/lib/migration-api.ts";

type Tab = "schedule" | "documents";
type Statement = MigrationStatement;
type UpdateBookingDateFn = (args: { bookingId: Id<"bookings">; bookingDate: string }) => Promise<unknown>;
type SetRegistrationDateFn = (args: { bookingId: Id<"bookings">; registrationDate?: string }) => Promise<unknown>;

const noopUpdateBookingDate: UpdateBookingDateFn = async () => undefined;
const noopSetRegistrationDate: SetRegistrationDateFn = async () => undefined;

// Dispatcher: only mount the data-fetching component matching the active mode, so
// Convex hooks are never called when no ConvexProvider is mounted (migration mode).
export default function CollectionDetailPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId as Id<"bookings"> | undefined;

  if (migrationApiEnabled) {
    return <MigrationCollectionDetailData bookingId={bookingId} />;
  }
  return <ConvexCollectionDetailData bookingId={bookingId} />;
}

function ConvexCollectionDetailData({ bookingId }: { bookingId: Id<"bookings"> | undefined }) {
  const updateBookingDate = useMutation(api.bookings.updateBookingDate);
  const setRegistrationDate = useMutation(api.bookings.setRegistrationDate);
  const stmt = useQuery(
    api.payments.getStatement,
    bookingId ? { bookingId } : "skip",
  );
  return (
    <CollectionDetailPageBody
      bookingId={bookingId}
      stmt={stmt as unknown as Statement | undefined}
      updateBookingDate={updateBookingDate}
      setRegistrationDate={setRegistrationDate}
    />
  );
}

function MigrationCollectionDetailData({ bookingId }: { bookingId: Id<"bookings"> | undefined }) {
  const stmt = useMigrationStatement(bookingId);
  return (
    <CollectionDetailPageBody
      bookingId={bookingId}
      stmt={stmt}
      updateBookingDate={noopUpdateBookingDate}
      setRegistrationDate={noopSetRegistrationDate}
    />
  );
}

function CollectionDetailPageBody({
  bookingId,
  stmt,
  updateBookingDate,
  setRegistrationDate,
}: {
  bookingId: Id<"bookings"> | undefined;
  stmt: Statement | undefined;
  updateBookingDate: UpdateBookingDateFn;
  setRegistrationDate: SetRegistrationDateFn;
}) {
  const [installmentDialogOpen, setInstallmentDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [generatingAgreement, setGeneratingAgreement] = useState(false);
  const [editingBookingDate, setEditingBookingDate] = useState(false);
  const [newBookingDate, setNewBookingDate] = useState("");
  const [editingRegistrationDate, setEditingRegistrationDate] = useState(false);
  const [newRegistrationDate, setNewRegistrationDate] = useState("");
  const [tab, setTab] = useState<Tab>("schedule");

  if (!bookingId) {
    return (
      <div className="p-8">
        <ErrorState>
          <ErrorStateHeader>
            <ErrorStateMedia variant="icon"><AlertTriangleIcon /></ErrorStateMedia>
            <ErrorStateTitle>Booking not found</ErrorStateTitle>
          </ErrorStateHeader>
          <ErrorStateContent>
            <Button size="sm" asChild><Link to="/collections">Back</Link></Button>
          </ErrorStateContent>
        </ErrorState>
      </div>
    );
  }

  // ── PDF helpers ───────────────────────────────────────────────────────────
  const handleDownloadBookingConfirmation = () => {
    if (!stmt) return;
    downloadBookingConfirmation({
      bookingDate: stmt.booking.bookingDate,
      agreementValue: stmt.booking.agreementValue,
      buyer: {
        name: stmt.buyer?.name ?? "—",
        phone: stmt.buyer?.phone ?? "—",
        email: stmt.buyer?.email,
        pan: stmt.buyer?.pan,
        address: stmt.buyer?.address,
      },
      project: {
        name: stmt.unit?.projectName ?? "—",
        rera: stmt.unit?.projectRera,
      },
      unit: {
        number: stmt.unit?.number ?? "—",
        block: stmt.unit?.block,
        configuration: stmt.unit?.configuration,
        areaSqft: stmt.unit?.superBuiltUpAreaSqft,
        floor: stmt.unit?.floor,
      },
      receipts: stmt.receipts.map((r) => ({
        date: r.paymentDate ?? r._creationTime?.toString() ?? new Date().toISOString(),
        amount: r.amount,
        mode: r.paymentMode ?? "—",
        reference: r.referenceNumber,
      })),
    });
  };

  const handleDownloadDemandNotice = () => {
    if (!stmt) return;
    const demandedInstallments = stmt.installments.filter(
      (i) => i.status === "demanded" || i.status === "pending",
    );
    if (demandedInstallments.length === 0) {
      return;
    }
    downloadDemandNotice({
      noticeDate: new Date().toISOString(),
      buyer: {
        name: stmt.buyer?.name ?? "—",
        phone: stmt.buyer?.phone ?? "—",
        email: stmt.buyer?.email,
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
      installments: demandedInstallments.map((i) => ({
        milestone: i.milestone,
        amount: i.amount,
        dueDate: i.dueDate ?? undefined,
        status: i.status,
      })),
      totalDemanded: demandedInstallments.reduce((s, i) => s + i.amount, 0),
      agreementValue: stmt.booking.agreementValue,
      totalReceived: stmt.totalReceived,
    });
  };

  const handleGenerateSaleAgreement = async () => {
    if (!stmt) return;
    setGeneratingAgreement(true);
    try {
      const blob = await generateSaleAgreement({
        developerName: "M/s. MIGHTY HOMES",
        developerAddress: "Flat No.414, 4th Floor, Mighty Marwel, Kannamangala, Bangalore – 560067",
        developerPartner: "Mr. SRINIVAS.P, Managing Partner",
        projectName: stmt.unit?.projectName ?? "—",
        projectAddress: stmt.unit?.projectAddress ?? stmt.unit?.projectCity ?? "",
        reraNumber: stmt.unit?.projectRera,
        buyerName: stmt.buyer?.name ?? "—",
        buyerPhone: stmt.buyer?.phone ?? "—",
        buyerEmail: stmt.buyer?.email,
        buyerPan: stmt.buyer?.pan,
        buyerAddress: stmt.buyer?.address,
        coBuyers: (stmt.coBuyers ?? []).map((b) => ({
          name: b.name,
          pan: b.pan,
          phone: b.phone,
        })),
        unitNumber: stmt.unit?.number ?? "—",
        block: stmt.unit?.block,
        floor: stmt.unit?.floor,
        configuration: stmt.unit?.configuration,
        superBuiltUpAreaSqft: stmt.unit?.superBuiltUpAreaSqft ?? 0,
        carpetAreaSqft: stmt.unit?.carpetAreaSqft,
        balconyAreaSqft: stmt.unit?.balconyAreaSqft,
        ratePerSqft: stmt.unit?.ratePerSqft ?? 0,
        facing: stmt.unit?.facing,
        agreementValue: stmt.booking.agreementValue,
        bookingAmount: stmt.booking.bookingAmount,
        bookingDate: stmt.booking.bookingDate,
        gstPercent: stmt.booking.gstPercent,
        gstAmount: stmt.booking.gstAmount,
        carParkingCharges: stmt.booking.carParkingCharges,
        maintenanceFund: stmt.booking.maintenanceFund,
        corpusFund: stmt.booking.corpusFund,
        payments: [...stmt.receipts].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate)).map((r) => ({
          amount: r.amount,
          date: r.paymentDate,
          mode: r.paymentMode?.replace(/_/g, " "),
          reference: r.referenceNumber,
        })),
      });
      downloadSaleAgreement(
        blob,
        stmt.buyer?.name ?? "Buyer",
        stmt.unit?.number ?? "Unit",
      );
      toast.success("Sale Agreement downloaded");
    } catch {
      toast.error("Could not generate Sale Agreement");
    } finally {
      setGeneratingAgreement(false);
    }
  };

  const receiptPdfContext = stmt
    ? {
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
      }
    : undefined;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      {/* Nav + PDF Download */}
      <PageHeader
        title={stmt ? `${stmt.unit?.projectName ?? "—"} · ${stmt.unit?.number ?? "—"}` : "Collection"}
        breadcrumbs={[
          { label: "Collections", to: "/collections" },
          { label: stmt ? `${stmt.unit?.projectName ?? "—"} · ${stmt.unit?.number ?? "—"}` : "…" },
        ]}
        actions={
          stmt && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm">
                  <Download className="size-4" />
                  Download PDF
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadBookingConfirmation} className="cursor-pointer">
                  <FileText className="size-4 text-muted-foreground" />
                  Booking confirmation
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDownloadDemandNotice}
                  className="cursor-pointer"
                  disabled={
                    stmt.installments.filter(
                      (i) => i.status === "demanded" || i.status === "pending",
                    ).length === 0
                  }
                >
                  <FileText className="size-4 text-muted-foreground" />
                  Payment demand notice
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void handleGenerateSaleAgreement()}
                  className="cursor-pointer"
                  disabled={generatingAgreement}
                >
                  <FileText className="size-4 text-muted-foreground" />
                  {generatingAgreement ? "Generating…" : "Sale Agreement (.docx)"}
                </DropdownMenuItem>
                {!migrationApiEnabled && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setEmailDialogOpen(true)}
                      className="cursor-pointer"
                    >
                      <Mail className="size-4 text-muted-foreground" />
                      Send email to buyer
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="size-4" />
                <Link to={`/buyers/${stmt.booking.buyerId}`} className="hover:text-primary">
                  {stmt.buyer?.name ?? "—"}
                </Link>
              </span>
              {(stmt.coBuyers ?? []).map((co) => (
                <span key={co._id} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="text-xs">+</span>
                  <Link to={`/buyers/${co._id}`} className="hover:text-primary">
                    {co.name}
                  </Link>
                  <span className="text-xs">(co-buyer)</span>
                </span>
              ))}
            </div>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="size-4" />
              {stmt.unit?.configuration ?? "Unit"}
              {stmt.unit?.areaSqft ? ` · ${stmt.unit.areaSqft} sq ft` : ""}
            </span>
            {/* Booking date with edit */}
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarIcon className="size-4" />
              {editingBookingDate ? (
                <span className="flex items-center gap-1.5">
                  <input
                    type="date"
                    defaultValue={stmt.booking.bookingDate?.slice(0, 10) ?? ""}
                    onChange={(e) => setNewBookingDate(e.target.value)}
                    className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
                  />
                  <button
                    className="text-xs text-primary font-medium cursor-pointer hover:underline"
                    onClick={async () => {
                      if (!bookingId || !newBookingDate) { setEditingBookingDate(false); return; }
                      try {
                        await updateBookingDate({
                          bookingId,
                          bookingDate: new Date(`${newBookingDate}T00:00:00Z`).toISOString(),
                        });
                        toast.success("Booking date updated");
                      } catch { toast.error("Failed to update date"); }
                      setEditingBookingDate(false);
                    }}
                  >Save</button>
                  <button className="text-xs text-muted-foreground cursor-pointer hover:underline" onClick={() => setEditingBookingDate(false)}>Cancel</button>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  {formatDate(stmt.booking.bookingDate)}
                  <button
                    className="cursor-pointer text-muted-foreground hover:text-foreground ml-0.5"
                    title="Edit booking date"
                    onClick={() => { setNewBookingDate(stmt.booking.bookingDate?.slice(0, 10) ?? ""); setEditingBookingDate(true); }}
                  >
                    <Pencil className="size-3" />
                  </button>
                </span>
              )}
            </span>
          </div>

          {/* Sale deed registration status — drives GST reporting as advance vs. regular sale */}
          {!migrationApiEnabled && stmt.booking.status === "active" && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 px-4 py-2.5 text-sm">
              <Stamp className="size-4 text-muted-foreground shrink-0" />
              {editingRegistrationDate ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-muted-foreground">Sale deed registered on</span>
                  <input
                    type="date"
                    defaultValue={stmt.booking.registrationDate?.slice(0, 10) ?? ""}
                    onChange={(e) => setNewRegistrationDate(e.target.value)}
                    className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
                  />
                  <button
                    className="text-xs text-primary font-medium cursor-pointer hover:underline"
                    onClick={async () => {
                      if (!bookingId) { setEditingRegistrationDate(false); return; }
                      try {
                        await setRegistrationDate({
                          bookingId,
                          registrationDate: newRegistrationDate || undefined,
                        });
                        toast.success(
                          newRegistrationDate
                            ? "Registration date saved — sale will report in GST as a regular sale"
                            : "Registration date cleared",
                        );
                      } catch { toast.error("Failed to update registration date"); }
                      setEditingRegistrationDate(false);
                    }}
                  >Save</button>
                  {stmt.booking.registrationDate && (
                    <button
                      className="text-xs text-destructive cursor-pointer hover:underline"
                      onClick={async () => {
                        if (!bookingId) return;
                        try {
                          await setRegistrationDate({ bookingId, registrationDate: undefined });
                          toast.success("Registration date cleared");
                        } catch { toast.error("Failed to clear registration date"); }
                        setEditingRegistrationDate(false);
                      }}
                    >Clear</button>
                  )}
                  <button className="text-xs text-muted-foreground cursor-pointer hover:underline" onClick={() => setEditingRegistrationDate(false)}>Cancel</button>
                </span>
              ) : stmt.booking.registrationDate ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">
                    Sale deed registered on <span className="font-medium text-foreground">{formatDate(stmt.booking.registrationDate)}</span> — reported in GST as a regular sale
                  </span>
                  <button
                    className="cursor-pointer text-muted-foreground hover:text-foreground ml-0.5"
                    title="Edit registration date"
                    onClick={() => { setNewRegistrationDate(stmt.booking.registrationDate?.slice(0, 10) ?? ""); setEditingRegistrationDate(true); }}
                  >
                    <Pencil className="size-3" />
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="text-amber-600 dark:text-amber-400">
                    Sale deed not yet registered — payments received are reported in GST as advances
                  </span>
                  <button
                    className="text-xs text-primary font-medium cursor-pointer hover:underline"
                    onClick={() => { setNewRegistrationDate(""); setEditingRegistrationDate(true); }}
                  >
                    Mark as registered
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Summary tiles */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Agreement value",
                value: formatCompactInr(stmt.booking.agreementValue),
                icon: IndianRupee,
              },
              {
                label: "Total received",
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

          {/* Additional charges breakdown */}
          {(stmt.booking.gstAmount || stmt.booking.carParkingCharges || stmt.booking.maintenanceFund || stmt.booking.corpusFund) && (() => {
            const charges = [
              stmt.booking.gstAmount ? { label: `GST @ ${stmt.booking.gstPercent ?? ""}%`, amount: stmt.booking.gstAmount } : null,
              stmt.booking.carParkingCharges ? { label: "Car parking", amount: stmt.booking.carParkingCharges } : null,
              stmt.booking.maintenanceFund ? { label: "Maintenance fund (1 yr)", amount: stmt.booking.maintenanceFund } : null,
              stmt.booking.corpusFund ? { label: `Corpus fund (₹${stmt.booking.corpusFundRatePerSqft ?? ""}/sq ft)`, amount: stmt.booking.corpusFund } : null,
            ].filter(Boolean) as { label: string; amount: number }[];
            const totalExtra = charges.reduce((s, c) => s + c.amount, 0);
            const grandTotal = stmt.booking.agreementValue + totalExtra;
            return (
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional charges</p>
                {charges.map((c) => (
                  <div key={c.label} className="flex justify-between text-muted-foreground">
                    <span>{c.label}</span>
                    <span className="tabular-nums">{formatCompactInr(c.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold border-t border-border pt-1.5">
                  <span>Total receivable</span>
                  <span className="tabular-nums text-primary">{formatCompactInr(grandTotal)}</span>
                </div>
              </div>
            );
          })()}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border">
            {([
              { id: "schedule" as Tab, label: "Payment Schedule", icon: Receipt },
              ...([{ id: "documents" as Tab, label: "Documents", icon: FolderOpen }]),
            ] satisfies { id: Tab; label: string; icon: typeof Receipt }[]).map(({ id, label, icon: Icon }) => (
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

          {tab === "schedule" && (<>
          {/* Installments */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Payment schedule</h2>
              {!migrationApiEnabled && stmt.booking.status === "active" && (
                <Button size="sm" onClick={() => setInstallmentDialogOpen(true)}>
                  <Plus className="size-4" />
                  Add milestone
                </Button>
              )}
            </div>

            {stmt.installments.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><IndianRupee /></EmptyMedia>
                  <EmptyTitle>No payment schedule yet</EmptyTitle>
                  <EmptyDescription>
                    Add milestones like "On Booking", "On Slab" and "On Possession".
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase">
                      <th className="px-4 py-2">Milestone</th>
                      <th className="px-4 py-2">Due date</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {stmt.installments.map((inst) => (
                      <InstallmentRow
                        key={inst._id}
                        installment={inst}
                        bookingId={bookingId}
                        onRecordReceipt={() => setReceiptDialogOpen(true)}
                        readOnly={migrationApiEnabled}
                      />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/40">
                      <td className="px-4 py-2 font-medium" colSpan={2}>Total scheduled</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">
                        {formatCompactInr(stmt.installments.reduce((s, i) => s + i.amount, 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Receipts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Receipts</h2>
              {!migrationApiEnabled && stmt.booking.status === "active" && (
                <Button size="sm" variant="secondary" onClick={() => setReceiptDialogOpen(true)}>
                  <Receipt className="size-4" />
                  Record receipt
                </Button>
              )}
            </div>

            {stmt.receipts.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Receipt /></EmptyMedia>
                  <EmptyTitle>No receipts yet</EmptyTitle>
                  <EmptyDescription>Record payments as they come in.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-2">
                {stmt.receipts.map((receipt) => (
                  <ReceiptRow
                    key={receipt._id}
                    receipt={receipt}
                    pdfContext={receiptPdfContext}
                    readOnly={migrationApiEnabled}
                  />
                ))}
                <div className="flex justify-end pt-1 text-sm font-medium">
                  Total received: {formatCompactInr(stmt.totalReceived)}
                </div>
              </div>
            )}
          </div>

          {/* Overdue badge */}
          {stmt.overdueCount > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertTriangleIcon className="size-4 shrink-0" />
              {stmt.overdueCount} instalment{stmt.overdueCount > 1 ? "s" : ""} overdue
            </div>
          )}
          </>)}

          {tab === "documents" && (
            migrationApiEnabled ? (
              <MigrationDocumentPanel
                linkedType="booking"
                linkedId={bookingId}
                linkedName={stmt.buyer?.name ? `${stmt.unit?.projectName ?? ""} · ${stmt.unit?.number ?? ""} (${stmt.buyer.name})` : undefined}
              />
            ) : (
              <DocumentPanel
                linkedType="booking"
                linkedId={bookingId}
                linkedName={stmt.buyer?.name ? `${stmt.unit?.projectName ?? ""} · ${stmt.unit?.number ?? ""} (${stmt.buyer.name})` : undefined}
              />
            )
          )}

          {!migrationApiEnabled && <AddInstallmentDialog
            open={installmentDialogOpen}
            onOpenChange={setInstallmentDialogOpen}
            bookingId={bookingId}
            projectId={stmt.unit?.projectId}
          />}
          {!migrationApiEnabled && <RecordReceiptDialog
            open={receiptDialogOpen}
            onOpenChange={setReceiptDialogOpen}
            bookingId={bookingId}
            installments={stmt.installments}
            gstPercent={stmt.booking.gstPercent}
          />}
          {stmt && !migrationApiEnabled && (
            <SendEmailDialog
              open={emailDialogOpen}
              onOpenChange={setEmailDialogOpen}
              bookingId={bookingId}
              buyerEmail={stmt.buyer?.email}
              buyerName={stmt.buyer?.name}
              installments={stmt.installments.map((i) => ({
                _id: i._id,
                milestone: i.milestone,
                amount: i.amount,
                dueDate: i.dueDate,
                status: i.status,
                emailedAt: i.emailedAt,
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}
