import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Landmark,
  Loader2,
  ShieldAlert,
  Users,
  XCircle,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import TallyBridgePanel from "./tally-bridge-panel.tsx";
import TallyXmlPanel from "./tally-xml-panel.tsx";

export default function TallyConnectionPanel() {
  const [method, setMethod] = useState<"xml" | "bridge" | "direct">("xml");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-lg border bg-muted/30 p-1 max-w-xl">
        <button
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
            method === "xml" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setMethod("xml")}
        >
          XML File Import (Recommended)
        </button>
        <button
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
            method === "bridge" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setMethod("bridge")}
        >
          Local Bridge
        </button>
        <button
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
            method === "direct" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setMethod("direct")}
        >
          Direct Connection (Advanced)
        </button>
      </div>

      {method === "xml" ? <TallyXmlPanel /> : method === "bridge" ? <TallyBridgePanel /> : <TallyDirectConnectionPanel />}
    </div>
  );
}

function TallyDirectConnectionPanel() {
  const settings = useQuery(api.tallyImport.getSettings, {});
  const saveGatewayUrl = useMutation(api.tallyImport.saveGatewayUrl);
  const testConnection = useAction(api.tallyImport.testConnection);
  const importLedgers = useAction(api.tallyImport.importLedgers);
  const importVouchers = useAction(api.tallyImport.importVouchers);

  const [gatewayUrl, setGatewayUrl] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [importingLedgers, setImportingLedgers] = useState(false);
  const [ledgerResult, setLedgerResult] = useState<{
    accountsCreated: number;
    vendorsCreated: number;
    skipped: number;
    unmapped: Array<{ name: string; parent: string }>;
  } | null>(null);

  const [fromDate, setFromDate] = useState(() =>
    new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10),
  );
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [importingVouchers, setImportingVouchers] = useState(false);
  const [voucherResult, setVoucherResult] = useState<{
    purchaseInvoicesCreated: number;
    journalEntriesCreated: number;
    skipped: number;
    skippedDetails: Array<{ voucherNumber: string; reason: string }>;
  } | null>(null);

  const url = gatewayUrl ?? settings?.gatewayUrl ?? "";
  const isConnected = settings?.lastTestStatus === "success";

  const handleTest = async () => {
    if (!url.trim()) {
      toast.error("Enter the Tally gateway URL first");
      return;
    }
    setTesting(true);
    try {
      await saveGatewayUrl({ gatewayUrl: url.trim() });
      const result = await testConnection({ gatewayUrl: url.trim() });
      if (result.success) {
        toast.success(
          result.companyName
            ? `Connected — found company "${result.companyName}"`
            : "Connected to Tally",
        );
      } else {
        toast.error(result.error ?? "Could not connect to Tally");
      }
    } catch (err) {
      toast.error(
        err instanceof ConvexError ? (err.data as { message: string }).message : "Connection test failed",
      );
    } finally {
      setTesting(false);
    }
  };

  const handleImportLedgers = async () => {
    setImportingLedgers(true);
    setLedgerResult(null);
    try {
      const result = await importLedgers({});
      setLedgerResult(result);
      toast.success(
        `Imported ${result.accountsCreated} accounts and ${result.vendorsCreated} vendors (${result.skipped} already existed)`,
      );
    } catch (err) {
      toast.error(
        err instanceof ConvexError ? (err.data as { message: string }).message : "Ledger import failed",
      );
    } finally {
      setImportingLedgers(false);
    }
  };

  const handleImportVouchers = async () => {
    if (!fromDate || !toDate) {
      toast.error("Pick a date range first");
      return;
    }
    setImportingVouchers(true);
    setVoucherResult(null);
    try {
      const result = await importVouchers({ fromDate, toDate });
      setVoucherResult(result);
      toast.success(
        `Imported ${result.purchaseInvoicesCreated} purchase invoices and ${result.journalEntriesCreated} journal entries (${result.skipped} skipped)`,
      );
    } catch (err) {
      toast.error(
        err instanceof ConvexError ? (err.data as { message: string }).message : "Voucher import failed",
      );
    } finally {
      setImportingVouchers(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
        <ShieldAlert className="size-4 shrink-0 mt-0.5" />
        <span>
          This requires TallyPrime&apos;s HTTP gateway port (e.g. 9000) to be reachable from the
          internet — you&apos;ll need port forwarding or a static IP/DDNS hostname on your own
          network, set up by you. Anyone with this address could reach your Tally data, since
          Tally has no built-in login for this gateway.
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="size-4" /> Tally Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Gateway URL</Label>
            <Input
              placeholder="http://your-public-ip:9000"
              value={url}
              onChange={(e) => setGatewayUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              In TallyPrime: F1 (Help) → Settings → Connectivity → Client/Server Configuration →
              set &quot;TallyPrime acts as&quot; to Both/Server, Enable ODBC, note the Port.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => void handleTest()} disabled={testing}>
              {testing ? <Loader2 className="size-4 animate-spin" /> : <Landmark className="size-4" />}
              Test Connection
            </Button>
            {settings?.lastTestStatus === "success" && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                <CheckCircle2 className="size-3" /> Connected
                {settings.companyName ? ` — ${settings.companyName}` : ""}
              </Badge>
            )}
            {settings?.lastTestStatus === "failure" && (
              <Badge className="bg-destructive/10 text-destructive">
                <XCircle className="size-3" /> Not connected
              </Badge>
            )}
          </div>
          {settings?.lastTestStatus === "failure" && settings.lastTestError && (
            <p className="text-xs text-destructive">{settings.lastTestError}</p>
          )}
          {settings?.lastTestedAt && (
            <p className="text-xs text-muted-foreground">
              Last tested {new Date(settings.lastTestedAt).toLocaleString("en-IN")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4" /> Chart of Accounts &amp; Vendors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pulls every ledger from Tally. Ledgers under &quot;Sundry Creditors&quot; become
            Vendors here; all ledgers also become Chart of Accounts entries. Existing
            accounts/vendors with the same name are skipped, so this is safe to re-run.
          </p>
          <Button onClick={() => void handleImportLedgers()} disabled={!isConnected || importingLedgers}>
            {importingLedgers ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
            Import Chart of Accounts &amp; Vendors
          </Button>
          {!isConnected && (
            <p className="text-xs text-muted-foreground">Test the connection successfully first.</p>
          )}

          {ledgerResult && (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap gap-4">
                <span>
                  <span className="font-semibold">{ledgerResult.accountsCreated}</span> accounts created
                </span>
                <span>
                  <span className="font-semibold">{ledgerResult.vendorsCreated}</span> vendors created
                </span>
                <span>
                  <span className="font-semibold">{ledgerResult.skipped}</span> already existed
                </span>
              </div>
              {ledgerResult.unmapped.length > 0 && (
                <div className="space-y-1 pt-1 border-t">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="size-3.5" />
                    {ledgerResult.unmapped.length} ledger(s) had an unrecognized group — imported as
                    Indirect Expenses, review and reclassify in Accounting.
                  </div>
                  <ul className="text-xs text-muted-foreground max-h-32 overflow-y-auto space-y-0.5">
                    {ledgerResult.unmapped.map((u, i) => (
                      <li key={i}>
                        {u.name} <span className="opacity-70">({u.parent || "no group"})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4" /> Transactions &amp; Purchase Invoices
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pulls Tally vouchers within the date range below. Purchase vouchers become draft
            Purchase Invoices you can review and approve as usual. Everything else (payments,
            receipts, journals, sales, contra) becomes a posted Journal Entry. Re-running for the
            same range skips vouchers already imported.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            <div className="space-y-1.5">
              <Label className="text-xs">From Date</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To Date</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
          <Button onClick={() => void handleImportVouchers()} disabled={!isConnected || importingVouchers}>
            {importingVouchers ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            Import Transactions
          </Button>
          {!isConnected && (
            <p className="text-xs text-muted-foreground">Test the connection successfully first.</p>
          )}

          {voucherResult && (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap gap-4">
                <span>
                  <span className="font-semibold">{voucherResult.purchaseInvoicesCreated}</span> purchase invoices created
                </span>
                <span>
                  <span className="font-semibold">{voucherResult.journalEntriesCreated}</span> journal entries created
                </span>
                <span>
                  <span className="font-semibold">{voucherResult.skipped}</span> skipped
                </span>
              </div>
              {voucherResult.skippedDetails.length > 0 && (
                <div className="space-y-1 pt-1 border-t">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="size-3.5" />
                    Some vouchers were skipped — review below
                  </div>
                  <ul className="text-xs text-muted-foreground max-h-32 overflow-y-auto space-y-0.5">
                    {voucherResult.skippedDetails.slice(0, 50).map((s, i) => (
                      <li key={i}>
                        {s.voucherNumber} <span className="opacity-70">— {s.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
