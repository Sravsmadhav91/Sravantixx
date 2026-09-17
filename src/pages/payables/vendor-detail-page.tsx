import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { Authenticated } from "convex/react";
import { Plus, CheckCircle, CreditCard, XCircle, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { cn } from "@/lib/utils.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, VENDOR_CATEGORY_LABELS } from "@/lib/vendors.ts";
import { migrationApiEnabled, migrationGet } from "@/lib/migration-api.ts";
import PurchaseInvoiceDialog from "./_components/purchase-invoice-dialog.tsx";
import RecordPaymentDialog from "./_components/record-payment-dialog.tsx";

export default function VendorDetailPage() {
  if (migrationApiEnabled) {
    return <MigrationVendorDetailPage />;
  }

  return (
    <Authenticated>
      <VendorDetailInner />
    </Authenticated>
  );
}

function MigrationVendorDetailPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const [ledger, setLedger] = useState<any | null | undefined>(undefined);

  useEffect(() => {
    if (!vendorId) {
      setLedger(null);
      return;
    }

    let active = true;
    migrationGet<any>(`/api/payables/vendors/${encodeURIComponent(vendorId)}/ledger`)
      .then((value) => {
        if (active) setLedger(value);
      })
      .catch(() => {
        if (active) setLedger(null);
      });

    return () => {
      active = false;
    };
  }, [vendorId]);

  if (!vendorId) return <div className="p-8 text-muted-foreground">Invalid vendor.</div>;
  if (ledger === undefined) {
    return (
      <div className="mx-auto max-w-4xl p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }
  if (!ledger) return <div className="p-8 text-muted-foreground">Vendor not found.</div>;

  const { vendor, invoices, agingSummary, totalOutstanding } = ledger;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={vendor.name}
        subtitle={VENDOR_CATEGORY_LABELS[vendor.category] ?? vendor.category}
        breadcrumbs={[{ label: "Accounts Payable", to: "/payables" }, { label: vendor.name }]}
      />

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4 space-y-2 text-sm">
          <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Vendor Details</p>
          {vendor.gstin && <p><span className="text-muted-foreground">GSTIN:</span> <span className="font-mono">{vendor.gstin}</span></p>}
          {vendor.pan && <p><span className="text-muted-foreground">PAN:</span> <span className="font-mono">{vendor.pan}</span></p>}
          {vendor.phone && <p><span className="text-muted-foreground">Phone:</span> {vendor.phone}</p>}
          {vendor.email && <p><span className="text-muted-foreground">Email:</span> {vendor.email}</p>}
          {vendor.city && <p><span className="text-muted-foreground">City:</span> {vendor.city}{vendor.state ? `, ${vendor.state}` : ""}</p>}
          {vendor.bankName && (
            <p><span className="text-muted-foreground">Bank:</span> {vendor.bankName} — {vendor.bankAccount} ({vendor.bankIfsc})</p>
          )}
          {!vendor.isActive && <Badge variant="secondary">Inactive</Badge>}
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-2 text-sm">
          <div className="flex justify-between items-center mb-2">
            <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">AP Aging</p>
            <p className="font-bold text-lg">{formatCompactInr(totalOutstanding)}</p>
          </div>
          {[
            { label: "Current (not due)", value: agingSummary.current },
            { label: "1-30 days overdue", value: agingSummary.days30, color: "text-amber-600" },
            { label: "31-60 days", value: agingSummary.days60, color: "text-orange-600" },
            { label: "61-90 days", value: agingSummary.days90, color: "text-red-600" },
            { label: "90+ days", value: agingSummary.over90, color: "text-red-700 font-bold" },
          ].map((r) => r.value > 0 && (
            <div key={r.label} className="flex justify-between">
              <span className="text-muted-foreground">{r.label}</span>
              <span className={cn("font-mono tabular-nums", r.color)}>{formatCompactInr(r.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Purchase Invoices</h3>
        {invoices.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm border rounded-lg">
            No invoices yet. Create the first one above.
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs font-medium text-muted-foreground">
                  <th className="px-3 py-2 text-left">Ref</th>
                  <th className="px-3 py-2 text-left">Invoice No.</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Outstanding</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((invoice: any) => (
                  <tr key={invoice._id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{invoice.internalRef || "—"}</td>
                    <td className="px-3 py-2">{invoice.invoiceNumber || "—"}</td>
                    <td className="px-3 py-2">{invoice.date ? formatDate(invoice.date) : "—"}</td>
                    <td className="px-3 py-2">{invoice.dueDate ? formatDate(invoice.dueDate) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{formatCompactInr(invoice.total || 0)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{formatCompactInr(invoice.outstanding || 0)}</td>
                    <td className="px-3 py-2">
                      <Badge className={INVOICE_STATUS_COLORS[invoice.status] ?? "bg-slate-200 text-slate-800"}>
                        {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function VendorDetailInner() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const id = vendorId as Id<"vendors"> | undefined;

  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState<{ invoiceId: Id<"purchaseInvoices">; outstanding: number } | null>(null);

  const ledger = useQuery(api.vendors.getVendorLedger, id ? { vendorId: id } : "skip");
  const subcontracts = useQuery(api.subcontracts.listSubcontracts, id ? { vendorId: id } : "skip");
  const approveInvoice = useMutation(api.vendors.approvePurchaseInvoice);
  const cancelInvoice = useMutation(api.vendors.cancelPurchaseInvoice);

  if (!id) return <div className="p-8 text-muted-foreground">Invalid vendor.</div>;
  if (ledger === undefined) return (
    <div className="mx-auto max-w-4xl p-8 space-y-4">
      <Skeleton className="h-10 w-64" />
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );
  if (!ledger) return <div className="p-8 text-muted-foreground">Vendor not found.</div>;

  const { vendor, invoices, agingSummary, totalOutstanding } = ledger;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={vendor.name}
        subtitle={VENDOR_CATEGORY_LABELS[vendor.category] ?? vendor.category}
        breadcrumbs={[
          { label: "Accounts Payable", to: "/payables" },
          { label: vendor.name },
        ]}
        actions={
          <Button size="sm" onClick={() => setInvoiceDialog(true)}>
            <Plus className="size-4" /> New Invoice
          </Button>
        }
      />

      {/* Vendor info + aging */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4 space-y-2 text-sm">
          <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Vendor Details</p>
          {vendor.gstin && <p><span className="text-muted-foreground">GSTIN:</span> <span className="font-mono">{vendor.gstin}</span></p>}
          {vendor.pan && <p><span className="text-muted-foreground">PAN:</span> <span className="font-mono">{vendor.pan}</span></p>}
          {vendor.phone && <p><span className="text-muted-foreground">Phone:</span> {vendor.phone}</p>}
          {vendor.email && <p><span className="text-muted-foreground">Email:</span> {vendor.email}</p>}
          {vendor.city && <p><span className="text-muted-foreground">City:</span> {vendor.city}{vendor.state ? `, ${vendor.state}` : ""}</p>}
          {vendor.bankName && (
            <p><span className="text-muted-foreground">Bank:</span> {vendor.bankName} — {vendor.bankAccount} ({vendor.bankIfsc})</p>
          )}
          {!vendor.isActive && <Badge variant="secondary">Inactive</Badge>}
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-2 text-sm">
          <div className="flex justify-between items-center mb-2">
            <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">AP Aging</p>
            <p className="font-bold text-lg">{formatCompactInr(totalOutstanding)}</p>
          </div>
          {[
            { label: "Current (not due)", value: agingSummary.current },
            { label: "1-30 days overdue", value: agingSummary.days30, color: "text-amber-600" },
            { label: "31-60 days", value: agingSummary.days60, color: "text-orange-600" },
            { label: "61-90 days", value: agingSummary.days90, color: "text-red-600" },
            { label: "90+ days", value: agingSummary.over90, color: "text-red-700 font-bold" },
          ].map((r) => r.value > 0 && (
            <div key={r.label} className="flex justify-between">
              <span className="text-muted-foreground">{r.label}</span>
              <span className={cn("font-mono tabular-nums", r.color)}>{formatCompactInr(r.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Subcontracts summary */}
      {subcontracts && subcontracts.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Subcontracts</h3>
            <Link to="/subcontracts" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {subcontracts.map((c) => {
              const pct = c.contractValue > 0 ? Math.min(100, (c.paidAmount / c.contractValue) * 100) : 0;
              return (
                <div key={c._id} className="rounded-lg border bg-card px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{c.projectName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className={cn("font-mono font-semibold tabular-nums", c.balance > 0.01 ? "text-amber-600" : "text-green-600")}>
                        {formatCompactInr(c.balance)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {formatCompactInr(c.paidAmount)} of {formatCompactInr(c.contractValue)} paid
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invoice list */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Purchase Invoices</h3>
        {invoices.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm border rounded-lg">
            No invoices yet. Create the first one above.
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs font-medium text-muted-foreground">
                  <th className="px-3 py-2 text-left">Ref</th>
                  <th className="px-3 py-2 text-left">Invoice No.</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Outstanding</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{inv.internalRef}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{inv.invoiceNumber}</td>
                    <td className="px-3 py-2 text-xs">{formatDate(inv.date)}</td>
                    <td className={cn("px-3 py-2 text-xs",
                      inv.dueDate && inv.dueDate < new Date().toISOString().slice(0, 10) && inv.status === "approved"
                        ? "text-red-600 font-medium" : "text-muted-foreground")}>
                      {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-xs">{formatCompactInr(inv.total)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-xs font-semibold">
                      {inv.outstanding > 0.01 ? formatCompactInr(inv.outstanding) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", INVOICE_STATUS_COLORS[inv.status])}>
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {inv.status === "draft" && (
                            <DropdownMenuItem onClick={async () => {
                              try { await approveInvoice({ invoiceId: inv._id }); toast.success("Invoice approved"); }
                              catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                            }}>
                              <CheckCircle className="size-4 mr-2 text-green-600" /> Approve & Post JE
                            </DropdownMenuItem>
                          )}
                          {inv.status === "approved" && inv.outstanding > 0.01 && (
                            <DropdownMenuItem onClick={() => setPaymentDialog({ invoiceId: inv._id, outstanding: inv.outstanding })}>
                              <CreditCard className="size-4 mr-2" /> Record Payment
                            </DropdownMenuItem>
                          )}
                          {inv.status !== "paid" && inv.status !== "cancelled" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={async () => {
                                try { await cancelInvoice({ invoiceId: inv._id }); toast.success("Invoice cancelled"); }
                                catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                              }}>
                                <XCircle className="size-4 mr-2" /> Cancel
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PurchaseInvoiceDialog
        open={invoiceDialog}
        onOpenChange={setInvoiceDialog}
        preselectedVendorId={id}
      />
      {paymentDialog && (
        <RecordPaymentDialog
          open
          onOpenChange={(o) => { if (!o) setPaymentDialog(null); }}
          invoiceId={paymentDialog.invoiceId}
          outstanding={paymentDialog.outstanding}
          vendorName={vendor.name}
        />
      )}
    </div>
  );
}
