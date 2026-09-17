/**
 * Parser for "Flat Wise Payment Details" workbooks exported from the developer's
 * own tracking sheets. Each flat is a block starting with a "FLAT No." row,
 * followed by a header row, then one row per payment received, ending at a
 * blank row or the next "FLAT No." block.
 */
import * as XLSX from "xlsx";

export type ParsedPayment = {
  date: string; // ISO 8601 UTC
  amount: number;
  reference?: string;
  bank?: string;
};

export type ParsedFlatBlock = {
  flatNumber: string;
  buyerName: string;
  saleValue?: number;
  payments: ParsedPayment[];
};

/** Parses a DD.MM.YYYY date string into an ISO UTC timestamp, or null if invalid. */
function parseDateDMY(raw: string): string | null {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  const day = d.padStart(2, "0");
  const month = mo.padStart(2, "0");
  return `${y}-${month}-${day}T00:00:00.000Z`;
}

/** Parses a currency-formatted cell (commas, ₹, spaces) into a positive number, or null. */
function parseAmount(raw: unknown): number | null {
  const s = String(raw ?? "").replace(/[₹,\s]/g, "");
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) || n <= 0 ? null : n;
}

/** Reads a workbook and extracts every "FLAT No." block across all sheets. */
export function parseFlatWiseWorkbook(buf: ArrayBuffer): {
  flats: ParsedFlatBlock[];
  warnings: string[];
} {
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const flats: ParsedFlatBlock[] = [];
  const warnings: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as unknown[][];

    let i = 0;
    while (i < rows.length) {
      const row = rows[i];
      const first = String(row[0] ?? "").trim().toUpperCase();

      if (first.startsWith("FLAT")) {
        const flatNumber = String(row[1] ?? "").trim();
        const buyerName = String(row[2] ?? "").trim();
        const saleValueDigits = String(row[4] ?? "").replace(/[^\d]/g, "");
        const saleValue = saleValueDigits ? parseFloat(saleValueDigits) : undefined;

        i += 2; // skip the "FLAT No." row and the column-header row beneath it
        const payments: ParsedPayment[] = [];

        while (i < rows.length) {
          const r = rows[i];
          const isBlank = r.every((c) => String(c ?? "").trim() === "");
          const nextFirst = String(r[0] ?? "").trim().toUpperCase();
          if (isBlank || nextFirst.startsWith("FLAT")) break;

          const dateIso = parseDateDMY(String(r[1] ?? ""));
          const amount = parseAmount(r[2]);
          if (dateIso && amount) {
            payments.push({
              date: dateIso,
              amount,
              reference: String(r[4] ?? "").trim() || undefined,
              bank: String(r[5] ?? "").trim() || undefined,
            });
          }
          i++;
        }

        if (flatNumber) {
          flats.push({ flatNumber, buyerName, saleValue, payments });
        } else {
          warnings.push(`Skipped a block in sheet "${sheetName}" with no flat number`);
        }
        continue;
      }
      i++;
    }
  }

  return { flats, warnings };
}

/** Best-effort guess at the payment mode from the reference/bank text found in the sheet. */
export function inferPaymentMode(
  reference?: string,
  bank?: string,
): "cheque" | "neft" | "rtgs" | "upi" | "cash" {
  const text = `${reference ?? ""} ${bank ?? ""}`.toLowerCase();
  if (text.includes("chq") || text.includes("cheque")) return "cheque";
  if (text.includes("upi")) return "upi";
  if (text.includes("cash")) return "cash";
  if (text.includes("rtgs")) return "rtgs";
  return "neft";
}

/** Normalizes a unit/flat number for matching — case-insensitive, ignores spaces and hyphens. */
export function normalizeUnitNumber(n: string): string {
  return n.trim().toUpperCase().replace(/[\s-]+/g, "");
}
