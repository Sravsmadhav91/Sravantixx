/**
 * Parser for GST portal inward-supplies exports (.xlsx) — supports two related
 * formats a taxpayer can download monthly, both listing purchase invoices and
 * credit notes reported by vendors:
 *
 *  - "IMS" (Invoice Management System): sheets "B2B" (invoices) and "B2B-CN"
 *    (credit notes), plus a summary "All other ITC" sheet (ignored).
 *  - "GSTR-2B": sheets "B2B" (invoices) and "B2B-CDNR" (credit/debit notes),
 *    plus summary sheets "ITC Available" / "ITC not available" (ignored).
 *    "B2B-CDNR" holds both credit notes and debit notes distinguished by a
 *    "Note type" column — debit notes are skipped since they represent GST
 *    payable by the vendor, not the taxpayer.
 *
 * Both formats share the same B2B column layout. Every row is imported
 * regardless of its portal status (Accepted/Pending/Rejected/No Action Taken),
 * with the status kept as a note on the imported invoice. Credit notes are
 * imported as negative-amount purchase invoices.
 */
import * as XLSX from "xlsx";

export type ImsInvoiceRow = {
  gstin: string;
  vendorName: string;
  invoiceNumber: string;
  /** ISO yyyy-mm-dd */
  invoiceDate: string;
  taxableValue: number;
  integratedTax: number;
  centralTax: number;
  stateTax: number;
  cess: number;
  status: string;
  /** True for rows sourced from the B2B-CN (credit note) sheet. */
  isCreditNote: boolean;
};

export type ImsParseResult = {
  rows: ImsInvoiceRow[];
  invoiceCount: number;
  creditNoteCount: number;
  parseErrors: string[];
};

function parsePortalDate(raw: unknown): string {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) return `${parsed.y.toString().padStart(4, "0")}-${parsed.m.toString().padStart(2, "0")}-${parsed.d.toString().padStart(2, "0")}`;
  }

  const value = String(raw ?? "").trim();
  const dateMatch = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const isoMatch = value.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return value;
}

function toNumber(raw: unknown): number {
  const n = parseFloat(String(raw ?? "0").replace(/[₹,\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

function findHeaderRowIndex(rows: unknown[][], marker: string): number {
  const needle = marker.toLowerCase();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some((c) => String(c ?? "").trim().toLowerCase().includes(needle))) return i;
  }
  return -1;
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[₹()\[\]{}.,%]/g, "").replace(/\s+/g, " ").trim();
}

function looksLikeHeaderRow(row: unknown[]): boolean {
  const text = row.map((cell) => String(cell ?? "").trim().toLowerCase()).join(" | ");
  const markers = ["gstin", "invoice", "note", "taxable", "integrated tax", "central tax", "status", "date"];
  return markers.filter((marker) => text.includes(marker)).length >= 2;
}

/**
 * Recomputes a sheet's true row/column range by scanning its actual cell keys,
 * ignoring the workbook's stored "!ref" range. GST portal exports sometimes ship
 * a stale "!ref" (e.g. sized for only the first few data rows), which makes
 * XLSX.utils.sheet_to_json silently drop every row/column outside it. Rebuilding
 * the range from the real cells before converting avoids that data loss.
 */
function rowsFromSheet(sheet: XLSX.WorkSheet): unknown[][] {
  let maxRow = -1;
  let maxCol = -1;
  for (const key of Object.keys(sheet)) {
    if (key.startsWith("!")) continue;
    const decoded = XLSX.utils.decode_cell(key);
    if (decoded.r > maxRow) maxRow = decoded.r;
    if (decoded.c > maxCol) maxCol = decoded.c;
  }
  if (maxRow === -1 || maxCol === -1) {
    return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  }
  const fullRange = { s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } };
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", range: fullRange });
}

/**
 * Quick check for whether a file is a GST Portal IMS export, based on its
 * distinctive sheet names, without fully parsing it. Used to redirect users
 * who drop the file into the wrong importer tab.
 */
export async function looksLikeImsFile(file: File): Promise<boolean> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (ext !== "xlsx" && ext !== "xls") return false;
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: "array", bookSheets: true });
    const names = wb.SheetNames.map((n) => n.trim().toLowerCase());
    return (
      names.includes("b2b") &&
      (names.includes("b2b-cn") || names.includes("all other itc") || names.includes("b2b-cdnr"))
    );
  } catch {
    return false;
  }
}

/** Parses a single B2B or B2B-CN style sheet into a flat array of rows. */
function parseB2bLikeSheet(
  sheet: XLSX.WorkSheet,
  opts: {
    docNumberNeedles: string[];
    docDateNeedles: string[];
    isCreditNote: boolean;
    /** Skip rows whose "Note type" column says "Debit Note" (GSTR-2B's B2B-CDNR sheet mixes both). */
    skipDebitNotes?: boolean;
  },
): ImsInvoiceRow[] {
  const raw = rowsFromSheet(sheet);

  const headerRowIdx = findHeaderRowIndex(raw, "GSTIN of supplier");
  if (headerRowIdx === -1) return [];

  // The portal splits column labels across two stacked header rows — merge them.
  const headerRow1 = raw[headerRowIdx].map((c) => String(c ?? "").trim());
  const headerRow2 = looksLikeHeaderRow(raw[headerRowIdx + 1] ?? [])
    ? (raw[headerRowIdx + 1] ?? []).map((c) => String(c ?? "").trim())
    : [];
  const labels = headerRow1.map((h1, i) => normalizeLabel(headerRow2[i] || h1));

  const colIndex = (needles: string[]) => {
    for (const needle of needles) {
      const normalizedNeedle = normalizeLabel(needle);
      const i = labels.findIndex((l) => l.includes(normalizedNeedle));
      if (i !== -1) return i;
    }
    return -1;
  };

  const idx = {
    gstin: colIndex(["gstin of supplier"]),
    vendorName: colIndex(["trade/legal name"]),
    docNumber: colIndex(opts.docNumberNeedles),
    docDate: colIndex(opts.docDateNeedles),
    noteType: labels.findIndex((l) => l.includes("note type")),
    status: labels.findIndex((l) => l === "status"),
    taxableValue: colIndex(["taxable value"]),
    integratedTax: colIndex(["integrated tax"]),
    centralTax: colIndex(["central tax"]),
    stateTax: colIndex(["state/ut tax"]),
    cess: colIndex(["cess"]),
  };

  if (idx.gstin === -1 || idx.docNumber === -1 || idx.taxableValue === -1) {
    return [];
  }

  const dataRows = raw
    .slice(headerRowIdx + (headerRow2.length > 0 ? 2 : 1))
    .filter((r) => r.some((c) => String(c ?? "").trim() !== ""));

  const rows: ImsInvoiceRow[] = [];
  for (const r of dataRows) {
    const gstin = String(r[idx.gstin] ?? "").trim();
    const invoiceNumber = String(r[idx.docNumber] ?? "").trim();
    if (!gstin || !invoiceNumber) continue;

    // GSTR-2B's B2B-CDNR sheet mixes credit notes and debit notes in one sheet —
    // skip debit notes here since they represent GST payable by the vendor, not us.
    if (opts.skipDebitNotes && idx.noteType >= 0) {
      const noteType = String(r[idx.noteType] ?? "").trim().toLowerCase();
      if (noteType.includes("debit")) continue;
    }

    rows.push({
      gstin,
      vendorName: String(r[idx.vendorName] ?? "").trim() || gstin,
      invoiceNumber,
      invoiceDate: parsePortalDate(r[idx.docDate]),
      taxableValue: toNumber(r[idx.taxableValue]),
      integratedTax: toNumber(r[idx.integratedTax]),
      centralTax: toNumber(r[idx.centralTax]),
      stateTax: toNumber(r[idx.stateTax]),
      cess: idx.cess >= 0 ? toNumber(r[idx.cess]) : 0,
      status: idx.status >= 0 ? String(r[idx.status] ?? "").trim() || "Unknown" : "Unknown",
      isCreditNote: opts.isCreditNote,
    });
  }

  return rows;
}

/**
 * Parses every invoice row from the B2B sheet and every credit note row from
 * the B2B-CN sheet, regardless of their GST portal status. Credit notes are
 * flagged with isCreditNote so the caller can record them as negative amounts.
 */
export async function parseImsFile(file: File): Promise<ImsParseResult> {
  const empty: ImsParseResult = { rows: [], invoiceCount: 0, creditNoteCount: 0, parseErrors: [] };

  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: "array" });

    const b2bSheetName = wb.SheetNames.find((n) => n.trim().toLowerCase() === "b2b");
    if (!b2bSheetName) {
      return {
        ...empty,
        parseErrors: ["Could not find a 'B2B' sheet — is this a GST Portal IMS export?"],
      };
    }

    const invoiceRows = parseB2bLikeSheet(wb.Sheets[b2bSheetName], {
      docNumberNeedles: ["invoice number"],
      docDateNeedles: ["invoice date"],
      isCreditNote: false,
    });
    if (invoiceRows.length === 0) {
      return { ...empty, parseErrors: ["Unrecognized column layout in the B2B sheet"] };
    }

    let creditNoteRows: ImsInvoiceRow[] = [];
    const cnSheetName = wb.SheetNames.find(
      (n) => n.trim().toLowerCase() === "b2b-cn" || n.trim().toLowerCase() === "b2b-cdnr",
    );
    if (cnSheetName) {
      creditNoteRows = parseB2bLikeSheet(wb.Sheets[cnSheetName], {
        docNumberNeedles: ["note number", "invoice number"],
        docDateNeedles: ["note date", "invoice date"],
        isCreditNote: true,
        skipDebitNotes: true,
      });
    }

    return {
      rows: [...invoiceRows, ...creditNoteRows],
      invoiceCount: invoiceRows.length,
      creditNoteCount: creditNoteRows.length,
      parseErrors: [],
    };
  } catch (e) {
    return {
      ...empty,
      parseErrors: [`Could not read file: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}
