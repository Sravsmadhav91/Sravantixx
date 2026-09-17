import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { Upload, FileText, AlertCircle, HelpCircle } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { cn } from "@/lib/utils.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { parseBankStatementFile } from "@/lib/file-parser.ts";
import {
  parseBankStatementRows,
  type ParsedTransaction,
} from "@/lib/bank-parser.ts";
import type { ParseResult } from "@/lib/bank-parser.ts";

const BANK_ACCEPT = ".csv,.xlsx,.xls,.ods,.pdf,.txt";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (statementId: Id<"bankStatements">) => void;
};

// ── Manual column mapper ──────────────────────────────────────────────────────

type ColAssignment = {
  date: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
  reference: string;
};

function ManualColumnMapper({
  headers,
  assignment,
  onChange,
}: {
  headers: string[];
  assignment: ColAssignment;
  onChange: (a: ColAssignment) => void;
}) {
  const opts = [{ value: "__none__", label: "— not used —" }, ...headers.map((h) => ({ value: h, label: h }))];

  const field = (
    key: keyof ColAssignment,
    label: string,
    required?: boolean,
    tip?: string,
  ) => (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Label className="text-xs">{label}{required ? " *" : ""}</Label>
        {tip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="size-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>{tip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <Select
        value={assignment[key] || "__none__"}
        onValueChange={(v) => onChange({ ...assignment, [key]: v === "__none__" ? "" : v })}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Select column…" />
        </SelectTrigger>
        <SelectContent>
          {opts.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground">
        Column could not be detected automatically. Map columns manually:
      </p>
      <div className="grid grid-cols-2 gap-2">
        {field("date", "Date", true, "Transaction date column")}
        {field("description", "Description / Narration", true, "Particulars or remarks column")}
        {field("debit", "Debit / Withdrawal", false, "Money going out")}
        {field("credit", "Credit / Deposit", false, "Money coming in")}
        {field("balance", "Balance", false, "Running balance")}
        {field("reference", "Cheque / Ref No.", false, "Optional reference number")}
      </div>
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────

export default function ImportStatementDialog({ open, onOpenChange, onImported }: Props) {
  const importStatement = useMutation(api.banking.importBankStatement);
  const accounts = useQuery(api.accounting.listAccounts, { group: "bank_and_cash" });

  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [loading, setLoading] = useState(false);

  // Manual mapping state (only shown when auto-detect fails)
  const [needsManual, setNeedsManual] = useState(false);
  const [rawRowsCache, setRawRowsCache] = useState<(string | number | Date | undefined)[][] | null>(null);
  const [colAssignment, setColAssignment] = useState<ColAssignment>({
    date: "", description: "", debit: "", credit: "", balance: "", reference: "",
  });

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setParseResult(null);
    setNeedsManual(false);
    setRawRowsCache(null);
    try {
      const result = await parseBankStatementFile(f);
      // Cache raw rows (returned for Excel files) for manual re-parse
      if ("rawRows" in result && result.rawRows) {
        setRawRowsCache(result.rawRows as (string | number | Date | undefined)[][]);
      }
      setParseResult(result);

      // Show manual mapper if parsing produced no transactions
      if (result.transactions.length === 0) {
        setNeedsManual(true);
      } else {
        if (result.openingBalance !== undefined) setOpeningBalance(String(result.openingBalance));
        if (result.closingBalance !== undefined) setClosingBalance(String(result.closingBalance));
      }
    } catch (err) {
      toast.error(err instanceof Error ? `Failed to read file: ${err.message}` : "Failed to read file");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) void handleFile(f);
  }, [handleFile]);

  // Re-parse using manual column assignment
  const handleApplyManualMapping = () => {
    if (!parseResult?.detectedHeaders) return;
    const headers = parseResult.detectedHeaders;
    const indexOf = (val: string) => (val ? headers.indexOf(val) : -1);

    const manualMap = {
      date: indexOf(colAssignment.date),
      description: indexOf(colAssignment.description),
      debit: indexOf(colAssignment.debit),
      credit: indexOf(colAssignment.credit),
      balance: indexOf(colAssignment.balance) >= 0 ? indexOf(colAssignment.balance) : undefined,
      reference: indexOf(colAssignment.reference) >= 0 ? indexOf(colAssignment.reference) : undefined,
    };

    if (manualMap.date < 0 || manualMap.description < 0) {
      toast.error("Date and Description columns are required");
      return;
    }
    if (manualMap.debit < 0 && manualMap.credit < 0) {
      toast.error("At least one of Debit or Credit column is required");
      return;
    }

    if (!rawRowsCache) {
      toast.error("Raw row data not available. Please re-upload the file.");
      return;
    }

    const result = parseBankStatementRows(rawRowsCache, manualMap);
    setParseResult(result);
    setNeedsManual(result.transactions.length === 0);
    if (result.openingBalance !== undefined) setOpeningBalance(String(result.openingBalance));
    if (result.closingBalance !== undefined) setClosingBalance(String(result.closingBalance));
  };

  const handleImport = async () => {
    if (!accountId) { toast.error("Select a bank account"); return; }
    if (!parseResult || parseResult.transactions.length === 0) { toast.error("No transactions to import"); return; }

    const selectedAccount = accounts?.find((a) => a._id === accountId);
    setLoading(true);
    try {
      const { statementId, imported, skippedDuplicates } = await importStatement({
        accountId: accountId as Id<"accounts">,
        accountName: selectedAccount?.name ?? "Bank Account",
        fromDate: parseResult.fromDate ?? "",
        toDate: parseResult.toDate ?? "",
        openingBalance: openingBalance ? parseFloat(openingBalance) : undefined,
        closingBalance: closingBalance ? parseFloat(closingBalance) : undefined,
        bankFormat: parseResult.bankFormat,
        transactions: parseResult.transactions,
      });
      toast.success(
        skippedDuplicates > 0
          ? `Imported ${imported} transactions (${skippedDuplicates} already existed, skipped)`
          : `Imported ${imported} transactions`,
      );
      onImported(statementId);
      onOpenChange(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setParseResult(null);
    setAccountId("");
    setOpeningBalance("");
    setClosingBalance("");
    setNeedsManual(false);
    setRawRowsCache(null);
    setColAssignment({ date: "", description: "", debit: "", credit: "", balance: "", reference: "" });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Bank Statement</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account picker */}
          <div className="space-y-1.5">
            <Label>Bank Account *</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Select bank account…" /></SelectTrigger>
              <SelectContent>
                {accounts?.map((a) => <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* File drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={cn(
              "rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
              file ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50",
            )}
            onClick={() => document.getElementById("stmt-file-input")?.click()}
          >
            <input
              id="stmt-file-input"
              type="file"
              accept={BANK_ACCEPT}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="size-8 text-primary" />
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="size-8" />
                <p className="text-sm font-medium">Drop file here or click to browse</p>
                <p className="text-xs">CSV, Excel (.xlsx/.xls) or PDF — SBI, HDFC, ICICI, Axis, Kotak and other Indian banks</p>
              </div>
            )}
          </div>

          {/* Errors */}
          {parseResult && parseResult.errors.length > 0 && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 space-y-1">
              {parseResult.errors.map((e: string, i: number) => (
                <div key={i} className="flex gap-2 text-xs text-destructive">
                  <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                  <span>{e}</span>
                </div>
              ))}
            </div>
          )}

          {/* Manual column mapper — shown when auto-detect fails or user wants to override */}
          {parseResult?.detectedHeaders && parseResult.detectedHeaders.length > 0 && (
            <details className={needsManual ? "open" : ""}>
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none py-1">
                {needsManual ? "⚠ Column mapping required — expand to map manually" : "Advanced: override column mapping"}
              </summary>
              <div className="mt-2 space-y-3">
                <ManualColumnMapper
                  headers={parseResult.detectedHeaders}
                  assignment={colAssignment}
                  onChange={setColAssignment}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleApplyManualMapping}
                  disabled={!colAssignment.date || !colAssignment.description}
                >
                  Apply mapping & preview
                </Button>
              </div>
            </details>
          )}

          {/* Parse results */}
          {parseResult && parseResult.transactions.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="secondary">{parseResult.bankFormat}</Badge>
                <Badge>{parseResult.transactions.length} transactions</Badge>
                {parseResult.fromDate && (
                  <span className="text-xs text-muted-foreground">
                    {parseResult.fromDate} — {parseResult.toDate}
                  </span>
                )}
              </div>

              {/* Opening / closing balance */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Opening Balance (₹)</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Closing Balance (₹)</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} />
                </div>
              </div>

              {/* Preview table */}
              <div className="rounded-lg border overflow-hidden">
                <div className="bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  Preview (first 5 rows)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="px-2 py-1 text-left">Date</th>
                        <th className="px-2 py-1 text-left">Description</th>
                        <th className="px-2 py-1 text-right">Debit</th>
                        <th className="px-2 py-1 text-right">Credit</th>
                        <th className="px-2 py-1 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parseResult.transactions.slice(0, 5).map((tx: ParsedTransaction, i: number) => (
                        <tr key={i}>
                          <td className="px-2 py-1 tabular-nums whitespace-nowrap">{tx.date}</td>
                          <td className="px-2 py-1 max-w-[160px] truncate">{tx.description}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-red-600">{tx.debit > 0 ? formatCompactInr(tx.debit) : ""}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-green-700">{tx.credit > 0 ? formatCompactInr(tx.credit) : ""}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">{tx.balance ? formatCompactInr(tx.balance) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { onOpenChange(false); reset(); }}>Cancel</Button>
          <Button
            onClick={() => void handleImport()}
            disabled={loading || !parseResult || parseResult.transactions.length === 0 || !accountId}
          >
            {loading ? "Importing…" : `Import ${parseResult?.transactions.length ?? 0} Transactions`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
