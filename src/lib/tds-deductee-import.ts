import * as XLSX from "xlsx";

export type TdsDeducteeImportRow = {
  name: string;
  pan: string;
  panValidationStatus?: string;
  panHolderName?: string;
};

export function parseTdsDeducteeWorkbook(buffer: ArrayBuffer): TdsDeducteeImportRow[] {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array", raw: false });
  const rows: TdsDeducteeImportRow[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
    const headerIndex = raw.findIndex((row) => {
      const labels = row.map((cell) => String(cell ?? "").trim().toLowerCase());
      return labels.some((label) => label === "name") && labels.some((label) => label === "pan");
    });
    if (headerIndex < 0) continue;
    const headers = raw[headerIndex].map((cell) => String(cell ?? "").trim().toLowerCase());
    const indexOf = (patterns: string[]) => headers.findIndex((header) => patterns.some((pattern) => header.includes(pattern)));
    const nameIndex = indexOf(["name"]);
    const panIndex = indexOf(["pan"]);
    const validationIndex = indexOf(["validation", "status"]);
    const holderIndex = indexOf(["pan holder", "holder's name", "holder name"]);
    for (const row of raw.slice(headerIndex + 1)) {
      const name = String(row[nameIndex] ?? "").trim();
      const pan = String(row[panIndex] ?? "").replace(/\s+/g, "").trim().toUpperCase();
      if (!name || !pan || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) continue;
      rows.push({ name, pan, panValidationStatus: validationIndex >= 0 ? String(row[validationIndex] ?? "").trim() : undefined, panHolderName: holderIndex >= 0 ? String(row[holderIndex] ?? "").trim() : undefined });
    }
  }
  return rows;
}
