import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import {
  parseFlatWiseWorkbook,
  inferPaymentMode,
  type ParsedFlatBlock,
} from "@/lib/flat-receipts-import.ts";
import type { FlatReceiptImportResult } from "@/convex/import.js";

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
        <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx / .xls) — max 20 MB</p>
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

export default function FlatReceiptsImporter() {
  const importFlatReceipts = useMutation(api.import.bulkImportFlatReceipts);

  const [stage, setStage] = useState<Stage>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [flats, setFlats] = useState<ParsedFlatBlock[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<FlatReceiptImportResult | null>(null);

  const reset = () => {
    setStage("idle");
    setFileName(null);
    setFlats([]);
    setWarnings([]);
    setResult(null);
  };

  const totalPayments = flats.reduce((sum, f) => sum + f.payments.length, 0);
  const totalAmount = flats.reduce(
    (sum, f) => sum + f.payments.reduce((s, p) => s + p.amount, 0),
    0,
  );

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setStage("reading");
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseFlatWiseWorkbook(buf);
      if (parsed.flats.length === 0) {
        toast.error("Could not find any \"FLAT No.\" blocks in this file");
        setStage("idle");
        return;
      }
      setFlats(parsed.flats);
      setWarnings(parsed.warnings);
      setStage("preview");
    } catch (err) {
      toast.error(err instanceof Error ? `Could not read file: ${err.message}` : "Could not read file");
      setStage("idle");
    }
  };

  const handleImport = async () => {
    setStage("importing");
    try {
      const rows = flats.flatMap((f) =>
        f.payments.map((p) => ({
          flatNumber: f.flatNumber,
          amount: p.amount,
          paymentDate: p.date,
          referenceNumber: p.reference,
          notes: [inferPaymentMode(p.reference, p.bank), p.bank].filter(Boolean).join(" · ") || undefined,
        })),
      );
      const res = await importFlatReceipts({ rows });
      setResult(res);
      setStage("done");
      toast.success(`Imported ${res.imported} receipts${res.skippedDuplicates > 0 ? ` · ${res.skippedDuplicates} duplicates skipped` : ""}`);
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
          <ReceiptIcon className="size-4" /> Import Receipts by Flat Number
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
          <FileUp className="size-4 shrink-0 mt-0.5 text-primary" />
          <span>
            Upload a &quot;Flat Wise Payment Details&quot; workbook — each flat is a block starting
            with a &quot;FLAT No.&quot; row, followed by its payment rows. We match each flat number
            to an existing unit with an active booking and record the payments as receipts.
            Re-uploading the same file is safe — exact-duplicate payments are skipped.
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
                <p className="text-xs text-muted-foreground">Flats found</p>
                <p className="text-xl font-semibold tabular-nums">{flats.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payments found</p>
                <p className="text-xl font-semibold tabular-nums text-primary">{totalPayments}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total amount</p>
                <p className="text-xl font-semibold tabular-nums">{formatCompactInr(totalAmount)}</p>
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                <ul className="list-disc list-inside space-y-0.5">
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                Flats detected
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="px-3 py-1.5 text-left">Flat No.</th>
                      <th className="px-3 py-1.5 text-left">Buyer (from file)</th>
                      <th className="px-3 py-1.5 text-right">Payments</th>
                      <th className="px-3 py-1.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {flats.map((f, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 font-medium">{f.flatNumber}</td>
                        <td className="px-3 py-1.5">{f.buyerName}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{f.payments.length}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {formatCompactInr(f.payments.reduce((s, p) => s + p.amount, 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Flat numbers are matched to unit numbers in Sravantix. Rows for a flat that doesn&apos;t
              match an existing unit with an active booking will be skipped and listed after import.
            </p>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => void handleImport()}>
                <ReceiptIcon className="size-4" /> Import {totalPayments} receipts
              </Button>
              <Button variant="secondary" onClick={reset}>Cancel</Button>
            </div>
          </div>
        )}

        {stage === "importing" && (
          <div className="flex items-center gap-3 py-6 justify-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Importing receipts…
          </div>
        )}

        {stage === "done" && result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-6">
              <CheckCircle2 className="size-10 text-primary" />
              <p className="text-lg font-semibold">Import complete</p>
              <p className="text-sm text-muted-foreground text-center">
                {result.imported} receipt{result.imported !== 1 ? "s" : ""} imported.
                {result.skippedDuplicates > 0 && ` ${result.skippedDuplicates} duplicate${result.skippedDuplicates !== 1 ? "s" : ""} skipped.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="secondary">{result.imported} imported</Badge>
              {result.skippedDuplicates > 0 && <Badge variant="secondary">{result.skippedDuplicates} duplicates skipped</Badge>}
              {result.unmatchedFlats.length > 0 && <Badge variant="secondary">{result.unmatchedFlats.length} flats unmatched</Badge>}
              {result.ambiguousFlats.length > 0 && <Badge variant="secondary">{result.ambiguousFlats.length} flats ambiguous</Badge>}
            </div>

            {result.unmatchedFlats.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                <span>
                  No matching unit with an active booking for: {result.unmatchedFlats.join(", ")}.
                  Check the flat number matches a unit number in Sravantix and has an active booking.
                </span>
              </div>
            )}

            {result.ambiguousFlats.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                <span>
                  Multiple units share this number across projects, so we skipped them for safety:{" "}
                  {result.ambiguousFlats.join(", ")}.
                </span>
              </div>
            )}

            <Button variant="secondary" onClick={reset} className="w-full">Import another file</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
