import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import Papa from "papaparse";
import {
  FileText,
  Settings2,
  Download,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { getMigrationGstSummary, migrationApiEnabled, type MigrationGstSummary } from "@/lib/migration-api.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";

function MigrationGstPage() {
  const range = currentMonthRange();
  const [fromDate, setFromDate] = useState(range.from);
  const [toDate, setToDate] = useState(range.to);
  const [tab, setTab] = useState<"gstr1" | "gstr3b">("gstr1");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [data, setData] = useState<MigrationGstSummary>();
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setData(undefined);
    getMigrationGstSummary(fromDate, toDate).then(setData).catch((value: unknown) => setError(value instanceof Error ? value : new Error("Could not load GST returns")));
  }, [fromDate, toDate]);

  const profile = data?.settings;
  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
    <div><p className="text-sm text-muted-foreground">GST Returns</p><h1 className="font-serif text-3xl font-semibold">GST Returns</h1><p className="text-sm text-muted-foreground">GSTR-1 outward supplies and GSTR-3B summary return, generated from bookings and purchase invoices</p></div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"><div className="flex items-center gap-3"><Building2 className="size-4 text-muted-foreground" />{profile?.gstin ? <div className="text-sm"><span className="font-medium">{profile.legalName ?? "—"}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{profile.gstin}</span><span className="ml-2 text-xs text-muted-foreground">{profile.stateName} ({profile.stateCode})</span></div> : <span className="text-sm text-amber-600"><AlertTriangle className="mr-1 inline size-3.5" />GST profile not set — tax split defaults to intra-state</span>}</div><Button size="sm" variant="secondary" onClick={() => setSettingsOpen(true)}><Settings2 className="size-4" /> GST Profile</Button></div>
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3"><div className="space-y-0.5"><Label className="text-xs">From</Label><Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-8 w-40" /></div><div className="space-y-0.5"><Label className="text-xs">To</Label><Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-8 w-40" /></div></div>
    {error ? <div className="text-sm text-destructive">{error.message}</div> : <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}><TabsList><TabsTrigger value="gstr1"><FileText className="size-3.5" /> GSTR-1</TabsTrigger><TabsTrigger value="gstr3b"><FileText className="size-3.5" /> GSTR-3B</TabsTrigger></TabsList><TabsContent value="gstr1" className="mt-4">{data ? <MigrationGstr1View data={data.gstr1} fromDate={fromDate} toDate={toDate} /> : <Skeleton className="h-64 w-full" />}</TabsContent><TabsContent value="gstr3b" className="mt-4">{data ? <MigrationGstr3bView data={data.gstr3b} fromDate={fromDate} toDate={toDate} /> : <Skeleton className="h-64 w-full" />}</TabsContent></Tabs>}
    <MigrationGstSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={profile} />
  </div>;
}

function MigrationGstr1View({ data, fromDate, toDate }: { data: MigrationGstSummary["gstr1"]; fromDate: string; toDate: string }) {
  const exportRows = (rows: Record<string, unknown>[], name: string) => downloadCsv(rows as Record<string, string | number>[], `${name}-${fromDate}-to-${toDate}.csv`);
  return <div className="space-y-6"><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[{ label: "Total Invoices", value: String(data.totalInvoices) }, { label: "Taxable Value", value: formatCompactInr(data.totalTaxableValue) }, { label: "Total Tax", value: formatCompactInr(data.totalTax) }, { label: "B2B Invoices", value: String(data.b2b.length) }].map((item) => <div key={item.label} className="rounded-lg border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-0.5 text-xl font-bold tabular-nums">{item.value}</p></div>)}</div>
    <section className="space-y-2"><div className="flex items-center justify-between"><div><h3 className="flex items-center gap-2 text-sm font-semibold">Advances Received <Badge variant="secondary">{data.advancesReceived.length}</Badge></h3><p className="text-xs text-muted-foreground">Table 11A — payments collected this period on bookings whose sale deed is not yet registered.</p></div>{data.advancesReceived.length > 0 && <Button size="sm" variant="secondary" onClick={() => exportRows(data.advancesReceived, "gstr1-advances-received")}><Download className="size-4" /> Export CSV</Button>}</div><div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-2">Buyer</th><th className="px-3 py-2">Place of Supply</th><th className="px-3 py-2 text-right">Amount Received</th><th className="px-3 py-2 text-right">Tax</th></tr></thead><tbody className="divide-y">{data.advancesReceived.map((row) => <tr key={row.bookingId}><td className="px-3 py-2 font-medium">{row.buyerName}</td><td className="px-3 py-2 text-xs text-muted-foreground">{row.placeOfSupply}</td><td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(row.amountReceived)}</td><td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCompactInr(row.igst + row.cgst + row.sgst)}</td></tr>)}</tbody></table></div><div className="grid grid-cols-2 gap-3 rounded-lg border bg-card px-4 py-3 text-sm md:grid-cols-4">{[["Taxable Value", data.advancesReceivedTaxableValue], ["CGST", data.advancesReceivedCgst], ["SGST", data.advancesReceivedSgst], ["IGST", data.advancesReceivedIgst]].map(([label, value]) => <div key={String(label)}><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold tabular-nums">{formatCompactInr(Number(value))}</p></div>)}</div></section>
    <MigrationGstSection title="B2B Invoices" count={data.b2b.length} empty="No B2B (buyer has GSTIN) invoices in this period." onExport={() => exportRows(data.b2b, "gstr1-b2b")} columns={["Invoice", "Buyer", "GSTIN", "Place of Supply", "Taxable Value", "Tax", "Total"]} rows={data.b2b.map((row) => [row.invoiceNumber, row.buyerName, row.buyerGstin, row.placeOfSupply, formatCompactInr(row.taxableValue), formatCompactInr(row.igst + row.cgst + row.sgst), formatCompactInr(row.total)])} />
    <MigrationGstSection title="B2C Large (> ₹2.5L)" count={data.b2cLarge.length} empty="No large B2C invoices in this period." onExport={() => exportRows(data.b2cLarge, "gstr1-b2c-large")} columns={["Invoice", "Buyer", "Place of Supply", "Taxable Value", "Tax", "Total"]} rows={data.b2cLarge.map((row) => [row.invoiceNumber, row.buyerName, row.placeOfSupply, formatCompactInr(row.taxableValue), formatCompactInr(row.igst + row.cgst + row.sgst), formatCompactInr(row.total)])} />
    <section className="space-y-2"><h3 className="text-sm font-semibold">B2C Small (Consolidated)</h3><div className="grid grid-cols-2 gap-3 rounded-lg border bg-card px-4 py-3 text-sm md:grid-cols-4">{[["Taxable Value", data.b2cSmall.taxableValue], ["CGST", data.b2cSmall.cgst], ["SGST", data.b2cSmall.sgst], ["IGST", data.b2cSmall.igst]].map(([label, value]) => <div key={String(label)}><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold tabular-nums">{formatCompactInr(Number(value))}</p></div>)}</div></section>
    <MigrationGstSection title="HSN/SAC Summary" count={data.hsnSummary.length} empty="No taxable supplies to summarize." onExport={() => exportRows(data.hsnSummary, "gstr1-hsn-summary")} columns={["SAC", "Description", "Taxable Value", "CGST", "SGST", "IGST"]} rows={data.hsnSummary.map((row) => [row.sacCode, row.description, formatCompactInr(row.taxableValue), formatCompactInr(row.cgst), formatCompactInr(row.sgst), formatCompactInr(row.igst)])} />
  </div>;
}

function MigrationGstSection({ title, count, empty, columns, rows, onExport }: { title: string; count: number; empty: string; columns: string[]; rows: Array<unknown[]>; onExport: () => void }) {
  return <section className="space-y-2"><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-semibold">{title} <Badge variant="secondary">{count}</Badge></h3>{count > 0 && <Button size="sm" variant="secondary" onClick={onExport}><Download className="size-4" /> Export CSV</Button>}</div>{rows.length === 0 ? <p className="px-1 text-sm text-muted-foreground">{empty}</p> : <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-muted-foreground">{columns.map((column) => <th key={column} className="px-3 py-2">{column}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row, index) => <tr key={index}>{row.map((value, cellIndex) => <td key={cellIndex} className="px-3 py-2 text-xs">{String(value)}</td>)}</tr>)}</tbody></table></div>}</section>;
}

function MigrationGstr3bView({ data, fromDate, toDate }: { data: MigrationGstSummary["gstr3b"]; fromDate: string; toDate: string }) {
  const exportSummary = () => downloadCsv([{ Section: "3.1 Outward Taxable Supplies", "Taxable Value": data.outwardTaxableValue, CGST: data.outwardCgst, SGST: data.outwardSgst, IGST: data.outwardIgst }, { Section: "4 Eligible Input Tax Credit", "Taxable Value": "", CGST: data.itcCgst, SGST: data.itcSgst, IGST: data.itcIgst }, { Section: "Net Tax Payable", "Taxable Value": "", CGST: data.netCgstPayable, SGST: data.netSgstPayable, IGST: data.netIgstPayable }], `gstr3b-summary-${fromDate}-to-${toDate}.csv`);
  const row = (values: Array<[string, number]>) => <div className="grid grid-cols-2 gap-3 rounded-lg border bg-card px-4 py-3 text-sm md:grid-cols-4">{values.map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold tabular-nums">{formatCompactInr(value)}</p></div>)}</div>;
  return <div className="space-y-6"><div className="flex justify-end"><Button size="sm" variant="secondary" onClick={exportSummary}><Download className="size-4" /> Export CSV</Button></div><section className="space-y-2"><h3 className="text-sm font-semibold">3.1 Outward Taxable Supplies</h3>{row([["Taxable Value", data.outwardTaxableValue], ["CGST", data.outwardCgst], ["SGST", data.outwardSgst], ["IGST", data.outwardIgst]])}</section><section className="space-y-2"><h3 className="text-sm font-semibold">4. Eligible Input Tax Credit</h3><p className="px-1 text-xs text-muted-foreground">From {data.itcInvoiceCount} approved/paid purchase invoices with GST in this period.</p>{row([["CGST", data.itcCgst], ["SGST", data.itcSgst], ["IGST", data.itcIgst]])}</section><section className="space-y-2"><h3 className="text-sm font-semibold">Net Tax Payable</h3><div className="rounded-lg border border-primary/30 bg-primary/5">{row([["CGST", data.netCgstPayable], ["SGST", data.netSgstPayable], ["IGST", data.netIgstPayable], ["Total", data.netTaxPayable]])}</div></section></div>;
}
import { SignInButton } from "@/components/ui/signin.tsx";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import { useRole } from "@/hooks/use-role.ts";
import GstSettingsDialog from "./_components/gst-settings-dialog.tsx";
import MigrationGstSettingsDialog from "./_components/migration-gst-settings-dialog.tsx";

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function downloadCsv(rows: Record<string, string | number>[], filename: string) {
  const csv = "\ufeff" + Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GstReturnsPage() {
  if (migrationApiEnabled) return <MigrationGstPage />;
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="GST Returns"
        subtitle="GSTR-1 outward supplies and GSTR-3B summary return, generated from bookings and purchase invoices"
        breadcrumbs={[{ label: "GST Returns" }]}
      />
      <AuthLoading>
        <Skeleton className="h-64 w-full" />
      </AuthLoading>
      <Unauthenticated>
        <SignInButton />
      </Unauthenticated>
      <Authenticated>
        <GstReturnsInner />
      </Authenticated>
    </div>
  );
}

function GstReturnsInner() {
  const { isOwner } = useRole();
  const monthRange = currentMonthRange();
  const [fromDate, setFromDate] = useState(monthRange.from);
  const [toDate, setToDate] = useState(monthRange.to);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<"gstr1" | "gstr3b">("gstr1");

  const settings = useQuery(api.gst.getGstSettings, {});
  const gstr1 = useQuery(api.gst.getGstr1Summary, { fromDate, toDate });
  const gstr3b = useQuery(api.gst.getGstr3bSummary, { fromDate, toDate });

  const hasProfile = !!settings?.gstin;

  return (
    <>
      {/* Company profile bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Building2 className="size-4 text-muted-foreground" />
          {settings === undefined ? (
            <Skeleton className="h-5 w-48" />
          ) : hasProfile ? (
            <div className="text-sm">
              <span className="font-medium">{settings.legalName ?? "—"}</span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">{settings.gstin}</span>
              <span className="ml-2 text-xs text-muted-foreground">{settings.stateName} ({settings.stateCode})</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3.5" />
              GST profile not set — tax split defaults to intra-state
            </div>
          )}
        </div>
        {isOwner && (
          <Button size="sm" variant="secondary" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-4" /> GST Profile
          </Button>
        )}
      </div>

      {/* Period controls */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="space-y-0.5">
          <Label className="text-xs">From</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-40" />
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs">To</Label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-40" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="gstr1"><FileText className="size-3.5" /> GSTR-1</TabsTrigger>
          <TabsTrigger value="gstr3b"><FileText className="size-3.5" /> GSTR-3B</TabsTrigger>
        </TabsList>

        <TabsContent value="gstr1" className="mt-4">
          {gstr1 === undefined ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Gstr1View data={gstr1} fromDate={fromDate} toDate={toDate} />
          )}
        </TabsContent>

        <TabsContent value="gstr3b" className="mt-4">
          {gstr3b === undefined ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Gstr3bView data={gstr3b} fromDate={fromDate} toDate={toDate} />
          )}
        </TabsContent>
      </Tabs>

      <GstSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} />
    </>
  );
}

// ── GSTR-1 view ──────────────────────────────────────────────────────────────

type Gstr1Data = NonNullable<ReturnType<typeof useQuery<typeof api.gst.getGstr1Summary>>>;

function Gstr1View({ data, fromDate, toDate }: { data: Gstr1Data; fromDate: string; toDate: string }) {
  if (data.totalInvoices === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><FileText /></EmptyMedia>
          <EmptyTitle>No taxable activity in this period</EmptyTitle>
          <EmptyDescription>
            Registered sales and advances received on taxable bookings will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const handleExportAdvances = () => {
    downloadCsv(
      data.advancesReceived.map((r) => ({
        "Buyer": r.buyerName,
        "Place of Supply": r.placeOfSupply,
        "Amount Received": r.amountReceived,
        "Taxable Value": r.taxableValue,
        "IGST": r.igst,
        "CGST": r.cgst,
        "SGST": r.sgst,
      })),
      `gstr1-advances-received-${fromDate}-to-${toDate}.csv`,
    );
  };

  const handleExportB2B = () => {
    downloadCsv(
      data.b2b.map((r) => ({
        "Invoice No": r.invoiceNumber,
        "Invoice Date": r.invoiceDate,
        "Buyer": r.buyerName,
        "GSTIN": r.buyerGstin,
        "Place of Supply": r.placeOfSupply,
        "Taxable Value": r.taxableValue,
        "IGST": r.igst,
        "CGST": r.cgst,
        "SGST": r.sgst,
        "Total": r.total,
      })),
      `gstr1-b2b-${fromDate}-to-${toDate}.csv`,
    );
  };

  const handleExportB2cLarge = () => {
    downloadCsv(
      data.b2cLarge.map((r) => ({
        "Invoice No": r.invoiceNumber,
        "Invoice Date": r.invoiceDate,
        "Buyer": r.buyerName,
        "Place of Supply": r.placeOfSupply,
        "Taxable Value": r.taxableValue,
        "IGST": r.igst,
        "CGST": r.cgst,
        "SGST": r.sgst,
        "Total": r.total,
      })),
      `gstr1-b2c-large-${fromDate}-to-${toDate}.csv`,
    );
  };

  const handleExportHsn = () => {
    downloadCsv(
      data.hsnSummary.map((r) => ({
        "SAC Code": r.sacCode,
        "Description": r.description,
        "Taxable Value": r.taxableValue,
        "IGST": r.igst,
        "CGST": r.cgst,
        "SGST": r.sgst,
        "Total": r.total,
      })),
      `gstr1-hsn-summary-${fromDate}-to-${toDate}.csv`,
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Invoices", value: String(data.totalInvoices) },
          { label: "Taxable Value", value: formatCompactInr(data.totalTaxableValue) },
          { label: "Total Tax", value: formatCompactInr(data.totalTax) },
          { label: "B2B Invoices", value: String(data.b2b.length) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table 11A — Advances received (units not yet registered) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Advances Received <Badge variant="secondary">{data.advancesReceived.length}</Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Table 11A — payments collected this period on bookings whose sale deed is not yet registered.
            </p>
          </div>
          {data.advancesReceived.length > 0 && (
            <Button size="sm" variant="secondary" onClick={handleExportAdvances}>
              <Download className="size-4" /> Export CSV
            </Button>
          )}
        </div>
        {data.advancesReceived.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">No advances received in this period.</p>
        ) : (
          <>
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase">
                    <th className="px-3 py-2">Buyer</th>
                    <th className="px-3 py-2">Place of Supply</th>
                    <th className="px-3 py-2 text-right">Amount Received</th>
                    <th className="px-3 py-2 text-right">Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.advancesReceived.map((r) => (
                    <tr key={r.bookingId} className="hover:bg-muted/30">
                      <td className="px-3 py-2 text-sm font-medium">{r.buyerName}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.placeOfSupply}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{formatCompactInr(r.amountReceived)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold">{formatCompactInr(r.igst + r.cgst + r.sgst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Taxable Value</p><p className="font-semibold tabular-nums">{formatCompactInr(data.advancesReceivedTaxableValue)}</p></div>
              <div><p className="text-xs text-muted-foreground">CGST</p><p className="font-semibold tabular-nums">{formatCompactInr(data.advancesReceivedCgst)}</p></div>
              <div><p className="text-xs text-muted-foreground">SGST</p><p className="font-semibold tabular-nums">{formatCompactInr(data.advancesReceivedSgst)}</p></div>
              <div><p className="text-xs text-muted-foreground">IGST</p><p className="font-semibold tabular-nums">{formatCompactInr(data.advancesReceivedIgst)}</p></div>
            </div>
          </>
        )}
      </div>

      {/* B2B table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            B2B Invoices <Badge variant="secondary">{data.b2b.length}</Badge>
          </h3>
          {data.b2b.length > 0 && (
            <Button size="sm" variant="secondary" onClick={handleExportB2B}>
              <Download className="size-4" /> Export CSV
            </Button>
          )}
        </div>
        {data.b2b.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">No B2B (buyer has GSTIN) invoices in this period.</p>
        ) : (
          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase">
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Buyer</th>
                  <th className="px-3 py-2">GSTIN</th>
                  <th className="px-3 py-2">Place of Supply</th>
                  <th className="px-3 py-2 text-right">Taxable Value</th>
                  <th className="px-3 py-2 text-right">Tax</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.b2b.map((r) => (
                  <tr key={r.bookingId} className="hover:bg-muted/30">
                    <td className="px-3 py-2 text-xs">
                      {r.invoiceNumber}
                      <div className="text-muted-foreground">{formatDate(r.invoiceDate)}</div>
                    </td>
                    <td className="px-3 py-2 text-sm font-medium">{r.buyerName}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.buyerGstin}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.placeOfSupply}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{formatCompactInr(r.taxableValue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{formatCompactInr(r.igst + r.cgst + r.sgst)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold">{formatCompactInr(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* B2C Large table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            B2C Large (&gt; ₹2.5L) <Badge variant="secondary">{data.b2cLarge.length}</Badge>
          </h3>
          {data.b2cLarge.length > 0 && (
            <Button size="sm" variant="secondary" onClick={handleExportB2cLarge}>
              <Download className="size-4" /> Export CSV
            </Button>
          )}
        </div>
        {data.b2cLarge.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">No large B2C invoices in this period.</p>
        ) : (
          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase">
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Buyer</th>
                  <th className="px-3 py-2">Place of Supply</th>
                  <th className="px-3 py-2 text-right">Taxable Value</th>
                  <th className="px-3 py-2 text-right">Tax</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.b2cLarge.map((r) => (
                  <tr key={r.bookingId} className="hover:bg-muted/30">
                    <td className="px-3 py-2 text-xs">
                      {r.invoiceNumber}
                      <div className="text-muted-foreground">{formatDate(r.invoiceDate)}</div>
                    </td>
                    <td className="px-3 py-2 text-sm font-medium">{r.buyerName}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.placeOfSupply}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{formatCompactInr(r.taxableValue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{formatCompactInr(r.igst + r.cgst + r.sgst)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold">{formatCompactInr(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* B2C small summary */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">B2C Small (Consolidated)</h3>
        <div className="rounded-lg border bg-card px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><p className="text-xs text-muted-foreground">Taxable Value</p><p className="font-semibold tabular-nums">{formatCompactInr(data.b2cSmallTaxableValue)}</p></div>
          <div><p className="text-xs text-muted-foreground">CGST</p><p className="font-semibold tabular-nums">{formatCompactInr(data.b2cSmallCgst)}</p></div>
          <div><p className="text-xs text-muted-foreground">SGST</p><p className="font-semibold tabular-nums">{formatCompactInr(data.b2cSmallSgst)}</p></div>
          <div><p className="text-xs text-muted-foreground">IGST</p><p className="font-semibold tabular-nums">{formatCompactInr(data.b2cSmallIgst)}</p></div>
        </div>
      </div>

      {/* HSN/SAC summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">HSN/SAC Summary</h3>
          {data.hsnSummary.length > 0 && (
            <Button size="sm" variant="secondary" onClick={handleExportHsn}>
              <Download className="size-4" /> Export CSV
            </Button>
          )}
        </div>
        {data.hsnSummary.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">No taxable supplies to summarize.</p>
        ) : (
          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase">
                  <th className="px-3 py-2">SAC</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Taxable Value</th>
                  <th className="px-3 py-2 text-right">CGST</th>
                  <th className="px-3 py-2 text-right">SGST</th>
                  <th className="px-3 py-2 text-right">IGST</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.hsnSummary.map((r) => (
                  <tr key={r.sacCode}>
                    <td className="px-3 py-2 font-mono text-xs">{r.sacCode}</td>
                    <td className="px-3 py-2 text-sm">{r.description}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{formatCompactInr(r.taxableValue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{formatCompactInr(r.cgst)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{formatCompactInr(r.sgst)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{formatCompactInr(r.igst)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold">{formatCompactInr(r.total)}</td>
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

// ── GSTR-3B view ─────────────────────────────────────────────────────────────

type Gstr3bData = NonNullable<ReturnType<typeof useQuery<typeof api.gst.getGstr3bSummary>>>;

function Gstr3bView({ data, fromDate, toDate }: { data: Gstr3bData; fromDate: string; toDate: string }) {
  const handleExport = () => {
    downloadCsv(
      [
        { Section: "3.1 Outward Taxable Supplies", "Taxable Value": data.outwardTaxableValue, CGST: data.outwardCgst, SGST: data.outwardSgst, IGST: data.outwardIgst },
        { Section: "4 Eligible ITC (from purchase invoices)", "Taxable Value": "", CGST: data.itcCgst, SGST: data.itcSgst, IGST: data.itcIgst },
        { Section: "Net Tax Payable", "Taxable Value": "", CGST: data.netCgstPayable, SGST: data.netSgstPayable, IGST: data.netIgstPayable },
      ],
      `gstr3b-summary-${fromDate}-to-${toDate}.csv`,
    );
  };

  const noActivity = data.outwardTaxableValue === 0 && data.itcCgst === 0 && data.itcSgst === 0 && data.itcIgst === 0;

  if (noActivity) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><FileText /></EmptyMedia>
          <EmptyTitle>No GST activity in this period</EmptyTitle>
          <EmptyDescription>
            Taxable bookings and approved purchase invoices with GST will populate this summary.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" variant="secondary" onClick={handleExport}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {/* 3.1 Outward supplies */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">3.1 Outward Taxable Supplies</h3>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase">
                <th className="px-3 py-2">Taxable Value</th>
                <th className="px-3 py-2 text-right">CGST</th>
                <th className="px-3 py-2 text-right">SGST</th>
                <th className="px-3 py-2 text-right">IGST</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-2 tabular-nums">{formatCompactInr(data.outwardTaxableValue)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(data.outwardCgst)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(data.outwardSgst)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(data.outwardIgst)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. ITC */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">4. Eligible Input Tax Credit</h3>
        <p className="text-xs text-muted-foreground px-1">
          From {data.itcInvoiceCount} approved/paid purchase invoice{data.itcInvoiceCount !== 1 ? "s" : ""} with GST in this period.
        </p>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase">
                <th className="px-3 py-2">CGST</th>
                <th className="px-3 py-2 text-right">SGST</th>
                <th className="px-3 py-2 text-right">IGST</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-2 tabular-nums">{formatCompactInr(data.itcCgst)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(data.itcSgst)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(data.itcIgst)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Net payable */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Net Tax Payable</h3>
        <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase">
                <th className="px-3 py-2">CGST</th>
                <th className="px-3 py-2 text-right">SGST</th>
                <th className="px-3 py-2 text-right">IGST</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-2 font-semibold tabular-nums">{formatCompactInr(data.netCgstPayable)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCompactInr(data.netSgstPayable)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCompactInr(data.netIgstPayable)}</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-primary">{formatCompactInr(data.netTaxPayable)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
