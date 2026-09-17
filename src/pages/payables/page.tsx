import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Authenticated } from "convex/react";
import {
  Plus, Building2, Search, MoreHorizontal, CheckCircle, XCircle, CreditCard, ChevronRight,
  FileText, ArrowRight, Pencil, Truck, ScanLine, AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { cn } from "@/lib/utils.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import {
  VENDOR_CATEGORIES, VENDOR_CATEGORY_LABELS,
  INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS,
  PO_STATUS_LABELS, PO_STATUS_COLORS,
} from "@/lib/vendors.ts";
import VendorFormDialog from "./_components/vendor-form-dialog.tsx";
import PurchaseInvoiceDialog from "./_components/purchase-invoice-dialog.tsx";
import RecordPaymentDialog from "./_components/record-payment-dialog.tsx";
import PurchaseOrderDialog from "./_components/purchase-order-dialog.tsx";
import ConvertToInvoiceDialog from "./_components/convert-to-invoice-dialog.tsx";
import ScanInvoiceDialog from "./_components/scan-invoice-dialog.tsx";
import {
  migrationApiEnabled, createMigrationVendor,
  type MigrationPurchaseOrder, type MigrationPurchaseInvoice, type MigrationApAgingRow,
} from "@/lib/migration-api.ts";
import { useMigrationFinance } from "@/hooks/use-migration-finance.ts";
import { toast } from "sonner";

type PayablesDateFilter = "all" | "today" | "this_month" | "last_30" | "last_90";
type PayablesSort = "name" | "date" | "value_asc" | "value_desc";

function matchesPayablesDate(value: string | undefined, filter: PayablesDateFilter) {
  if (filter === "all" || !value) return filter === "all";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (filter === "today") return value.slice(0, 10) === now.toISOString().slice(0, 10);
  if (filter === "this_month") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  const days = filter === "last_30" ? 30 : 90;
  return date >= new Date(Date.now() - days * 86400000) && date <= now;
}

function comparePayables<T extends { vendorName?: string; name?: string; date?: string; total?: number; totalAmount?: number; balance?: number }>(a: T, b: T, sort: PayablesSort) {
  if (sort === "name") return String(a.vendorName ?? a.name ?? "").localeCompare(String(b.vendorName ?? b.name ?? ""));
  if (sort === "date") return String(b.date ?? "").localeCompare(String(a.date ?? ""));
  const aValue = Number(a.total ?? a.totalAmount ?? a.balance ?? 0);
  const bValue = Number(b.total ?? b.totalAmount ?? b.balance ?? 0);
  return sort === "value_asc" ? aValue - bValue : bValue - aValue;
}

function MigrationPayablesPage() {
  const [tab, setTab] = useState<"orders" | "invoices" | "vendors" | "aging">("orders");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [nameFilter, setNameFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<PayablesDateFilter>("all");
  const [sortBy, setSortBy] = useState<PayablesSort>("date");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState(""); const [category, setCategory] = useState("contractor"); const [phone, setPhone] = useState(""); const [email, setEmail] = useState(""); const [gstin, setGstin] = useState(""); const [pan, setPan] = useState(""); const [address, setAddress] = useState(""); const [bankName, setBankName] = useState(""); const [bankAccount, setBankAccount] = useState(""); const [ifsc, setIfsc] = useState(""); const [notes, setNotes] = useState("");
  const submit = async () => { if (!name.trim()) { toast.error("Vendor name is required"); return; } try { await createMigrationVendor({ name, category, phone, email, gstin, pan, address, bankName, bankAccount, ifsc, notes }); toast.success("Vendor added"); setDialogOpen(false); window.location.reload(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add vendor"); } };

  const vendors = useMigrationFinance<Doc<"vendors">[]>("/api/payables/vendors");
  const purchaseOrders = useMigrationFinance<MigrationPurchaseOrder[]>("/api/purchase-orders");
  const invoices = useMigrationFinance<MigrationPurchaseInvoice[]>("/api/payables/invoices");
  const aging = useMigrationFinance<MigrationApAgingRow[]>("/api/payables/aging");

  const filteredOrders = purchaseOrders?.filter((po) => {
    if (statusFilter !== "all" && po.status !== statusFilter) return false;
    if (nameFilter !== "all" && po.vendorName !== nameFilter) return false;
    if (!matchesPayablesDate(po.date, dateFilter)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return po.poNumber.toLowerCase().includes(q) || po.vendorName.toLowerCase().includes(q);
  }).sort((a, b) => comparePayables(a, b, sortBy));

  const filteredInvoices = invoices?.filter((inv) => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (nameFilter !== "all" && inv.vendorName !== nameFilter) return false;
    if (!matchesPayablesDate(inv.date, dateFilter)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.internalRef.toLowerCase().includes(q) ||
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.vendorName.toLowerCase().includes(q)
    );
  }).sort((a, b) => comparePayables(a, b, sortBy));

  const filteredVendors = vendors?.filter((v) => {
    if (nameFilter !== "all" && v.name !== nameFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return v.name.toLowerCase().includes(q) || (v.gstin ?? "").toLowerCase().includes(q);
  }).sort((a, b) => comparePayables(a, b, sortBy));

  const totalOutstanding = aging?.reduce((s, v) => s + v.total, 0) ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Accounts Payable"
        subtitle="Purchase orders, invoices, vendors, and payment tracking"
        breadcrumbs={[{ label: "Accounts Payable" }]}
        actions={
          <Button size="sm" variant="secondary" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" /> New Vendor
          </Button>
        }
      />

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Outstanding", value: formatCompactInr(totalOutstanding), color: "text-foreground" },
          { label: "Overdue (30d)", value: formatCompactInr(aging?.reduce((s, v) => s + v.days30, 0) ?? 0), color: "text-amber-600 dark:text-amber-400" },
          { label: "Overdue (60d+)", value: formatCompactInr(aging?.reduce((s, v) => s + v.days60 + v.days90 + v.over90, 0) ?? 0), color: "text-red-600 dark:text-red-400" },
          { label: "Active Vendors", value: String(vendors?.filter((v) => v.isActive).length ?? 0), color: "text-primary" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={cn("text-xl font-bold tabular-nums mt-0.5", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setStatusFilter("all"); setNameFilter("all"); setDateFilter("all"); }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
            <TabsTrigger value="aging">AP Aging</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder={tab === "vendors" ? "Search vendors…" : tab === "orders" ? "Search POs…" : "Search invoices…"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 w-52 text-sm"
              />
            </div>
            {(tab === "invoices" || tab === "orders") && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {tab === "orders" ? (
                    <>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="partially_received">Partially Received</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            )}
            <SearchableSelect
              value={nameFilter === "all" ? "" : nameFilter}
              onValueChange={(value) => setNameFilter(value || "all")}
              options={(vendors ?? []).map((vendor) => ({ value: vendor.name, label: vendor.name }))}
              placeholder="All vendors"
              searchPlaceholder="Type vendor name…"
              allowClear
              clearLabel="All vendors"
              size="sm"
              triggerClassName="h-8 w-44 text-xs"
            />
            {tab !== "aging" && (
              <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as PayablesDateFilter)}>
                <SelectTrigger className="h-8 w-32 text-sm"><SelectValue placeholder="All dates" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this_month">This month</SelectItem>
                  <SelectItem value="last_30">Last 30 days</SelectItem>
                  <SelectItem value="last_90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as PayablesSort)}>
              <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name A–Z</SelectItem>
                <SelectItem value="date">Newest date</SelectItem>
                <SelectItem value="value_asc">Value low–high</SelectItem>
                <SelectItem value="value_desc">Value high–low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* PURCHASE ORDERS TAB */}
        <TabsContent value="orders" className="mt-4">
          {filteredOrders === undefined ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filteredOrders.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileText /></EmptyMedia>
                <EmptyTitle>No purchase orders yet</EmptyTitle>
                <EmptyDescription>Purchase orders created in Sravantix will appear here</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase">
                    <th className="px-3 py-2">PO No.</th>
                    <th className="px-3 py-2">Vendor</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Delivery</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOrders.map((po) => (
                    <tr key={po._id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs font-medium">{po.poNumber}</td>
                      <td className="px-3 py-2 font-medium text-sm">{po.vendorName}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(po.date)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-xs font-semibold">{formatCompactInr(po.total)}</td>
                      <td className="px-3 py-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", PO_STATUS_COLORS[po.status])}>
                          {PO_STATUS_LABELS[po.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {po.linkedInvoiceId ? (
                          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle className="size-3" /> Invoiced
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* INVOICES TAB */}
        <TabsContent value="invoices" className="mt-4">
          {filteredInvoices === undefined ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filteredInvoices.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Building2 /></EmptyMedia>
                <EmptyTitle>No invoices found</EmptyTitle>
                <EmptyDescription>Purchase invoices created in Sravantix will appear here</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="px-3 py-2">Ref</th>
                    <th className="px-3 py-2">Vendor</th>
                    <th className="px-3 py-2">Invoice No.</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Due Date</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Outstanding</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv._id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">{inv.internalRef}</td>
                      <td className="px-3 py-2 font-medium">{inv.vendorName}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{inv.invoiceNumber}</td>
                      <td className="px-3 py-2 text-xs">{formatDate(inv.date)}</td>
                      <td className={cn("px-3 py-2 text-xs", inv.dueDate && inv.dueDate < new Date().toISOString().slice(0, 10) && inv.status === "approved" ? "text-red-600 font-medium" : "text-muted-foreground")}>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* VENDORS TAB */}
        <TabsContent value="vendors" className="mt-4">
          {filteredVendors === undefined ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filteredVendors.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Building2 /></EmptyMedia>
                <EmptyTitle>No vendors yet</EmptyTitle>
                <EmptyDescription>Add your first vendor to start tracking payables</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="size-4" /> New Vendor</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card divide-y">
              {filteredVendors.map((vendor) => (
                <div key={vendor._id} className="flex items-center gap-3 px-3 py-3 hover:bg-muted/30">
                  <div className="size-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="size-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{vendor.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {VENDOR_CATEGORY_LABELS[vendor.category] ?? vendor.category}
                      {vendor.gstin && <> · {vendor.gstin}</>}
                      {vendor.phone && <> · {vendor.phone}</>}
                    </p>
                  </div>
                  {!vendor.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  {(vendor.category === "contractor" || vendor.category === "labour") && !vendor.pan && (
                    <Badge className="gap-1 bg-amber-500/15 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="size-3" /> Missing PAN
                    </Badge>
                  )}
                  <Link to={`/payables/vendor/${vendor._id}`}>
                    <Button size="icon" variant="ghost" className="h-7 w-7">
                      <ChevronRight className="size-4" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* AGING TAB */}
        <TabsContent value="aging" className="mt-4">
          {aging === undefined ? (
            <Skeleton className="h-64 w-full" />
          ) : aging.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><CreditCard /></EmptyMedia>
                <EmptyTitle>No outstanding payables</EmptyTitle>
                <EmptyDescription>All invoices are paid or no invoices exist yet</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right text-xs font-medium text-muted-foreground">
                    <th className="px-3 py-2 text-left">Vendor</th>
                    <th className="px-3 py-2">Current</th>
                    <th className="px-3 py-2">1-30 days</th>
                    <th className="px-3 py-2">31-60 days</th>
                    <th className="px-3 py-2">61-90 days</th>
                    <th className="px-3 py-2">90+ days</th>
                    <th className="px-3 py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {aging.map((row) => (
                    <tr key={row.vendorId} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{row.current > 0 ? formatCompactInr(row.current) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-amber-600 dark:text-amber-400">{row.days30 > 0 ? formatCompactInr(row.days30) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-orange-600">{row.days60 > 0 ? formatCompactInr(row.days60) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-red-600">{row.days90 > 0 ? formatCompactInr(row.days90) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-red-700 font-semibold">{row.over90 > 0 ? formatCompactInr(row.over90) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCompactInr(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/20 font-semibold text-sm">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(aging.reduce((s, r) => s + r.current, 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(aging.reduce((s, r) => s + r.days30, 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(aging.reduce((s, r) => s + r.days60, 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(aging.reduce((s, r) => s + r.days90, 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(aging.reduce((s, r) => s + r.over90, 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(totalOutstanding)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg space-y-3 rounded-lg bg-card p-6">
            <h2 className="text-xl font-semibold">New Vendor</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input className="sm:col-span-2" placeholder="Vendor name *" value={name} onChange={(e) => setName(e.target.value)} />
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                {VENDOR_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input placeholder="GSTIN" value={gstin} onChange={(e) => setGstin(e.target.value)} />
              <Input placeholder="PAN" value={pan} onChange={(e) => setPan(e.target.value)} />
              <Input className="sm:col-span-2" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
              <Input placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              <Input placeholder="Bank account number" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
              <Input placeholder="IFSC" value={ifsc} onChange={(e) => setIfsc(e.target.value)} />
            </div>
            <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => void submit()}>Create Vendor</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PayablesPage() {
  if (migrationApiEnabled) return <MigrationPayablesPage />;
  return (
    <Authenticated>
      <PayablesInner />
    </Authenticated>
  );
}

function PayablesInner() {
  const [tab, setTab] = useState<"orders" | "invoices" | "vendors" | "aging">("orders");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [nameFilter, setNameFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<PayablesDateFilter>("all");
  const [sortBy, setSortBy] = useState<PayablesSort>("date");
  const [vendorDialog, setVendorDialog] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Doc<"vendors"> | null>(null);
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const [scanDialog, setScanDialog] = useState(false);
  const [preselectedVendorId, setPreselectedVendorId] = useState<Id<"vendors"> | undefined>();
  const [paymentDialog, setPaymentDialog] = useState<{ invoiceId: Id<"purchaseInvoices">; outstanding: number; vendorName: string } | null>(null);
  const [poDialog, setPoDialog] = useState(false);
  const [editingPo, setEditingPo] = useState<Doc<"purchaseOrders"> | null>(null);
  const [convertDialog, setConvertDialog] = useState<{ poId: Id<"purchaseOrders">; poNumber: string; total: number; vendorName: string } | null>(null);

  const approveInvoice = useMutation(api.vendors.approvePurchaseInvoice);
  const cancelInvoice = useMutation(api.vendors.cancelPurchaseInvoice);
  const deactivateVendor = useMutation(api.vendors.updateVendor);
  const updatePoStatus = useMutation(api.purchaseOrders.updatePurchaseOrderStatus);
  const deletePo = useMutation(api.purchaseOrders.deletePurchaseOrder);

  const invoices = useQuery(api.vendors.listPurchaseInvoices, {
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const vendors = useQuery(api.vendors.listVendors, {});
  const aging = useQuery(api.vendors.getApAgingSummary, {});
  const purchaseOrders = useQuery(api.purchaseOrders.listPurchaseOrders, {
    status: tab === "orders" && statusFilter !== "all" ? statusFilter : undefined,
  });

  const filteredInvoices = invoices?.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (nameFilter !== "all" && i.vendorName !== nameFilter) return false;
    if (!matchesPayablesDate(i.date, dateFilter)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      i.internalRef.toLowerCase().includes(q) ||
      i.invoiceNumber.toLowerCase().includes(q) ||
      i.vendorName.toLowerCase().includes(q)
    );
  }).sort((a, b) => comparePayables(a, b, sortBy));

  const filteredVendors = vendors?.filter((v) => {
    if (nameFilter !== "all" && v.name !== nameFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return v.name.toLowerCase().includes(q) || (v.gstin ?? "").toLowerCase().includes(q);
  }).sort((a, b) => comparePayables(a, b, sortBy));

  const filteredOrders = purchaseOrders?.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (nameFilter !== "all" && o.vendorName !== nameFilter) return false;
    if (!matchesPayablesDate(o.date, dateFilter)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return o.poNumber.toLowerCase().includes(q) || o.vendorName.toLowerCase().includes(q);
  }).sort((a, b) => comparePayables(a, b, sortBy));

  const totalOutstanding = aging?.reduce((s, v) => s + v.total, 0) ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Accounts Payable"
        subtitle="Purchase orders, invoices, vendors, and payment tracking"
        breadcrumbs={[{ label: "Accounts Payable" }]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setEditingVendor(null); setVendorDialog(true); }}>
              <Plus className="size-4" /> New Vendor
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setEditingPo(null); setPoDialog(true); }}>
              <Plus className="size-4" /> New PO
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setScanDialog(true)}>
              <ScanLine className="size-4" /> Scan Invoice
            </Button>
            <Button size="sm" onClick={() => setInvoiceDialog(true)}>
              <Plus className="size-4" /> New Invoice
            </Button>
          </div>
        }
      />

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Outstanding", value: formatCompactInr(totalOutstanding), color: "text-foreground" },
          { label: "Overdue (30d)", value: formatCompactInr(aging?.reduce((s, v) => s + v.days30, 0) ?? 0), color: "text-amber-600 dark:text-amber-400" },
          { label: "Overdue (60d+)", value: formatCompactInr(aging?.reduce((s, v) => s + v.days60 + v.days90 + v.over90, 0) ?? 0), color: "text-red-600 dark:text-red-400" },
          { label: "Active Vendors", value: String(vendors?.filter((v) => v.isActive).length ?? 0), color: "text-primary" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={cn("text-xl font-bold tabular-nums mt-0.5", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setStatusFilter("all"); setNameFilter("all"); setDateFilter("all"); }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
            <TabsTrigger value="aging">AP Aging</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder={tab === "vendors" ? "Search vendors…" : tab === "orders" ? "Search POs…" : "Search invoices…"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 w-52 text-sm"
              />
            </div>
            {(tab === "invoices" || tab === "orders") && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {tab === "orders" ? (
                    <>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="partially_received">Partially Received</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            )}
            <SearchableSelect
              value={nameFilter === "all" ? "" : nameFilter}
              onValueChange={(value) => setNameFilter(value || "all")}
              options={(vendors ?? []).map((vendor) => ({ value: vendor.name, label: vendor.name }))}
              placeholder="All vendors"
              searchPlaceholder="Type vendor name…"
              allowClear
              clearLabel="All vendors"
              size="sm"
              triggerClassName="h-8 w-44 text-xs"
            />
            {tab !== "aging" && (
              <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as PayablesDateFilter)}>
                <SelectTrigger className="h-8 w-32 text-sm"><SelectValue placeholder="All dates" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this_month">This month</SelectItem>
                  <SelectItem value="last_30">Last 30 days</SelectItem>
                  <SelectItem value="last_90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as PayablesSort)}>
              <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name A–Z</SelectItem>
                <SelectItem value="date">Newest date</SelectItem>
                <SelectItem value="value_asc">Value low–high</SelectItem>
                <SelectItem value="value_desc">Value high–low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* PURCHASE ORDERS TAB */}
        <TabsContent value="orders" className="mt-4">
          {filteredOrders === undefined ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filteredOrders.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileText /></EmptyMedia>
                <EmptyTitle>No purchase orders yet</EmptyTitle>
                <EmptyDescription>Create a PO to request goods or services from a vendor</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => { setEditingPo(null); setPoDialog(true); }}><Plus className="size-4" /> New PO</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase">
                    <th className="px-3 py-2">PO No.</th>
                    <th className="px-3 py-2">Vendor</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Delivery</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Invoice</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOrders.map((po) => (
                    <tr key={po._id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs font-medium">{po.poNumber}</td>
                      <td className="px-3 py-2 font-medium text-sm">{po.vendorName}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(po.date)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-xs font-semibold">{formatCompactInr(po.total)}</td>
                      <td className="px-3 py-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", PO_STATUS_COLORS[po.status])}>
                          {PO_STATUS_LABELS[po.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {po.linkedInvoiceId ? (
                          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle className="size-3" /> Invoiced
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {po.status === "draft" && (
                              <>
                                <DropdownMenuItem onClick={() => { setEditingPo(po); setPoDialog(true); }}>
                                  <Pencil className="size-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={async () => {
                                  try { await updatePoStatus({ poId: po._id, status: "sent" }); toast.success("PO marked as sent"); }
                                  catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                                }}>
                                  <ArrowRight className="size-4 mr-2" /> Mark as Sent
                                </DropdownMenuItem>
                              </>
                            )}
                            {po.status === "sent" && (
                              <DropdownMenuItem onClick={async () => {
                                try { await updatePoStatus({ poId: po._id, status: "partially_received" }); toast.success("Marked as partially received"); }
                                catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                              }}>
                                <Truck className="size-4 mr-2" /> Mark Partially Received
                              </DropdownMenuItem>
                            )}
                            {(po.status === "sent" || po.status === "partially_received") && (
                              <DropdownMenuItem onClick={async () => {
                                try { await updatePoStatus({ poId: po._id, status: "received" }); toast.success("PO marked as received"); }
                                catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                              }}>
                                <CheckCircle className="size-4 mr-2 text-green-600" /> Mark as Received
                              </DropdownMenuItem>
                            )}
                            {!po.linkedInvoiceId && po.status !== "cancelled" && (
                              <DropdownMenuItem onClick={() => setConvertDialog({ poId: po._id, poNumber: po.poNumber, total: po.total, vendorName: po.vendorName })}>
                                <FileText className="size-4 mr-2" /> Convert to Invoice
                              </DropdownMenuItem>
                            )}
                            {(po.status === "draft" || po.status === "sent") && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={async () => {
                                  try { await updatePoStatus({ poId: po._id, status: "cancelled" }); toast.success("PO cancelled"); }
                                  catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                                }}>
                                  <XCircle className="size-4 mr-2" /> Cancel PO
                                </DropdownMenuItem>
                              </>
                            )}
                            {(po.status === "draft" || po.status === "cancelled") && (
                              <DropdownMenuItem className="text-destructive" onClick={async () => {
                                try { await deletePo({ poId: po._id }); toast.success("PO deleted"); }
                                catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                              }}>
                                <XCircle className="size-4 mr-2" /> Delete
                              </DropdownMenuItem>
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
        </TabsContent>

        {/* INVOICES TAB */}
        <TabsContent value="invoices" className="mt-4">
          {filteredInvoices === undefined ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filteredInvoices.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Building2 /></EmptyMedia>
                <EmptyTitle>No invoices found</EmptyTitle>
                <EmptyDescription>Create a purchase invoice to get started</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setInvoiceDialog(true)}><Plus className="size-4" /> New Invoice</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="px-3 py-2">Ref</th>
                    <th className="px-3 py-2">Vendor</th>
                    <th className="px-3 py-2">Invoice No.</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Due Date</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Outstanding</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv._id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">{inv.internalRef}</td>
                      <td className="px-3 py-2 font-medium">{inv.vendorName}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{inv.invoiceNumber}</td>
                      <td className="px-3 py-2 text-xs">{formatDate(inv.date)}</td>
                      <td className={cn("px-3 py-2 text-xs", inv.dueDate && inv.dueDate < new Date().toISOString().slice(0, 10) && inv.status === "approved" ? "text-red-600 font-medium" : "text-muted-foreground")}>
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
                                try { await approveInvoice({ invoiceId: inv._id }); toast.success("Invoice approved & journal entry posted"); }
                                catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                              }}>
                                <CheckCircle className="size-4 mr-2 text-green-600" /> Approve & Post JE
                              </DropdownMenuItem>
                            )}
                            {(inv.status === "approved") && inv.outstanding > 0.01 && (
                              <DropdownMenuItem onClick={() => setPaymentDialog({ invoiceId: inv._id, outstanding: inv.outstanding, vendorName: inv.vendorName })}>
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
                                  <XCircle className="size-4 mr-2" /> Cancel Invoice
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
        </TabsContent>

        {/* VENDORS TAB */}
        <TabsContent value="vendors" className="mt-4">
          {filteredVendors === undefined ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filteredVendors.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Building2 /></EmptyMedia>
                <EmptyTitle>No vendors yet</EmptyTitle>
                <EmptyDescription>Add your first vendor to start tracking payables</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => { setEditingVendor(null); setVendorDialog(true); }}><Plus className="size-4" /> New Vendor</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card divide-y">
              {filteredVendors.map((vendor) => (
                <div key={vendor._id} className="flex items-center gap-3 px-3 py-3 hover:bg-muted/30">
                  <div className="size-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="size-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{vendor.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {VENDOR_CATEGORY_LABELS[vendor.category] ?? vendor.category}
                      {vendor.gstin && <> · {vendor.gstin}</>}
                      {vendor.phone && <> · {vendor.phone}</>}
                    </p>
                  </div>
                  {!vendor.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  {(vendor.category === "contractor" || vendor.category === "labour") && !vendor.pan && (
                    <Badge className="gap-1 bg-amber-500/15 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="size-3" /> Missing PAN
                    </Badge>
                  )}
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="text-xs h-7"
                      onClick={() => { setPreselectedVendorId(vendor._id); setPoDialog(true); }}>
                      <Plus className="size-3.5" /> PO
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-7"
                      onClick={() => { setPreselectedVendorId(vendor._id); setInvoiceDialog(true); }}>
                      <Plus className="size-3.5" /> Invoice
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7"
                      onClick={() => { setEditingVendor(vendor); setVendorDialog(true); }}>
                      Edit
                    </Button>
                    <Link to={`/payables/vendor/${vendor._id}`}>
                      <Button size="icon" variant="ghost" className="h-7 w-7">
                        <ChevronRight className="size-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* AGING TAB */}
        <TabsContent value="aging" className="mt-4">
          {aging === undefined ? (
            <Skeleton className="h-64 w-full" />
          ) : aging.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><CreditCard /></EmptyMedia>
                <EmptyTitle>No outstanding payables</EmptyTitle>
                <EmptyDescription>All invoices are paid or no invoices exist yet</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right text-xs font-medium text-muted-foreground">
                    <th className="px-3 py-2 text-left">Vendor</th>
                    <th className="px-3 py-2">Current</th>
                    <th className="px-3 py-2">1-30 days</th>
                    <th className="px-3 py-2">31-60 days</th>
                    <th className="px-3 py-2">61-90 days</th>
                    <th className="px-3 py-2">90+ days</th>
                    <th className="px-3 py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {aging.map((row) => (
                    <tr key={row.vendorId} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{row.current > 0 ? formatCompactInr(row.current) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-amber-600 dark:text-amber-400">{row.days30 > 0 ? formatCompactInr(row.days30) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-orange-600">{row.days60 > 0 ? formatCompactInr(row.days60) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-red-600">{row.days90 > 0 ? formatCompactInr(row.days90) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-red-700 font-semibold">{row.over90 > 0 ? formatCompactInr(row.over90) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCompactInr(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/20 font-semibold text-sm">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(aging.reduce((s, r) => s + r.current, 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(aging.reduce((s, r) => s + r.days30, 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(aging.reduce((s, r) => s + r.days60, 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(aging.reduce((s, r) => s + r.days90, 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(aging.reduce((s, r) => s + r.over90, 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(totalOutstanding)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <VendorFormDialog
        open={vendorDialog}
        onOpenChange={(o) => { setVendorDialog(o); if (!o) setEditingVendor(null); }}
        editing={editingVendor}
      />
      <PurchaseInvoiceDialog
        open={invoiceDialog}
        onOpenChange={(o) => { setInvoiceDialog(o); if (!o) setPreselectedVendorId(undefined); }}
        preselectedVendorId={preselectedVendorId}
      />
      <PurchaseOrderDialog
        open={poDialog}
        onOpenChange={(o) => { setPoDialog(o); if (!o) { setEditingPo(null); setPreselectedVendorId(undefined); } }}
        po={editingPo ?? undefined}
        preselectedVendorId={preselectedVendorId}
      />
      {convertDialog && (
        <ConvertToInvoiceDialog
          open={!!convertDialog}
          onOpenChange={(o) => { if (!o) setConvertDialog(null); }}
          poId={convertDialog.poId}
          poNumber={convertDialog.poNumber}
          total={convertDialog.total}
          vendorName={convertDialog.vendorName}
          onConverted={() => setTab("invoices")}
        />
      )}
      {paymentDialog && (
        <RecordPaymentDialog
          open={!!paymentDialog}
          onOpenChange={(o) => { if (!o) setPaymentDialog(null); }}
          invoiceId={paymentDialog.invoiceId}
          outstanding={paymentDialog.outstanding}
          vendorName={paymentDialog.vendorName}
        />
      )}
      <ScanInvoiceDialog
        open={scanDialog}
        onOpenChange={setScanDialog}
        onCreated={() => setTab("invoices")}
      />
    </div>
  );
}

