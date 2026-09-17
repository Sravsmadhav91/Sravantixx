import { useMemo, useState } from "react";
import { useMutation, useQuery, Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import Papa from "papaparse";
import {
  Landmark,
  Settings2,
  Plus,
  Download,
  FileCheck2,
  Receipt,
  FileSpreadsheet,
  AlertTriangle,
  Link2,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { useMigrationFinance } from "@/hooks/use-migration-finance.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";

function MigrationTdsPage() {
  const settings = useMigrationFinance<any[]>("/api/tds/settings");
  const deductions = useMigrationFinance<any[]>("/api/tds/deductions");
  const profile = settings?.[0];
  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8"><div><p className="text-sm text-muted-foreground">TDS Filing</p><h1 className="font-serif text-3xl font-semibold">TDS Filing</h1><p className="text-sm text-muted-foreground">Deductee master, challan tracking, and quarterly e-TDS return data (24Q / 26Q / 27Q)</p></div><div className="rounded-lg border bg-card px-4 py-3"><div className="flex items-center gap-3"><Landmark className="size-4 text-muted-foreground" />{profile ? <div className="text-sm"><span className="font-medium">{profile.deductorName ?? "—"}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{profile.tan ?? "TAN not set"}</span></div> : <span className="text-sm text-amber-600"><AlertTriangle className="mr-1 inline size-3.5" />Deductor (TAN) profile not set — required for filing</span>}</div></div><div className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardTitle>TDS settings</CardTitle></CardHeader><CardContent>{profile ? "Configured" : "No TDS settings imported"}</CardContent></Card><Card><CardHeader><CardTitle>Deductions</CardTitle></CardHeader><CardContent>{deductions?.length ?? 0} records available</CardContent></Card><Card><CardHeader><CardTitle>TDS Payable</CardTitle></CardHeader><CardContent>{formatCompactInr((deductions ?? []).filter((item) => !item.challanId).reduce((sum, item) => sum + Number(item.tdsAmount || 0), 0))}</CardContent></Card></div>{deductions === undefined ? <Skeleton className="h-48 w-full" /> : deductions.length === 0 ? <Empty><EmptyHeader><EmptyMedia variant="icon"><Receipt /></EmptyMedia><EmptyTitle>No TDS deductions yet</EmptyTitle><EmptyDescription>Labour payments with TDS will appear here automatically.</EmptyDescription></EmptyHeader></Empty> : <div className="rounded-lg border bg-card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Deductee</th><th className="px-3 py-2">Section</th><th className="px-3 py-2 text-right">Gross</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">TDS Payable</th><th className="px-3 py-2">Source</th></tr></thead><tbody className="divide-y">{deductions.map((item) => <tr key={item._id}><td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(item.date)}</td><td className="px-3 py-2">{item.deducteeName ?? "—"}</td><td className="px-3 py-2">{item.section} <Badge variant="secondary" className="ml-1 text-xs">{item.returnType}</Badge></td><td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(item.grossAmount)}</td><td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{item.rate}%</td><td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCompactInr(item.tdsAmount)}</td><td className="px-3 py-2 text-xs text-muted-foreground">{item.sourceType === "labour_payment" ? "Labour payment" : item.sourceType}</td></tr>)}</tbody></table></div>}</div>;
}
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { SignInButton } from "@/components/ui/signin.tsx";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { useRole } from "@/hooks/use-role.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import TdsSettingsDialog from "./_components/tds-settings-dialog.tsx";
import ManualDeductionDialog from "./_components/manual-deduction-dialog.tsx";
import CreateChallanDialog from "./_components/create-challan-dialog.tsx";
import { RETURN_TYPE_OPTIONS, currentQuarter, recentQuarters } from "./_lib/quarters.ts";

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

export default function TdsFilingPage() {
  if (migrationApiEnabled) return <MigrationTdsPage />;
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="TDS Filing"
        subtitle="Deductee master, challan tracking, and quarterly e-TDS return data (24Q / 26Q / 27Q)"
        breadcrumbs={[{ label: "TDS Filing" }]}
      />
      <AuthLoading>
        <Skeleton className="h-64 w-full" />
      </AuthLoading>
      <Unauthenticated>
        <SignInButton />
      </Unauthenticated>
      <Authenticated>
        <TdsFilingInner />
      </Authenticated>
    </div>
  );
}

function TdsFilingInner() {
  const { isOwner } = useRole();
  const [tab, setTab] = useState<"deductions" | "challans" | "returns">("deductions");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deductionOpen, setDeductionOpen] = useState(false);
  const [challanOpen, setChallanOpen] = useState(false);

  const settings = useQuery(api.tds.getTdsSettings, {});
  const deductions = useQuery(api.tds.listDeductions, {});
  const challans = useQuery(api.tds.listChallans, {});
  const unlinkedInvoices = useQuery(api.tds.listUnlinkedTdsInvoices, {});
  const createFromInvoice = useMutation(api.tds.createDeductionFromPurchaseInvoice);

  const hasProfile = !!settings?.tan;
  const quarterOptions = useMemo(() => recentQuarters(8), []);

  const handleLinkInvoice = async (invoiceId: Id<"purchaseInvoices">) => {
    try {
      await createFromInvoice({ purchaseInvoiceId: invoiceId, section: "194C", rate: 1 });
      toast.success("TDS deduction logged from invoice");
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to link invoice");
      }
    }
  };

  return (
    <>
      {/* Deductor profile bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Landmark className="size-4 text-muted-foreground" />
          {settings === undefined ? (
            <Skeleton className="h-5 w-48" />
          ) : hasProfile ? (
            <div className="text-sm">
              <span className="font-medium">{settings.deductorName ?? "—"}</span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">{settings.tan}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3.5" />
              Deductor (TAN) profile not set — required for filing
            </div>
          )}
        </div>
        {isOwner && (
          <Button size="sm" variant="secondary" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-4" /> Deductor Profile
          </Button>
        )}
      </div>

      {/* Unlinked purchase invoices with TDS */}
      {unlinkedInvoices !== undefined && unlinkedInvoices.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Link2 className="size-3.5" /> {unlinkedInvoices.length} purchase invoice{unlinkedInvoices.length !== 1 ? "s" : ""} with TDS not yet logged
          </p>
          <div className="space-y-1.5">
            {unlinkedInvoices.map((inv) => (
              <div key={inv._id} className="flex items-center justify-between gap-2 text-sm bg-card rounded-md px-3 py-2">
                <span>{inv.internalRef} · {inv.vendorName} · {formatDate(inv.date)}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold">{formatCompactInr(inv.tds)}</span>
                  {isOwner && (
                    <Button size="sm" variant="secondary" onClick={() => handleLinkInvoice(inv._id)}>Log as 194C</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="deductions"><Receipt className="size-3.5" /> Deductions</TabsTrigger>
            <TabsTrigger value="challans"><FileCheck2 className="size-3.5" /> Challans</TabsTrigger>
            <TabsTrigger value="returns"><FileSpreadsheet className="size-3.5" /> Quarterly Returns</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {tab === "deductions" && isOwner && (
              <Button size="sm" onClick={() => setDeductionOpen(true)}>
                <Plus className="size-4" /> Record Deduction
              </Button>
            )}
            {tab === "challans" && isOwner && (
              <Button size="sm" onClick={() => setChallanOpen(true)}>
                <Plus className="size-4" /> Record Challan
              </Button>
            )}
          </div>
        </div>

        {/* DEDUCTIONS TAB */}
        <TabsContent value="deductions" className="mt-4">
          {deductions === undefined ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : deductions.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Receipt /></EmptyMedia>
                <EmptyTitle>No TDS deductions yet</EmptyTitle>
                <EmptyDescription>Deductions from payroll and purchase invoices will appear here, or record one manually.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {isOwner && <Button size="sm" onClick={() => setDeductionOpen(true)}><Plus className="size-4" /> Record Deduction</Button>}
              </EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Deductee</th>
                    <th className="px-3 py-2">Section</th>
                    <th className="px-3 py-2">Return</th>
                    <th className="px-3 py-2 text-right">Gross</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">TDS</th>
                    <th className="px-3 py-2">Challan</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {deductions.map((d) => (
                    <tr key={d._id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(d.date)}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{d.deducteeName}</span>
                        {d.deducteePan && <span className="ml-1.5 font-mono text-xs text-muted-foreground">{d.deducteePan}</span>}
                      </td>
                      <td className="px-3 py-2 text-xs">{d.section}</td>
                      <td className="px-3 py-2"><Badge variant="secondary" className="text-xs">{d.returnType}</Badge></td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{formatCompactInr(d.grossAmount)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{d.rate}%</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold">{formatCompactInr(d.tdsAmount)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {d.challanId ? <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs">Paid</Badge> : <Badge variant="secondary" className="text-xs">Unpaid</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* CHALLANS TAB */}
        <TabsContent value="challans" className="mt-4">
          {challans === undefined ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : challans.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileCheck2 /></EmptyMedia>
                <EmptyTitle>No challans recorded yet</EmptyTitle>
                <EmptyDescription>Group unpaid deductions by quarter and section to record a Form 281 challan payment.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {isOwner && <Button size="sm" onClick={() => setChallanOpen(true)}><Plus className="size-4" /> Record Challan</Button>}
              </EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card divide-y">
              {challans.map((c) => (
                <div key={c._id} className="flex items-center gap-3 px-3 py-2.5">
                  <FileCheck2 className="size-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.internalRef} · {c.section} · {c.quarter}</p>
                    <p className="text-xs text-muted-foreground">
                      Paid {formatDate(c.paymentDate)}{c.challanSerialNumber ? ` · Serial ${c.challanSerialNumber}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatCompactInr(c.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* QUARTERLY RETURNS TAB */}
        <TabsContent value="returns" className="mt-4">
          <QuarterlyReturnsView quarterOptions={quarterOptions} />
        </TabsContent>
      </Tabs>

      <TdsSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} />
      <ManualDeductionDialog open={deductionOpen} onOpenChange={setDeductionOpen} />
      <CreateChallanDialog open={challanOpen} onOpenChange={setChallanOpen} defaultQuarter={currentQuarter()} quarterOptions={quarterOptions} />
    </>
  );
}

function QuarterlyReturnsView({ quarterOptions }: { quarterOptions: string[] }) {
  const [quarter, setQuarter] = useState(currentQuarter());
  const [returnType, setReturnType] = useState<"24Q" | "26Q" | "27Q">("26Q");

  const summary = useQuery(api.tds.getQuarterlyReturnSummary, { quarter, returnType });

  const handleExport = () => {
    if (!summary) return;
    downloadCsv(
      summary.rows.map((r) => ({
        "Deductee Name": r.deducteeName,
        "PAN": r.pan,
        "Section": r.section,
        "Date": r.date,
        "Gross Amount": r.grossAmount,
        "Rate (%)": r.rate,
        "TDS Amount": r.tdsAmount,
        "Challan Ref": r.challanRef ?? "",
        "Certificate Issued": r.certificateIssued ? "Yes" : "No",
      })),
      `${returnType}-${quarter}.csv`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Return Type</label>
          <SearchableSelect
            value={returnType}
            onValueChange={(v) => setReturnType(v as "24Q" | "26Q" | "27Q")}
            options={RETURN_TYPE_OPTIONS.map((r) => ({ value: r.value, label: `${r.label} — ${r.description}` }))}
            placeholder="Select return…"
            searchPlaceholder="Search…"
            className="w-72"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Quarter</label>
          <SearchableSelect
            value={quarter}
            onValueChange={setQuarter}
            options={quarterOptions.map((q) => ({ value: q, label: q }))}
            placeholder="Select quarter…"
            searchPlaceholder="Search…"
            className="w-48"
          />
        </div>
      </div>

      {summary === undefined ? (
        <Skeleton className="h-64 w-full" />
      ) : summary.rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><FileSpreadsheet /></EmptyMedia>
            <EmptyTitle>No {returnType} data for {quarter}</EmptyTitle>
            <EmptyDescription>Deductions matching this return type and quarter will appear here for filing.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Deductees", value: String(summary.deducteeCount) },
              { label: "Total Gross", value: formatCompactInr(summary.totalGross) },
              { label: "Total TDS", value: formatCompactInr(summary.totalTds) },
              { label: "Challans Linked", value: String(summary.challanCount) },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold tabular-nums mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button size="sm" variant="secondary" onClick={handleExport}>
              <Download className="size-4" /> Export {returnType} Data (CSV)
            </Button>
          </div>

          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase">
                  <th className="px-3 py-2">Deductee</th>
                  <th className="px-3 py-2">PAN</th>
                  <th className="px-3 py-2">Section</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Gross</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-right">TDS</th>
                  <th className="px-3 py-2">Challan</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {summary.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{r.deducteeName}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.pan}</td>
                    <td className="px-3 py-2 text-xs">{r.section}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(r.date)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{formatCompactInr(r.grossAmount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{r.rate}%</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold">{formatCompactInr(r.tdsAmount)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.challanRef ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/20 font-semibold text-sm">
                  <td className="px-3 py-2" colSpan={4}>Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(summary.totalGross)}</td>
                  <td />
                  <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(summary.totalTds)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
