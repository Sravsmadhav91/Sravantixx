import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { CheckCircle2, FileUp, Loader2, ReceiptText } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { parseImsFile, type ImsInvoiceRow } from "@/lib/ims-parser.ts";
import type { ImsImportResult } from "@/convex/import.js";

function DropZone({ onFile, disabled }: { onFile: (file: File) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be smaller than 20 MB");
      return;
    }
    onFile(file);
  };

  return (
    <label
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors cursor-pointer",
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
      <FileUp className="size-8 text-muted-foreground" />
      <div>
        <p className="font-medium text-sm">Drop file here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx) — max 20 MB</p>
      </div>
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => handle(e.target.files?.[0])}
        onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
      />
    </label>
  );
}

type Stage = "idle" | "reading" | "preview" | "importing" | "done";

function statusBadgeVariant(status: string): "secondary" | "outline" {
  return status.toLowerCase() === "accepted" ? "secondary" : "outline";
}

export default function ImsInvoicesImporter() {
  const importImsInvoices = useMutation(api.import.bulkImportImsInvoices);

  const [stage, setStage] = useState<Stage>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImsInvoiceRow[]>([]);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [creditNoteCount, setCreditNoteCount] = useState(0);
  const [result, setResult] = useState<ImsImportResult | null>(null);

  const reset = () => {
    setStage("idle");
    setFileName(null);
    setRows([]);
    setInvoiceCount(0);
    setCreditNoteCount(0);
    setResult(null);
  };

  const netTaxable = rows.reduce((s, r) => s + (r.isCreditNote ? -r.taxableValue : r.taxableValue), 0);
  const netTax = rows.reduce(
    (s, r) => s + (r.isCreditNote ? -1 : 1) * (r.integratedTax + r.centralTax + r.stateTax + r.cess),
    0,
  );

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setStage("reading");
    try {
      const parsed = await parseImsFile(file);
      if (parsed.parseErrors.length > 0) {
        toast.error(parsed.parseErrors[0]);
        setStage("idle");
        return;
      }
      if (parsed.rows.length === 0) {
        toast.error("No B2B invoices found in this file");
        setStage("idle");
        return;
      }
      setRows(parsed.rows);
      setInvoiceCount(parsed.invoiceCount);
      setCreditNoteCount(parsed.creditNoteCount);
      setStage("preview");
    } catch (err) {
      toast.error(err instanceof Error ? `Could not read file: ${err.message}` : "Could not read file");
      setStage("idle");
    }
  };

  const handleImport = async () => {
    setStage("importing");
    try {
      const res = await importImsInvoices({
        rows: rows.map((r) => ({
          gstin: r.gstin,
          vendorName: r.vendorName,
          invoiceNumber: r.invoiceNumber,
          invoiceDate: r.invoiceDate,
          taxableValue: r.taxableValue,
          integratedTax: r.integratedTax,
          centralTax: r.centralTax,
          stateTax: r.stateTax,
          cess: r.cess,
          status: r.status,
          isCreditNote: r.isCreditNote,
        })),
      });
      setResult(res);
      setStage("done");
      toast.success(
        `Imported ${res.imported} entries${res.skippedDuplicates > 0 ? ` · ${res.skippedDuplicates} duplicates skipped` : ""}`,
      );
    } catch (err) {
      toast.error(
        err instanceof ConvexError ? (err.data as { message: string }).message : "Import failed — please try again",
      );
      setStage("preview");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ReceiptText className="size-4" /> Import GST Portal IMS / GSTR-2B (Vendor Purchases)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
          <FileUp className="size-4 shrink-0 mt-0.5 text-primary" />
          <span>
            Upload the monthly IMS (Invoice Management System) or GSTR-2B file you download from
            the GST portal. Every B2B invoice becomes a draft purchase invoice here, and every
            credit note (from the B2B-CN or B2B-CDNR sheet) becomes a negative-amount purchase
            invoice — regardless of its portal status (Accepted / Pending / Rejected / No Action
            Taken), which is kept as a note. Vendors are matched or created automatically by
            GSTIN. Re-uploading the same file each month is safe; entries already imported are
            skipped.
          </span>
        </div>

        {stage === "idle" && <DropZone onFile={(f) => void handleFile(f)} />}

        {stage === "reading" && (
          <div className="flex items-center gap-3 py-6 justify-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Reading {fileName}…
          </div>
        )}

        {stage === "preview" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 rounded-lg bg-muted/40 p-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Invoices</p>
                <p className="text-xl font-semibold tabular-nums text-primary">{invoiceCount}</p>
              </div>
              {creditNoteCount > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Credit notes</p>
                  <p className="text-xl font-semibold tabular-nums text-primary">{creditNoteCount}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Net taxable value</p>
                <p className="text-xl font-semibold tabular-nums">{formatCompactInr(netTaxable)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net tax (CGST+SGST+IGST+Cess)</p>
                <p className="text-xl font-semibold tabular-nums">{formatCompactInr(netTax)}</p>
              </div>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                Entries detected — all {rows.length} will be imported
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="px-3 py-1.5 text-left">Vendor</th>
                      <th className="px-3 py-1.5 text-left">Invoice #</th>
                      <th className="px-3 py-1.5 text-left">Date</th>
                      <th className="px-3 py-1.5 text-left">Status</th>
                      <th className="px-3 py-1.5 text-right">Taxable</th>
                      <th className="px-3 py-1.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r, i) => {
                      const sign = r.isCreditNote ? -1 : 1;
                      return (
                        <tr key={i}>
                          <td className="px-3 py-1.5">{r.vendorName}</td>
                          <td className="px-3 py-1.5 font-medium">
                            {r.invoiceNumber}
                            {r.isCreditNote && <Badge variant="outline" className="ml-1.5 text-[10px]">CN</Badge>}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{r.invoiceDate}</td>
                          <td className="px-3 py-1.5">
                            <Badge variant={statusBadgeVariant(r.status)} className="text-[10px]">{r.status}</Badge>
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {formatCompactInr(sign * r.taxableValue)}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {formatCompactInr(sign * (r.taxableValue + r.integratedTax + r.centralTax + r.stateTax + r.cess))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => void handleImport()}>
                <ReceiptText className="size-4" /> Import {rows.length} entries
              </Button>
              <Button variant="secondary" onClick={reset}>Cancel</Button>
            </div>
          </div>
        )}

        {stage === "importing" && (
          <div className="flex items-center gap-3 py-6 justify-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Importing entries…
          </div>
        )}

        {stage === "done" && result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-6">
              <CheckCircle2 className="size-10 text-primary" />
              <p className="text-lg font-semibold">Import complete</p>
              <p className="text-sm text-muted-foreground text-center">
                {result.imported} entr{result.imported !== 1 ? "ies" : "y"} imported as drafts.
                {result.skippedDuplicates > 0 && ` ${result.skippedDuplicates} already imported — skipped.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="secondary">{result.imported} imported</Badge>
              {result.skippedDuplicates > 0 && <Badge variant="secondary">{result.skippedDuplicates} duplicates skipped</Badge>}
              {result.vendorsCreated > 0 && <Badge variant="secondary">{result.vendorsCreated} new vendors</Badge>}
              {result.vendorsMatched > 0 && <Badge variant="secondary">{result.vendorsMatched} matched to existing vendors</Badge>}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Review the imported invoices in <a href="/payables" className="underline">Payables</a> and approve
              them to post to your ledgers.
            </p>

            <Button variant="secondary" onClick={reset} className="w-full">Import another file</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
