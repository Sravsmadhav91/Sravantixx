import { useState } from "react";
import { CheckCircle2, Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getMigrationTallyCompanies, importMigrationTallyLedgers, importMigrationTallyVouchers, previewMigrationTallyXml } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";

type LedgerImportResult = { accountsCreated: number; openingBalancesApplied: number; vendorsCreated: number; skipped: number; unmapped: Array<{ name: string; parent: string }> };
type VoucherImportResult = { journalEntriesCreated: number; purchaseInvoicesCreated: number; skipped: number; skippedDetails: Array<{ voucherNumber: string; reason: string }> };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

export default function MigrationTallyPanel() {
  const [loading, setLoading] = useState(false);
  const [xml, setXml] = useState<string | null>(null);
  const [companies, setCompanies] = useState<string[]>([]);
  const [company, setCompany] = useState("");
  const [fromDate, setFromDate] = useState(firstOfMonthIso());
  const [toDate, setToDate] = useState(todayIso());
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerResult, setLedgerResult] = useState<LedgerImportResult | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherResult, setVoucherResult] = useState<VoucherImportResult | null>(null);
  const [preview, setPreview] = useState<{ kind: string; records: number; preview: string[] } | null>(null);

  const test = async () => {
    setLoading(true);
    try {
      const response = await getMigrationTallyCompanies();
      setXml(response.xml);
      setCompanies(response.companies);
      setCompany(response.companies[0] || "");
      toast.success(`Connected to Tally gateway${response.companies.length ? ` - ${response.companies.length} companies found` : ""}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not connect to Tally");
    } finally {
      setLoading(false);
    }
  };

  const importLedgers = async () => {
    if (!company) { toast.error("Test the connection and pick a company first"); return; }
    setLedgerLoading(true);
    try {
      const result = await importMigrationTallyLedgers(company);
      setLedgerResult(result);
      toast.success(`Imported ${result.accountsCreated} accounts and ${result.vendorsCreated} vendors from Tally (${result.skipped} already existed)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import ledgers from Tally");
    } finally {
      setLedgerLoading(false);
    }
  };

  const importVouchers = async () => {
    if (!company) { toast.error("Test the connection and pick a company first"); return; }
    if (!fromDate || !toDate) { toast.error("Pick a date range first"); return; }
    setVoucherLoading(true);
    try {
      const result = await importMigrationTallyVouchers(company, fromDate, toDate);
      setVoucherResult(result);
      toast.success(`Imported ${result.journalEntriesCreated} journal entries and ${result.purchaseInvoicesCreated} purchase invoices from Tally (${result.skipped} skipped)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import vouchers from Tally");
    } finally {
      setVoucherLoading(false);
    }
  };

  const upload = async (kind: "ledgers" | "vouchers", file: File) => {
    try {
      const result = await previewMigrationTallyXml(kind, await file.text());
      setPreview(result);
      toast.success(`Read ${result.records} ${kind} records`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read Tally XML");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Landmark className="size-4" /> Tally Integration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Connects directly to TallyPrime through the backend&apos;s local gateway URL (no manual XML export needed). Configure <code>TALLY_URL</code> on the backend, normally <code>http://localhost:9000</code>. Keep TallyPrime open with the company you want to import.
        </p>
        <Button onClick={() => void test()} disabled={loading}>
          {loading ? <><Loader2 className="size-4 animate-spin" />Testing...</> : "Test Tally Connection"}
        </Button>
        {companies.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Tally company</label>
            <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={company} onChange={(event) => setCompany(event.target.value)}>
              {companies.map((name) => <option key={name}>{name}</option>)}
            </select>
          </div>
        )}
        {companies.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm font-medium">Import ledgers</p>
              <p className="text-xs text-muted-foreground">Pulls all ledgers, applies their opening balances, and creates matching accounts/vendors.</p>
              <Button size="sm" onClick={() => void importLedgers()} disabled={ledgerLoading}>
                {ledgerLoading ? <><Loader2 className="size-4 animate-spin" />Importing...</> : "Import Ledgers from Tally"}
              </Button>
              {ledgerResult && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
                  <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="size-4 text-primary" />{ledgerResult.accountsCreated} accounts, {ledgerResult.vendorsCreated} vendors created; {ledgerResult.openingBalancesApplied} opening balances applied ({ledgerResult.skipped} already existed)</div>
                  {ledgerResult.unmapped.length > 0 && <p className="mt-1 text-muted-foreground">{ledgerResult.unmapped.length} ledgers used an unrecognised group and were filed under indirect expenses - review them in Chart of Accounts.</p>}
                </div>
              )}
            </div>
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm font-medium">Import vouchers (Day Book)</p>
              <p className="text-xs text-muted-foreground">Pulls vouchers in the date range and posts them as journal entries. Import ledgers first.</p>
              <div className="flex gap-2">
                <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
              </div>
              <Button size="sm" onClick={() => void importVouchers()} disabled={voucherLoading}>
                {voucherLoading ? <><Loader2 className="size-4 animate-spin" />Importing...</> : "Import Vouchers from Tally"}
              </Button>
              {voucherResult && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
                  <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="size-4 text-primary" />{voucherResult.journalEntriesCreated} journal entries, {voucherResult.purchaseInvoicesCreated} purchase invoices created ({voucherResult.skipped} skipped)</div>
                  {voucherResult.skippedDetails.length > 0 && (
                    <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                      {voucherResult.skippedDetails.slice(0, 10).map((item, index) => <li key={`${item.voucherNumber}-${index}`}>{item.voucherNumber || "(no number)"}: {item.reason}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-xs text-muted-foreground">Advanced: preview from an exported XML file instead</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer flex-col gap-2 rounded-lg border-2 border-dashed p-5 text-center hover:border-primary">
              <span className="text-sm font-medium">Import Ledgers XML</span>
              <span className="text-xs text-muted-foreground">Preview accounts and vendors</span>
              <input type="file" accept=".xml,text/xml,application/xml" className="sr-only" onChange={(event) => event.target.files?.[0] && void upload("ledgers", event.target.files[0])} />
            </label>
            <label className="flex cursor-pointer flex-col gap-2 rounded-lg border-2 border-dashed p-5 text-center hover:border-primary">
              <span className="text-sm font-medium">Import Day Book XML</span>
              <span className="text-xs text-muted-foreground">Preview vouchers</span>
              <input type="file" accept=".xml,text/xml,application/xml" className="sr-only" onChange={(event) => event.target.files?.[0] && void upload("vouchers", event.target.files[0])} />
            </label>
          </div>
          {preview && (
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="size-4 text-primary" />{preview.records} {preview.kind} records detected</div>
              <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">{preview.preview.map((item) => <li key={item}>{item}</li>)}</ul>
              <p className="mt-2 text-xs text-muted-foreground">Preview only - use the direct import buttons above to actually save records.</p>
            </div>
          )}
        </details>
        {xml && (
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">View raw company XML</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{xml.slice(0, 5000)}</pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
