import { useRef, useState } from "react";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Users } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";

type LedgerResult = {
  accountsCreated: number;
  vendorsCreated: number;
  skipped: number;
  unmapped: Array<{ name: string; parent: string }>;
};

type VoucherResult = {
  purchaseInvoicesCreated: number;
  journalEntriesCreated: number;
  skipped: number;
  skippedDetails: Array<{ voucherNumber: string; reason: string }>;
};

function XmlDropZone({
  onFile,
  disabled,
  label,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      toast.error("File must be smaller than 30 MB");
      return;
    }
    onFile(file);
  };

  return (
    <label
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary hover:bg-muted/40",
        disabled && "pointer-events-none opacity-50",
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handle(e.dataTransfer.files[0]);
      }}
    >
      <FileUp className="size-7 text-muted-foreground" />
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">Drop the .xml file here or click to browse — max 30 MB</p>
      </div>
      <input
        ref={ref}
        type="file"
        accept=".xml,text/xml,application/xml"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => handle(e.target.files?.[0])}
        onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
      />
    </label>
  );
}

export default function TallyXmlPanel() {
  const importLedgersFromXmlFile = useAction(api.tallyImport.importLedgersFromXmlFile);
  const importVouchersFromXmlFile = useAction(api.tallyImport.importVouchersFromXmlFile);

  const [ledgerFileName, setLedgerFileName] = useState<string | null>(null);
  const [importingLedgers, setImportingLedgers] = useState(false);
  const [ledgerResult, setLedgerResult] = useState<LedgerResult | null>(null);

  const [voucherFileName, setVoucherFileName] = useState<string | null>(null);
  const [importingVouchers, setImportingVouchers] = useState(false);
  const [voucherResult, setVoucherResult] = useState<VoucherResult | null>(null);

  const handleLedgerFile = async (file: File) => {
    setLedgerFileName(file.name);
    setImportingLedgers(true);
    setLedgerResult(null);
    try {
      const xml = await file.text();
      const result = await importLedgersFromXmlFile({ xml });
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

  const handleVoucherFile = async (file: File) => {
    setVoucherFileName(file.name);
    setImportingVouchers(true);
    setVoucherResult(null);
    try {
      const xml = await file.text();
      const result = await importVouchersFromXmlFile({ xml });
      setVoucherResult(result);
      toast.success(
        `Imported ${result.journalEntriesCreated} journal entries and ${result.purchaseInvoicesCreated} purchase invoices (${result.skipped} skipped)`,
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
      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
        <FileUp className="size-4 shrink-0 mt-0.5 text-primary" />
        <span>
          No live connection to Tally needed. In TallyPrime, export your data as an XML file, then
          upload that file here.
        </span>
      </div>

      {/* Ledgers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4" /> 1. Import Ledgers (Accounts &amp; Vendors)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>In TallyPrime, go to Gateway of Tally → Display More Reports → Accounts Books → List of Ledgers (or Chart of Accounts).</li>
            <li>Press Alt+E (Export) → Current, then press C (Configure).</li>
            <li className="font-medium text-foreground">
              Important: set &quot;File Format&quot; to <span className="underline">XML (Data Interchange)</span> — not the default report XML —
              then Export.
            </li>
            <li>Upload the exported file below.</li>
          </ol>

          {importingLedgers ? (
            <div className="flex items-center gap-3 py-6 justify-center text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Importing {ledgerFileName}…
            </div>
          ) : (
            <XmlDropZone onFile={(f) => void handleLedgerFile(f)} label="Upload Ledgers XML" />
          )}

          {ledgerResult && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="size-4 text-primary" /> Import complete
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{ledgerResult.accountsCreated} accounts created</Badge>
                <Badge variant="secondary">{ledgerResult.vendorsCreated} vendors created</Badge>
                {ledgerResult.skipped > 0 && <Badge variant="secondary">{ledgerResult.skipped} already existed</Badge>}
              </div>
              {ledgerResult.unmapped.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 pt-1">
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                  <span>
                    {ledgerResult.unmapped.length} ledger{ledgerResult.unmapped.length > 1 ? "s" : ""} had an
                    unrecognized group and were filed under Indirect Expenses — review in Chart of Accounts.
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vouchers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileUp className="size-4" /> 2. Import Vouchers (Purchases &amp; Journal Entries)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Import ledgers first (above) so vendors and accounts can be matched.</li>
            <li>In TallyPrime, go to Gateway of Tally (or Alt+G) → Day Book. Set the date range for the period you want to import (Alt+F2).</li>
            <li>Press Alt+E (Export) → Current, then press C (Configure).</li>
            <li className="font-medium text-foreground">
              Important: set &quot;File Format&quot; to <span className="underline">XML (Data Interchange)</span> — not the default report XML —
              then Export.
            </li>
            <li>Upload the exported file below.</li>
          </ol>

          {importingVouchers ? (
            <div className="flex items-center gap-3 py-6 justify-center text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Importing {voucherFileName}…
            </div>
          ) : (
            <XmlDropZone onFile={(f) => void handleVoucherFile(f)} label="Upload Vouchers XML" />
          )}

          {voucherResult && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="size-4 text-primary" /> Import complete
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{voucherResult.journalEntriesCreated} journal entries created</Badge>
                <Badge variant="secondary">{voucherResult.purchaseInvoicesCreated} purchase invoices created</Badge>
                {voucherResult.skipped > 0 && <Badge variant="secondary">{voucherResult.skipped} skipped</Badge>}
              </div>
              {voucherResult.skippedDetails.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-1 pt-1">
                  <p className="font-medium text-foreground">Some vouchers were skipped:</p>
                  <ul className="list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
                    {voucherResult.skippedDetails.slice(0, 20).map((d, i) => (
                      <li key={i}>{d.voucherNumber}: {d.reason}</li>
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
