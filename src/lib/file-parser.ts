/**
 * Unified file parser — handles CSV, Excel (.xlsx / .xls / .ods), and PDF.
 *
 * For spreadsheet data (buyers, units, leads, invoices):
 *   parseSpreadsheetFile(file) → { rows, parseErrors }
 *   Same row format as parseCsvFile() — header keys lowercased and snake_cased.
 *
 * For bank statement text (CSV / Excel / PDF):
 *   parseBankStatementFile(file) → ParseResult (same as parseBankStatementCSV)
 */

import * as XLSX from "xlsx";
import { parseBankStatementCSV, parseBankStatementRows } from "@/lib/bank-parser.ts";
import type { ParseResult } from "@/lib/bank-parser.ts";

// ── Accepted MIME / extension sets ───────────────────────────────────────────

export const SPREADSHEET_ACCEPT = ".csv,.xlsx,.xls,.ods";
export const BANK_ACCEPT = ".csv,.xlsx,.xls,.ods,.pdf,.txt";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseHeaderKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ── Excel → rows (Record<string,unknown>[]) ──────────────────────────────────

function excelBufToRows(
  buf: ArrayBuffer,
): { rows: Record<string, unknown>[]; parseErrors: string[] } {
  try {
    const data = new Uint8Array(buf);
    const wb = XLSX.read(data, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return { rows: [], parseErrors: ["No sheets found in the file"] };

    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      raw: false, // format everything as strings
    }) as unknown[][];

    if (raw.length < 2) return { rows: [], parseErrors: ["File has no data rows"] };

    // Find the true header row: look for a row whose cells look like column labels
    // (text-heavy, not purely numbers). Skip merged title rows at the top.
    let headerIdx = 0;
    for (let i = 0; i < Math.min(15, raw.length); i++) {
      const row = raw[i] as unknown[];
      const nonEmpty = row.filter((c) => String(c ?? "").trim() !== "");
      // A header row has >= 3 non-empty cells that are mostly non-numeric strings
      const textCells = nonEmpty.filter((c) => isNaN(Number(String(c).replace(/,/g, ""))));
      if (nonEmpty.length >= 3 && textCells.length >= 2) {
        headerIdx = i;
        break;
      }
      // Fallback: at least 2 non-empty cells (original logic)
      if (nonEmpty.length >= 2) {
        headerIdx = i;
        break;
      }
    }

    const headers = (raw[headerIdx] as unknown[]).map((h) =>
      normaliseHeaderKey(String(h ?? "")),
    );

    const rows: Record<string, unknown>[] = [];
    for (let i = headerIdx + 1; i < raw.length; i++) {
      const cols = raw[i] as unknown[];
      // Skip entirely empty rows
      if (cols.every((c) => String(c ?? "").trim() === "")) continue;
      const obj: Record<string, unknown> = {};
      headers.forEach((h, j) => {
        obj[h] = String(cols[j] ?? "").trim();
      });
      rows.push(obj);
    }

    return { rows, parseErrors: [] };
  } catch (e) {
    return {
      rows: [],
      parseErrors: [
        `Could not parse Excel file: ${e instanceof Error ? e.message : String(e)}`,
      ],
    };
  }
}

// ── Excel → raw rows per sheet (for bank statement parsing) ─────────────────

/**
 * Reads every non-empty sheet in the workbook into raw row arrays, keyed by
 * sheet name. Bank statements exported with one tab per month (e.g. an OD
 * statement with "Jan-April-2026", "May-2026", "June-2026", …) would silently
 * lose every month but the first if only the first sheet were read.
 */
function excelBufToRawRowsBySheet(
  buf: ArrayBuffer,
): { sheetName: string; rows: (string | number | Date | undefined)[][] }[] {
  const data = new Uint8Array(buf);
  const wb = XLSX.read(data, { type: "array", cellDates: true, dense: true });
  const result: { sheetName: string; rows: (string | number | Date | undefined)[][] }[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<(string | number | Date | undefined)[]>(ws, {
      header: 1,
      defval: undefined,
      raw: false, // use formatted cell text (e.g. "6,800,000.00") not raw float (e.g. 6.8)
    }) as (string | number | Date | undefined)[][];
    const hasData = rows.some((r) => r.some((c) => String(c ?? "").trim() !== ""));
    if (hasData) result.push({ sheetName, rows });
  }
  return result;
}

// ── PDF → plain text (browser / Vite only — uses pdfjs-dist) ─────────────────

async function pdfBufToText(buf: ArrayBuffer): Promise<string> {
  // Dynamic import to avoid SSR issues; pdfjs-dist is frontend-only
  const pdfjsLib = await import("pdfjs-dist");

  // Point worker to the CDN copy so we don't bundle it
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }

  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Group items by approximate Y position (row) then sort by X (column)
    const byY = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const tx = item as { str: string; transform: number[] };
      const y = Math.round(tx.transform[5]); // vertical position
      const x = Math.round(tx.transform[4]);
      const group = byY.get(y) ?? [];
      group.push({ x, str: tx.str });
      byY.set(y, group);
    }

    // Sort rows top-to-bottom (higher Y = higher on page in PDF coords)
    const sortedYs = [...byY.keys()].sort((a, b) => b - a);
    for (const y of sortedYs) {
      const items = byY.get(y)!.sort((a, b) => a.x - b.x);
      const rowText = items.map((i) => i.str).join(",");
      if (rowText.replace(/,/g, "").trim()) lines.push(rowText);
    }
  }

  return lines.join("\n");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse any spreadsheet file (CSV, XLSX, XLS, ODS) into rows.
 * Header keys are normalised to lowercase snake_case.
 */
export async function parseSpreadsheetFile(
  file: File,
): Promise<{ rows: Record<string, unknown>[]; parseErrors: string[] }> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";

  if (ext === "csv" || ext === "txt") {
    // Use PapaParse via existing helper
    const { parseCsvFile } = await import("@/lib/csv-import.ts");
    return parseCsvFile(file);
  }

  if (ext === "xlsx" || ext === "xls" || ext === "ods") {
    const buf = await file.arrayBuffer();
    return excelBufToRows(buf);
  }

  return { rows: [], parseErrors: [`Unsupported file type: .${ext}`] };
}

/**
 * Parse any bank statement file (CSV, XLSX, XLS, ODS, PDF, TXT) into a ParseResult.
 * Excel workbooks with multiple sheets (e.g. one tab per month) have every
 * non-empty sheet parsed and merged into a single result — so a 12-tab OD
 * statement import doesn't silently drop every month but the first.
 * Also returns rawRows for Excel files so the UI can re-parse with a manual map.
 */
export async function parseBankStatementFile(
  file: File,
): Promise<ParseResult & { rawRows?: (string | number | Date | undefined)[][] }> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";

  if (ext === "pdf") {
    const buf = await file.arrayBuffer();
    const text = await pdfBufToText(buf);
    if (!text.trim()) {
      return {
        transactions: [],
        bankFormat: "Unknown",
        errors: [
          "Could not extract text from PDF. Make sure it is a text-based (not scanned) PDF.",
        ],
      };
    }
    return parseBankStatementCSV(text);
  }

  if (ext === "xlsx" || ext === "xls" || ext === "ods") {
    try {
      const buf = await file.arrayBuffer();
      const sheets = excelBufToRawRowsBySheet(buf);
      if (sheets.length === 0) {
        return {
          transactions: [],
          bankFormat: "Unknown",
          errors: ["No sheets with data found in the file"],
          rawRows: [],
        };
      }

      // Parse every non-empty sheet and merge — most bank exports are single-sheet,
      // but some (e.g. OD statements) have one tab per month.
      const sheetResults = sheets.map((s) => ({
        sheetName: s.sheetName,
        rows: s.rows,
        result: parseBankStatementRows(s.rows),
      }));

      const allTransactions = sheetResults.flatMap((s) => s.result.transactions);
      const errors = sheetResults
        .filter((s) => s.result.transactions.length === 0 && s.result.errors.length > 0)
        .map((s) => `${s.sheetName}: ${s.result.errors[0]}`);

      const dates = allTransactions.map((t) => t.date).sort();
      const firstWithFormat = sheetResults.find((s) => s.result.transactions.length > 0);
      // Opening balance from the earliest-dated sheet, closing from the latest-dated sheet.
      const sortedByFromDate = [...sheetResults]
        .filter((s) => s.result.transactions.length > 0)
        .sort((a, b) => (a.result.fromDate ?? "").localeCompare(b.result.fromDate ?? ""));

      return {
        transactions: allTransactions,
        openingBalance: sortedByFromDate[0]?.result.openingBalance,
        closingBalance: sortedByFromDate[sortedByFromDate.length - 1]?.result.closingBalance,
        fromDate: dates[0],
        toDate: dates[dates.length - 1],
        bankFormat: firstWithFormat?.result.bankFormat ?? "Unknown",
        errors: allTransactions.length === 0 ? errors : [],
        detectedHeaders: firstWithFormat?.result.detectedHeaders ?? sheetResults[0].result.detectedHeaders,
        rawRows: (firstWithFormat ?? sheetResults[0]).rows,
      };
    } catch (e) {
      return {
        transactions: [],
        bankFormat: "Unknown",
        errors: [
          `Could not read Excel file: ${e instanceof Error ? e.message : String(e)}. ` +
          "Try saving as .xlsx and re-uploading.",
        ],
        rawRows: [],
      };
    }
  }

  // CSV / TXT
  const text = await file.text();
  return parseBankStatementCSV(text);
}
