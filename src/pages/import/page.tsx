import { useRef, useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  FileText,
  Loader2,
  Users,
  Building2,
  TrendingUp,
  Landmark,
  Receipt,
  ScanLine,
  X,
  Upload,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { useMigrationFinance } from "@/hooks/use-migration-finance.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";

function MigrationImportPage() {
  const tables = useMigrationFinance<string[]>("/api/tables");
  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8"><h1 className="font-serif text-3xl font-semibold">Bulk Import</h1><p className="text-sm text-muted-foreground">Imported data tables available in the PostgreSQL migration store.</p>{tables === undefined ? <Skeleton className="h-32 w-full" /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{tables.map((table) => <div key={table} className="rounded-lg border bg-card p-4 font-medium">{table}</div>)}</div>}</div>;
}
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { cn } from "@/lib/utils.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import {
  parseSpreadsheetFile,
  parseBankStatementFile,
  BANK_ACCEPT,
  SPREADSHEET_ACCEPT,
} from "@/lib/file-parser.ts";
import {
  parseBuyerRow,
  parseUnitRow,
  parseLeadRow,
  parseInvoiceRow,
  validateBuyerRow,
  validateUnitRow,
  validateLeadRow,
  validateInvoiceRow,
  type RowError,
  type BuyerImportRow,
  type UnitImportRow,
  type LeadImportRow,
  type InvoiceImportRow,
} from "@/lib/csv-import.ts";
import {
  ColumnMapper,
  buildAutoMapping,
  applyMapping,
  type FieldDef,
} from "./_components/column-mapper.tsx";
import ScanInvoiceDialog from "../payables/_components/scan-invoice-dialog.tsx";
import TallyConnectionPanel from "./_components/tally-connection-panel.tsx";
import FlatReceiptsImporter from "./_components/flat-receipts-panel.tsx";
import ImsInvoicesImporter from "./_components/ims-invoices-panel.tsx";

// ── Field definitions ──────────────────────────────────────────────────────

const BUYER_FIELDS: FieldDef[] = [
  { key: "name", label: "Full Name", required: true, aliases: ["buyer_name", "customer_name", "fullname", "buyer"] },
  { key: "phone", label: "Phone", required: true, aliases: ["mobile", "contact", "phone_number", "mobile_number", "cell"] },
  { key: "email", label: "Email", required: false, aliases: ["email_address", "mail"] },
  { key: "pan", label: "PAN", required: false, aliases: ["pan_number", "pan_no"], hint: "e.g. ABCDE1234F" },
  { key: "address", label: "Address", required: false, aliases: ["full_address", "addr"] },
  { key: "notes", label: "Notes", required: false, aliases: ["remarks", "comments"] },
];

const UNIT_FIELDS: FieldDef[] = [
  { key: "project_code", label: "Project Code", required: false, aliases: ["project", "code", "proj_code", "project_id", "project_name"], hint: "Leave unmapped if using the default project selector below" },
  { key: "number", label: "Unit / Flat No.", required: true, aliases: ["unit_no", "unit_number", "flat_no", "flat", "unit", "flat_number", "apt_no", "apartment_no", "s_no", "sno", "sr_no", "sr", "sl_no"] },
  { key: "block", label: "Block / Tower", required: false, aliases: ["tower", "wing", "building", "block_tower", "block_no"] },
  { key: "floor", label: "Floor", required: false, aliases: ["floor_no", "floor_number", "level", "floor_level"] },
  { key: "configuration", label: "Configuration", required: false, aliases: ["config", "type", "bhk", "unit_type", "flat_type", "type_of_unit", "category"] },
  { key: "super_built_up_area_sqft", label: "Super Built-Up Area — SBA (sq ft)", required: true, aliases: ["sba", "sba_sqft", "super_area", "super_builtup", "super_built_up", "saleable_area", "gross_area", "s_b_a"] },
  { key: "area_sqft", label: "Built-Up Area (sq ft)", required: false, aliases: ["area", "builtup_area", "built_up_area", "sqft", "built_up", "builtup", "bua", "bua_sqft", "plinth_area"] },
  { key: "carpet_area_sqft", label: "Carpet Area (sq ft)", required: false, aliases: ["carpet", "ca_sqft", "carpet_area", "ca", "net_area"] },
  { key: "balcony_area_sqft", label: "Balcony Area (sq ft)", required: false, aliases: ["balcony", "balcony_sqft", "terrace", "terrace_area"] },
  { key: "undivided_share", label: "UDS (sqft)", required: false, aliases: ["uds", "undivided_share_sqft", "undivided_share", "uds_sqft", "land_share"] },
  { key: "rate_per_sqft", label: "Rate per sqft (₹)", required: true, aliases: ["rate", "price_per_sqft", "cost_per_sqft", "rate_sqft", "basic_rate", "basic_price", "price", "rate_per_sft", "rate_per_sq_ft"] },
  { key: "facing", label: "Facing", required: false, aliases: ["direction", "orientation", "flat_facing"] },
  { key: "notes", label: "Notes", required: false, aliases: ["remarks", "comments", "description"] },
];

const LEAD_FIELDS: FieldDef[] = [
  { key: "name", label: "Full Name", required: true, aliases: ["lead_name", "customer_name", "prospect"] },
  { key: "phone", label: "Phone", required: true, aliases: ["mobile", "contact", "phone_number"] },
  { key: "email", label: "Email", required: false, aliases: ["email_address", "mail"] },
  { key: "source", label: "Source", required: true, aliases: ["lead_source", "channel"], hint: "walk_in · referral · advertisement · website · social_media · other" },
  { key: "status", label: "Status", required: true, aliases: ["lead_status", "stage"], hint: "new · contacted · site_visit · negotiation · won · lost" },
  { key: "budget", label: "Budget (₹)", required: false, aliases: ["budget_amount", "price_range"] },
  { key: "project_interest", label: "Project Interest", required: false, aliases: ["project", "interested_in"] },
  { key: "notes", label: "Notes", required: false, aliases: ["remarks", "comments"] },
];

const INVOICE_FIELDS: FieldDef[] = [
  { key: "vendor_name", label: "Vendor Name", required: true, aliases: ["vendor", "supplier", "party_name"] },
  { key: "invoice_number", label: "Invoice Number", required: true, aliases: ["invoice_no", "inv_no", "bill_no", "bill_number"] },
  { key: "date", label: "Invoice Date", required: true, aliases: ["invoice_date", "bill_date"], hint: "DD-MM-YYYY or YYYY-MM-DD" },
  { key: "due_date", label: "Due Date", required: false, aliases: ["payment_due", "due"], hint: "DD-MM-YYYY or YYYY-MM-DD" },
  { key: "description", label: "Description", required: true, aliases: ["item", "particulars", "narration", "details"] },
  { key: "quantity", label: "Quantity", required: true, aliases: ["qty", "units", "nos"] },
  { key: "rate", label: "Rate (₹)", required: true, aliases: ["unit_price", "unit_rate", "price", "cost"] },
  { key: "gst_rate", label: "GST Rate (%)", required: false, aliases: ["gst%", "gst", "tax_rate"], hint: "e.g. 18 — split 50/50 as CGST/SGST" },
  { key: "tds", label: "TDS Amount (₹)", required: false, aliases: ["tds_amount", "tax_deducted"] },
  { key: "narration", label: "Narration", required: false, aliases: ["notes", "remarks", "memo"] },
];

const BANK_FIELDS: FieldDef[] = [
  { key: "date", label: "Date", required: true, aliases: ["txn_date", "value_date", "transaction_date", "trans_date"] },
  { key: "description", label: "Description / Narration", required: true, aliases: ["narration", "particulars", "details", "remarks", "cheque_details"] },
  { key: "debit", label: "Debit (₹)", required: false, aliases: ["withdrawal", "dr", "debit_amount", "withdrawal_amount", "amount_debit"] },
  { key: "credit", label: "Credit (₹)", required: false, aliases: ["deposit", "cr", "credit_amount", "deposit_amount", "amount_credit"] },
  { key: "amount", label: "Amount (₹, signed)", required: false, aliases: ["txn_amount", "transaction_amount"], hint: "If using a single signed column instead of separate debit/credit" },
  { key: "balance", label: "Balance (₹)", required: false, aliases: ["closing_balance", "bal", "running_balance"] },
  { key: "reference", label: "Reference / Cheque No.", required: false, aliases: ["cheque_no", "ref_no", "utr", "transaction_id"] },
];

// ── Types ──────────────────────────────────────────────────────────────────

type ImportTab = "buyers" | "units" | "leads" | "bank_statement" | "invoices";

type Stage =
  | "idle"
  | "mapping"
  | "validating"
  | "preview"
  | "importing"
  | "done";

type PreviewState = {
  rowErrors: RowError[];
  validCount: number;
  totalCount: number;
};

// ── Drop zone ──────────────────────────────────────────────────────────────

function DropZone({
  onFile,
  disabled,
  accept = ".csv",
  hint,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  accept?: string;
  hint?: string;
}) {
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
        <p className="text-xs text-muted-foreground mt-1">
          {hint ?? "Max 20 MB"}
        </p>
      </div>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => handle(e.target.files?.[0])}
        onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
      />
    </label>
  );
}

// ── Error list ─────────────────────────────────────────────────────────────

function ErrorList({ errors }: { errors: RowError[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? errors : errors.slice(0, 5);
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
      <div className="flex items-center gap-2 text-destructive text-sm font-medium">
        <AlertCircle className="size-4 shrink-0" />
        {errors.length} validation error{errors.length > 1 ? "s" : ""}
      </div>
      <ul className="space-y-1 text-xs text-destructive">
        {visible.map((e, i) => (
          <li key={i}>Row {e.row}, <strong>{e.field}</strong>: {e.message}</li>
        ))}
      </ul>
      {errors.length > 5 && (
        <button className="text-xs text-destructive underline cursor-pointer" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : `Show ${errors.length - 5} more`}
        </button>
      )}
    </div>
  );
}

// ── Step indicator ─────────────────────────────────────────────────────────

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Upload file", "Map columns", "Preview & import"];
  return (
    <div className="flex items-center gap-1 text-xs mb-2">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className={cn(
            "rounded-full size-5 flex items-center justify-center font-semibold text-[10px] shrink-0",
            i + 1 === current
              ? "bg-primary text-primary-foreground"
              : i + 1 < current
              ? "bg-primary/20 text-primary"
              : "bg-muted text-muted-foreground",
          )}>{i + 1}</span>
          <span className={cn(
            "hidden sm:inline",
            i + 1 === current ? "text-foreground font-medium" : "text-muted-foreground",
          )}>{s}</span>
          {i < steps.length - 1 && <ArrowRight className="size-3 text-muted-foreground mx-0.5" />}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BANK STATEMENT IMPORTER
// ═══════════════════════════════════════════════════════════════════════════

function BankStatementImporter() {
  const importStatement = useMutation(api.banking.importBankStatement);
  const accounts = useQuery(api.accounting.listAccounts, { group: "bank_and_cash" });

  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [parseResult, setParseResult] = useState<import("@/lib/bank-parser.ts").ParseResult | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  const reset = () => {
    setFile(null);
    setRawRows([]);
    setFileHeaders([]);
    setMapping({});
    setAccountId("");
    setOpeningBalance("");
    setClosingBalance("");
    setStage("idle");
    setParseResult(null);
    setImportedCount(0);
  };

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setStage("validating");
    try {
      // First try the smart bank parser (handles CSV/Excel/PDF auto-detection)
      const result = await parseBankStatementFile(f);

      if (result.transactions.length > 0 && result.errors.length === 0) {
        setParseResult(result);
        if (result.openingBalance !== undefined) setOpeningBalance(String(result.openingBalance));
        if (result.closingBalance !== undefined) setClosingBalance(String(result.closingBalance));
        setStage("preview");
        return;
      }

      // Bank auto-parse failed / no transactions — fall back to manual column mapping.
      // Use detectedHeaders + rawRows from the smart parser if available (Excel files),
      // otherwise fall back to parseSpreadsheetFile for CSV/TXT files.
      const rawResult = result as typeof result & { rawRows?: (string | number | Date | undefined)[][] };
      if (rawResult.rawRows && rawResult.rawRows.length > 0 && result.detectedHeaders && result.detectedHeaders.length > 0) {
        // Build Record<string, unknown>[] from rawRows using detectedHeaders as keys
        const headers = result.detectedHeaders;
        // Find the header row index by matching detectedHeaders against rawRows
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(30, rawResult.rawRows.length); i++) {
          const rowStrs = rawResult.rawRows[i].map((c) => String(c ?? "").trim());
          if (headers.every((h) => rowStrs.some((s) => s === h))) {
            headerRowIdx = i;
            break;
          }
        }
        const dataRows = rawResult.rawRows.slice(headerRowIdx + 1).map((row) => {
          const rec: Record<string, unknown> = {};
          headers.forEach((h, i) => { rec[h] = row[i]; });
          return rec;
        }).filter((row) => Object.values(row).some((v) => String(v ?? "").trim() !== ""));
        setRawRows(dataRows);
        setFileHeaders(headers);
        setMapping(buildAutoMapping(BANK_FIELDS, headers));
        setStage("mapping");
        return;
      }

      // Final fallback for CSV/TXT: use parseSpreadsheetFile
      const { rows, parseErrors } = await parseSpreadsheetFile(f);
      if (parseErrors.length > 0 || rows.length === 0) {
        toast.error(parseErrors[0] ?? "Could not read file");
        setStage("idle");
        return;
      }
      setRawRows(rows);
      const headers = Object.keys(rows[0] ?? {});
      setFileHeaders(headers);
      setMapping(buildAutoMapping(BANK_FIELDS, headers));
      setStage("mapping");
    } catch (err) {
      toast.error(err instanceof Error ? `Failed to read file: ${err.message}` : "Failed to read file");
      setStage("idle");
    }
  }, []);

  // Called after user confirms column mapping
  const handleApplyMapping = () => {
    // Build transactions from mapped rows
    const txns = rawRows
      .map((row) => {
        const m = applyMapping(row, mapping);
        // Strip commas/₹ before parsing — formatted cells like "6,800,000.00" must be cleaned
        const cleanAmt = (v: unknown) => parseFloat(String(v ?? "0").replace(/[₹,\s]/g, "")) || 0;
        const date = String(m["date"] ?? "").trim();
        const description = String(m["description"] ?? "").trim();
        const debitRaw = cleanAmt(m["debit"]);
        const creditRaw = cleanAmt(m["credit"]);
        const amountRaw = cleanAmt(m["amount"]);
        const balance = parseFloat(String(m["balance"] ?? "").replace(/[₹,\s]/g, "")) || undefined;
        const reference = String(m["reference"] ?? "").trim() || undefined;

        // Handle single signed amount column
        const debit = debitRaw > 0 ? debitRaw : amountRaw < 0 ? Math.abs(amountRaw) : 0;
        const credit = creditRaw > 0 ? creditRaw : amountRaw > 0 ? amountRaw : 0;

        return { date, description, debit, credit, balance, reference };
      })
      .filter((t) => t.date && t.description && (t.debit > 0 || t.credit > 0));

    if (txns.length === 0) {
      toast.error("No valid transactions found with the current mapping");
      return;
    }

    setParseResult({
      transactions: txns,
      bankFormat: "Custom",
      errors: [],
    });
    setStage("preview");
  };

  const handleImport = async () => {
    if (!accountId) { toast.error("Select a bank account"); return; }
    if (!parseResult || parseResult.transactions.length === 0) { toast.error("No transactions to import"); return; }

    const selectedAccount = accounts?.find((a) => a._id === accountId);
    setStage("importing");
    try {
      const { imported, skippedDuplicates } = await importStatement({
        accountId: accountId as Id<"accounts">,
        accountName: selectedAccount?.name ?? "Bank Account",
        fromDate: parseResult.fromDate ?? "",
        toDate: parseResult.toDate ?? "",
        openingBalance: openingBalance ? parseFloat(openingBalance) : undefined,
        closingBalance: closingBalance ? parseFloat(closingBalance) : undefined,
        bankFormat: parseResult.bankFormat,
        transactions: parseResult.transactions,
      });
      setImportedCount(imported);
      setStage("done");
      toast.success(
        skippedDuplicates > 0
          ? `Imported ${imported} transactions (${skippedDuplicates} already existed, skipped)`
          : `Imported ${imported} transactions`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
      setStage("preview");
    }
  };

  return (
    <div className="space-y-6">
      {/* Account select */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Select bank account</CardTitle>
        </CardHeader>
        <CardContent>
          <SearchableSelect
            value={accountId}
            onValueChange={setAccountId}
            options={(accounts ?? []).map((a) => ({ value: a._id, label: a.name }))}
            placeholder="Choose a bank account…"
            searchPlaceholder="Search accounts…"
            triggerClassName="w-full max-w-sm"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Only Bank &amp; Cash accounts shown.{" "}
            <a href="/accounting" className="underline">Add more in Chart of Accounts</a>.
          </p>
        </CardContent>
      </Card>

      {/* File + steps */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Steps current={stage === "idle" ? 1 : stage === "mapping" ? 2 : 3} />
          {stage !== "idle" && stage !== "done" && (
            <Button variant="ghost" size="icon" onClick={reset}>
              <X className="size-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Done */}
          {stage === "done" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2 py-6">
                <CheckCircle2 className="size-10 text-primary" />
                <p className="text-lg font-semibold">Import complete</p>
                <p className="text-sm text-muted-foreground">
                  {importedCount} transaction{importedCount !== 1 ? "s" : ""} imported.{" "}
                  <a href="/banking" className="underline">Reconcile in Banking</a>.
                </p>
              </div>
              <Button variant="secondary" onClick={reset} className="w-full">Import another statement</Button>
            </div>
          )}

          {/* Step 1 — upload */}
          {stage === "idle" && (
            <DropZone
              onFile={(f) => void handleFile(f)}
              accept={BANK_ACCEPT}
              hint="CSV, Excel (.xlsx / .xls), PDF — any bank format · max 20 MB"
            />
          )}

          {/* Parsing */}
          {stage === "validating" && (
            <div className="flex items-center gap-3 py-6 justify-center text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Reading file…
            </div>
          )}

          {/* File badge */}
          {file && stage !== "idle" && stage !== "done" && (
            <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-3">
              <FileText className="size-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          )}

          {/* Step 2 — column mapping */}
          {stage === "mapping" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We couldn't auto-detect the format. Map your file's columns to the required fields below.
              </p>
              <ColumnMapper
                fields={BANK_FIELDS}
                fileHeaders={fileHeaders}
                sampleRows={rawRows.slice(0, 5)}
                mapping={mapping}
                onChange={setMapping}
              />
              <Button
                onClick={handleApplyMapping}
                disabled={!mapping["date"] || !mapping["description"]}
              >
                <ArrowRight className="size-4" /> Continue to Preview
              </Button>
            </div>
          )}

          {/* Step 3 — preview */}
          {stage === "preview" && parseResult && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="secondary">{parseResult.bankFormat}</Badge>
                <Badge>{parseResult.transactions.length} transactions</Badge>
                {parseResult.fromDate && (
                  <span className="text-xs text-muted-foreground">
                    {parseResult.fromDate} — {parseResult.toDate}
                  </span>
                )}
              </div>

              {/* Opening / closing */}
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

              {/* Sample */}
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
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parseResult.transactions.slice(0, 5).map((tx, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1 tabular-nums whitespace-nowrap">{tx.date}</td>
                          <td className="px-2 py-1 max-w-[200px] truncate">{tx.description}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-red-600 dark:text-red-400">{tx.debit > 0 ? formatCompactInr(tx.debit) : ""}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-green-700 dark:text-green-400">{tx.credit > 0 ? formatCompactInr(tx.credit) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <Button onClick={() => void handleImport()} disabled={!accountId}>
                <Upload className="size-4" /> Import {parseResult.transactions.length} transactions
              </Button>
            </div>
          )}

          {stage === "importing" && (
            <div className="flex items-center gap-3 py-6 justify-center text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Importing…
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERIC IMPORTER (buyers / units / leads / invoices)
// ═══════════════════════════════════════════════════════════════════════════

type GenericTab = "buyers" | "units" | "leads" | "invoices";

type GenericConfig = {
  label: string;
  fields: FieldDef[];
  validate: (row: Record<string, unknown>, idx: number) => RowError[];
  parse: (row: Record<string, unknown>) => unknown;
};

const CONFIGS: Record<GenericTab, GenericConfig> = {
  buyers: {
    label: "buyers",
    fields: BUYER_FIELDS,
    validate: validateBuyerRow,
    parse: parseBuyerRow,
  },
  units: {
    label: "units",
    fields: UNIT_FIELDS,
    validate: validateUnitRow,
    parse: parseUnitRow,
  },
  leads: {
    label: "leads",
    fields: LEAD_FIELDS,
    validate: validateLeadRow,
    parse: parseLeadRow,
  },
  invoices: {
    label: "invoices",
    fields: INVOICE_FIELDS,
    validate: validateInvoiceRow,
    parse: parseInvoiceRow,
  },
};

function GenericImporter({ tab, onRedirectToIms }: { tab: GenericTab; onRedirectToIms?: () => void }) {
  const cfg = CONFIGS[tab];

  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [stage, setStage] = useState<Stage>("idle");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [cachedRows, setCachedRows] = useState<unknown[]>([]);
  const [doneResult, setDoneResult] = useState<{ imported: number; skipped: number; extra?: string } | null>(null);
  // For units: default project when file has no project_code column
  const [defaultProjectId, setDefaultProjectId] = useState<string>("");

  const projects = useQuery(api.projects.list, tab === "units" ? {} : "skip");

  const importBuyers = useMutation(api.import.bulkImportBuyers);
  const importUnits = useMutation(api.import.bulkImportUnits);
  const importLeads = useMutation(api.import.bulkImportLeads);
  const importInvoices = useMutation(api.import.bulkImportInvoices);

  const reset = () => {
    setFile(null);
    setRawRows([]);
    setFileHeaders([]);
    setMapping({});
    setStage("idle");
    setPreview(null);
    setCachedRows([]);
    setDoneResult(null);
    setDefaultProjectId("");
  };

  const handleFile = async (f: File) => {
    if (tab === "invoices" && f.name.toLowerCase().match(/\.xlsx?$/)) {
      const { looksLikeImsFile } = await import("@/lib/ims-parser.ts");
      if (await looksLikeImsFile(f)) {
        toast.info("This looks like a GST Portal IMS file — switching to the right importer for it.");
        onRedirectToIms?.();
        return;
      }
    }
    setFile(f);
    setStage("validating");
    const { rows, parseErrors } = await parseSpreadsheetFile(f);
    if (parseErrors.length > 0) {
      toast.error(parseErrors[0]);
      setStage("idle");
      return;
    }
    if (rows.length === 0) {
      toast.error("The file has no data rows");
      setStage("idle");
      return;
    }
    const headers = Object.keys(rows[0] ?? {});
    setRawRows(rows);
    setFileHeaders(headers);
    setMapping(buildAutoMapping(cfg.fields, headers));
    setStage("mapping");
  };

  // For units, project_code is satisfied if mapped OR a default project is selected
  const requiredMapped = cfg.fields
    .filter((f) => f.required)
    .every((f) => {
      if (tab === "units" && f.key === "project_code") {
        return mapping[f.key] || defaultProjectId;
      }
      return mapping[f.key];
    });

  const handleApplyMapping = () => {
    setStage("validating");
    const allErrors: RowError[] = [];
    const parsed: unknown[] = [];

    // Determine the default project code to inject when column is not mapped
    const defaultProject = tab === "units" && !mapping["project_code"] && defaultProjectId
      ? projects?.find((p) => p._id === defaultProjectId)
      : null;

    rawRows.forEach((row, i) => {
      const mapped = applyMapping(row, mapping);
      // Inject default project code when not present in file
      if (tab === "units" && !mapped["project_code"] && defaultProject) {
        mapped["project_code"] = defaultProject.code;
      }
      const errs = cfg.validate(mapped, i);
      allErrors.push(...errs);
      if (errs.length === 0) parsed.push(cfg.parse(mapped));
    });
    setCachedRows(parsed);
    const errorRows = new Set(allErrors.map((e) => e.row));
    const validCount = rawRows.filter((_, i) => !errorRows.has(i + 2)).length;
    setPreview({ rowErrors: allErrors, validCount, totalCount: rawRows.length });
    setStage("preview");
  };

  const handleImport = async () => {
    if (!preview || preview.validCount === 0) return;
    setStage("importing");
    try {
      if (tab === "buyers") {
        const res = await importBuyers({ rows: cachedRows as BuyerImportRow[] });
        setDoneResult({ imported: res.imported, skipped: 0 });
        toast.success(`Imported ${res.imported} buyers`);
      } else if (tab === "units") {
        const res = await importUnits({
          rows: (cachedRows as UnitImportRow[]).map((u) => ({
            ...u,
            block: u.block ?? undefined,
            floor: u.floor ?? undefined,
            configuration: u.configuration ?? undefined,
            areaSqft: u.areaSqft ?? undefined,
            carpetAreaSqft: u.carpetAreaSqft ?? undefined,
            balconyAreaSqft: u.balconyAreaSqft ?? undefined,
            facing: u.facing ?? undefined,
            notes: u.notes ?? undefined,
          })),
        });
        setDoneResult({ imported: res.imported, skipped: res.skipped });
        if (res.imported === 0 && res.skipped > 0) {
          toast.error(`All ${res.skipped} units skipped — project code(s) not found. Make sure the Project Code column matches an existing project's code or name.`);
        } else {
          toast.success(`Imported ${res.imported} units${res.skipped > 0 ? ` · ${res.skipped} skipped (project not found)` : ""}`);
        }
      } else if (tab === "leads") {
        const res = await importLeads({
          rows: (cachedRows as LeadImportRow[]).map((l) => ({
            name: l.name,
            phone: l.phone,
            email: l.email,
            source: l.source as "walk_in" | "referral" | "advertisement" | "website" | "social_media" | "other",
            status: l.status as "new" | "contacted" | "site_visit" | "negotiation" | "won" | "lost",
            budget: l.budget,
            projectInterest: l.projectInterest,
            notes: l.notes,
          })),
        });
        setDoneResult({ imported: res.imported, skipped: 0 });
        toast.success(`Imported ${res.imported} leads`);
      } else {
        const res = await importInvoices({ rows: cachedRows as InvoiceImportRow[] });
        const extra = res.vendorsCreated > 0 ? `${res.vendorsCreated} new vendor${res.vendorsCreated > 1 ? "s" : ""} created.` : undefined;
        setDoneResult({ imported: res.imported, skipped: 0, extra });
        toast.success(`Imported ${res.imported} invoices${extra ? " · " + extra : ""}`);
      }
      setStage("done");
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Import failed — please try again",
      );
      setStage("preview");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Steps current={stage === "idle" ? 1 : stage === "mapping" || stage === "validating" ? 2 : 3} />
        {stage !== "idle" && stage !== "done" && (
          <Button variant="ghost" size="icon" onClick={reset}>
            <X className="size-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Done */}
        {stage === "done" && doneResult && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-6">
              {doneResult.imported === 0 && doneResult.skipped > 0
                ? <AlertCircle className="size-10 text-amber-500" />
                : <CheckCircle2 className="size-10 text-primary" />}
              <p className="text-lg font-semibold">
                {doneResult.imported === 0 && doneResult.skipped > 0 ? "Nothing imported" : "Import complete"}
              </p>
              <p className="text-sm text-muted-foreground text-center">
                {doneResult.imported} {cfg.label} imported.
                {doneResult.skipped > 0 && ` ${doneResult.skipped} skipped.`}
                {doneResult.extra && " " + doneResult.extra}
              </p>
              {tab === "units" && doneResult.imported === 0 && doneResult.skipped > 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 text-center max-w-xs mt-1">
                  All rows were skipped because the project code in your file did not match any existing project.
                  Check that the <strong>Project Code</strong> column exactly matches a project code or name in Sravantix.
                </p>
              )}
            </div>
            <Button variant="secondary" onClick={reset} className="w-full">Import another file</Button>
          </div>
        )}

        {/* Step 1 — upload */}
        {stage === "idle" && (
          <DropZone
            onFile={(f) => void handleFile(f)}
            accept={SPREADSHEET_ACCEPT}
            hint="Any CSV or Excel file (.xlsx / .xls) — any column order or names"
          />
        )}

        {/* File badge */}
        {file && stage !== "idle" && stage !== "done" && (
          <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-3">
            <FileText className="size-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
        )}

        {/* Reading */}
        {stage === "validating" && !rawRows.length && (
          <div className="flex items-center gap-3 py-6 justify-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Reading file…
          </div>
        )}

        {/* Step 2 — column mapping */}
        {stage === "mapping" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your file has <strong>{rawRows.length}</strong> data rows and <strong>{fileHeaders.length}</strong> columns.
              Match each system field to the corresponding column in your file.
            </p>

            {/* Default project selector — shown for units when project_code column is not mapped */}
            {tab === "units" && !mapping["project_code"] && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  No project code column detected
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Select the project these units belong to, or map the Project Code field below if your file has that column.
                </p>
                <SearchableSelect
                  options={(projects ?? []).map((p) => ({ value: p._id, label: `${p.code} — ${p.name}` }))}
                  value={defaultProjectId || "none"}
                  onValueChange={(v) => setDefaultProjectId(v === "none" ? "" : v)}
                  placeholder="Select project…"
                  searchPlaceholder="Search projects…"
                  triggerClassName="w-full max-w-sm"
                />
              </div>
            )}

            <ColumnMapper
              fields={cfg.fields}
              fileHeaders={fileHeaders}
              sampleRows={rawRows.slice(0, 5)}
              mapping={mapping}
              onChange={setMapping}
            />
            <Button onClick={handleApplyMapping} disabled={!requiredMapped}>
              <ArrowRight className="size-4" /> Validate {rawRows.length} rows
            </Button>
          </div>
        )}

        {/* Validating rows */}
        {stage === "validating" && rawRows.length > 0 && (
          <div className="flex items-center gap-3 py-6 justify-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Validating rows…
          </div>
        )}

        {/* Step 3 — preview */}
        {stage === "preview" && preview && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 rounded-lg bg-muted/40 p-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Total rows</p>
                <p className="text-xl font-semibold tabular-nums">{preview.totalCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valid</p>
                <p className="text-xl font-semibold tabular-nums text-primary">{preview.validCount}</p>
              </div>
              {preview.rowErrors.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Errors</p>
                  <p className="text-xl font-semibold tabular-nums text-destructive">{preview.totalCount - preview.validCount}</p>
                </div>
              )}
            </div>

            {preview.rowErrors.length > 0 && <ErrorList errors={preview.rowErrors} />}

            {preview.rowErrors.length > 0 && preview.validCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Only the {preview.validCount} valid rows will be imported.
              </p>
            )}

            {preview.validCount === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-destructive">No valid rows to import. Check the errors above.</p>
                <Button variant="secondary" onClick={() => setStage("mapping")}>
                  ← Back to column mapping
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => void handleImport()}>
                  Import {preview.validCount} {cfg.label}
                </Button>
                <Button variant="secondary" onClick={() => setStage("mapping")}>
                  ← Remap columns
                </Button>
              </div>
            )}
          </div>
        )}

        {stage === "importing" && (
          <div className="flex items-center gap-3 py-6 justify-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Importing {cfg.label}…
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCAN INVOICE (AI)
// ═══════════════════════════════════════════════════════════════════════════

function ScanInvoicePanel() {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
          <ScanLine className="size-7 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">Scan a vendor invoice with AI</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Take a photo or upload a PDF/image of an invoice. AI reads the vendor, amounts, and
            line items so you can review and create it in seconds.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <ScanLine className="size-4" /> Scan an invoice
        </Button>
      </CardContent>
      <ScanInvoiceDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════

type TabId = "buyers" | "units" | "leads" | "bank_statement" | "invoices" | "scan_invoice" | "tally" | "flat_receipts" | "ims_invoices";

type TabDef = {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  group: "accounting" | "crm";
  badge?: string;
};

const TABS: TabDef[] = [
  { id: "scan_invoice", label: "Scan Invoice (AI)", icon: <ScanLine className="size-4" />, group: "accounting" },
  { id: "ims_invoices", label: "GST Portal IMS — Vendor Purchases", icon: <Sparkles className="size-4" />, group: "accounting", badge: "Monthly upload" },
  { id: "tally", label: "Tally Import", icon: <Landmark className="size-4" />, group: "accounting" },
  { id: "bank_statement", label: "Bank Statement", icon: <Landmark className="size-4" />, group: "accounting" },
  { id: "invoices", label: "Purchase Invoices (map columns manually)", icon: <Receipt className="size-4" />, group: "accounting" },
  { id: "buyers", label: "Buyers", icon: <Users className="size-4" />, group: "crm" },
  { id: "units", label: "Units", icon: <Building2 className="size-4" />, group: "crm" },
  { id: "leads", label: "Leads", icon: <TrendingUp className="size-4" />, group: "crm" },
  { id: "flat_receipts", label: "Receipts by Flat No.", icon: <Receipt className="size-4" />, group: "crm" },
];

export default function ImportPage() {
  if (migrationApiEnabled) return <MigrationImportPage />;
  const [tab, setTab] = useState<TabId>("flat_receipts");

  const accountingTabs = TABS.filter((t) => t.group === "accounting");
  const crmTabs = TABS.filter((t) => t.group === "crm");

  const renderTabGroup = (tabs: TabDef[], label: string) => (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">{label}</p>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : t.badge
                  ? "bg-accent text-accent-foreground border border-accent-foreground/20 hover:bg-accent/80"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            {t.icon}
            {t.label}
            {t.badge && (
              <Badge
                variant="secondary"
                className={cn(
                  "ml-1 text-[10px]",
                  tab === t.id ? "bg-primary-foreground/20 text-primary-foreground" : "",
                )}
              >
                {t.badge}
              </Badge>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Bulk Import</h1>
        <p className="text-sm text-muted-foreground">
          Import from any file format — upload your own spreadsheet and map the columns.
        </p>
      </div>

      {/* Tab groups */}
      <div className="space-y-3">
        {renderTabGroup(accountingTabs, "Accounting")}
        {renderTabGroup(crmTabs, "CRM")}
      </div>

      {/* Panel */}
      {tab === "scan_invoice" && <ScanInvoicePanel key="scan_invoice" />}
      {tab === "tally" && <TallyConnectionPanel key="tally" />}
      {tab === "bank_statement" && <BankStatementImporter key="bank_statement" />}
      {tab === "invoices" && <GenericImporter key="invoices" tab="invoices" onRedirectToIms={() => setTab("ims_invoices")} />}
      {tab === "ims_invoices" && <ImsInvoicesImporter key="ims_invoices" />}
      {tab === "buyers" && <GenericImporter key="buyers" tab="buyers" />}
      {tab === "units" && <GenericImporter key="units" tab="units" />}
      {tab === "leads" && <GenericImporter key="leads" tab="leads" />}
      {tab === "flat_receipts" && <FlatReceiptsImporter key="flat_receipts" />}
    </div>
  );
}
