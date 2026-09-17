/**
 * CSV import helpers: templates, row types, and validation utilities.
 */
import Papa from "papaparse";

// ── Download helper ───────────────────────────────────────────────────────────

export function downloadCsv(rows: Record<string, string | number>[], filename: string) {
  const csv = Papa.unparse(rows, { quotes: true, header: true });
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Templates ─────────────────────────────────────────────────────────────────

export function downloadBuyerTemplate() {
  downloadCsv(
    [
      {
        name: "Rahul Sharma",
        phone: "9876543210",
        email: "rahul@example.com",
        pan: "ABCDE1234F",
        address: "123 MG Road, Bangalore",
        notes: "",
      },
      {
        name: "Priya Singh",
        phone: "9812345678",
        email: "",
        pan: "",
        address: "",
        notes: "Referred by Suresh",
      },
    ],
    "sravantix-buyers-template.csv",
  );
}

export function downloadUnitTemplate() {
  downloadCsv(
    [
      {
        project_code: "MYP",
        number: "A-101",
        block: "A",
        floor: 1,
        configuration: "2 BHK",
        super_built_up_area_sqft: 1200,
        area_sqft: 1050,
        carpet_area_sqft: 900,
        undivided_share: "45.5",
        rate_per_sqft: 5800,
        facing: "East",
        notes: "",
      },
      {
        project_code: "MYP",
        number: "A-102",
        block: "A",
        floor: 1,
        configuration: "3 BHK",
        super_built_up_area_sqft: 1500,
        area_sqft: 1300,
        carpet_area_sqft: 1100,
        undivided_share: "58.2",
        rate_per_sqft: 5800,
        facing: "North",
        notes: "",
      },
    ],
    "sravantix-units-template.csv",
  );
}

export function downloadLeadTemplate() {
  downloadCsv(
    [
      {
        name: "Amit Patel",
        phone: "9988776655",
        email: "amit@example.com",
        source: "referral",
        status: "new",
        budget: 5000000,
        project_interest: "Mighty Yuva",
        notes: "",
      },
      {
        name: "Kavya Nair",
        phone: "9900112233",
        email: "",
        source: "walk_in",
        status: "contacted",
        budget: "",
        project_interest: "",
        notes: "Interested in 2BHK",
      },
    ],
    "sravantix-leads-template.csv",
  );
}

// ── Row types ─────────────────────────────────────────────────────────────────

export type BuyerImportRow = {
  name: string;
  phone: string;
  email?: string;
  pan?: string;
  address?: string;
  notes?: string;
};

export type UnitImportRow = {
  projectCode: string;
  number: string;
  block?: string;
  floor?: number;
  configuration?: string;
  superBuiltUpAreaSqft: number;
  areaSqft?: number;
  carpetAreaSqft?: number;
  balconyAreaSqft?: number;
  undividedShare?: string;
  ratePerSqft: number;
  facing?: string;
  notes?: string;
};

export type LeadImportRow = {
  name: string;
  phone: string;
  email?: string;
  source: string;
  status: string;
  budget?: number;
  projectInterest?: string;
  notes?: string;
};

// ── Validation errors ─────────────────────────────────────────────────────────

export type RowError = {
  row: number;
  field: string;
  message: string;
};

// ── Buyer validation ──────────────────────────────────────────────────────────

const PHONE_RE = /^\d{10,15}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function validateBuyerRow(raw: Record<string, unknown>, idx: number): RowError[] {
  const errs: RowError[] = [];
  const name = String(raw["name"] ?? "").trim();
  const phone = String(raw["phone"] ?? "").trim().replace(/\s/g, "");
  const pan = String(raw["pan"] ?? "").trim().toUpperCase();

  if (!name) errs.push({ row: idx + 2, field: "name", message: "Name is required" });
  if (!phone) errs.push({ row: idx + 2, field: "phone", message: "Phone is required" });
  else if (!PHONE_RE.test(phone)) errs.push({ row: idx + 2, field: "phone", message: "Phone must be 10–15 digits" });
  if (pan && !PAN_RE.test(pan)) errs.push({ row: idx + 2, field: "pan", message: "Invalid PAN format (ABCDE1234F)" });
  return errs;
}

export function parseBuyerRow(raw: Record<string, unknown>): BuyerImportRow {
  return {
    name: String(raw["name"] ?? "").trim(),
    phone: String(raw["phone"] ?? "").trim().replace(/\s/g, ""),
    email: String(raw["email"] ?? "").trim() || undefined,
    pan: String(raw["pan"] ?? "").trim().toUpperCase() || undefined,
    address: String(raw["address"] ?? "").trim() || undefined,
    notes: String(raw["notes"] ?? "").trim() || undefined,
  };
}

// ── Unit validation ───────────────────────────────────────────────────────────

/** Strip thousand-separators so Excel-formatted "1,050" parses correctly */
function stripCommas(v: unknown): string {
  return String(v ?? "").replace(/,/g, "").trim();
}

export function validateUnitRow(raw: Record<string, unknown>, idx: number): RowError[] {
  const errs: RowError[] = [];
  const number = String(raw["number"] ?? "").trim();
  const sba = parseFloat(String(raw["super_built_up_area_sqft"] ?? "").replace(/,/g, "").trim());
  const rate = parseFloat(String(raw["rate_per_sqft"] ?? "").replace(/,/g, "").trim());

  // project_code is required but may be injected via default project selector
  const code = String(raw["project_code"] ?? "").trim();
  if (!code) errs.push({ row: idx + 2, field: "project_code", message: "Project code is required — select a default project above" });
  if (!number) errs.push({ row: idx + 2, field: "number", message: "Unit number is required" });
  if (!sba || sba <= 0) errs.push({ row: idx + 2, field: "super_built_up_area_sqft", message: "Super Built-Up Area (SBA) must be a positive number" });
  if (!rate || rate <= 0) errs.push({ row: idx + 2, field: "rate_per_sqft", message: "Rate must be a positive number" });
  return errs;
}

export function parseUnitRow(raw: Record<string, unknown>): UnitImportRow {
  const floorRaw = raw["floor"];
  const floorN = parseFloat(stripCommas(floorRaw));
  const sbaRaw = raw["super_built_up_area_sqft"] ?? raw["sba_sqft"];
  const buaRaw = raw["area_sqft"] ?? raw["bua_sqft"];
  const caRaw = raw["carpet_area_sqft"] ?? raw["ca_sqft"];
  const balconyRaw = raw["balcony_area_sqft"] ?? raw["balcony"];
  const sbaN = parseFloat(stripCommas(sbaRaw));
  const buaN = parseFloat(stripCommas(buaRaw));
  const caN = parseFloat(stripCommas(caRaw));
  const balconyN = parseFloat(stripCommas(balconyRaw));
  return {
    projectCode: String(raw["project_code"] ?? "").trim(),
    number: String(raw["number"] ?? "").trim(),
    block: String(raw["block"] ?? "").trim() || undefined,
    floor: floorRaw !== "" && floorRaw !== undefined && floorRaw !== null && !isNaN(floorN) ? floorN : undefined,
    configuration: String(raw["configuration"] ?? "").trim() || undefined,
    superBuiltUpAreaSqft: parseFloat(stripCommas(sbaRaw)),
    areaSqft:
      buaRaw !== "" && buaRaw !== undefined && buaRaw !== null && !isNaN(buaN) ? buaN : undefined,
    carpetAreaSqft:
      caRaw !== "" && caRaw !== undefined && caRaw !== null && !isNaN(caN) ? caN : undefined,
    balconyAreaSqft:
      balconyRaw !== "" && balconyRaw !== undefined && balconyRaw !== null && !isNaN(balconyN) ? balconyN : undefined,
    undividedShare: String(raw["undivided_share"] ?? raw["uds"] ?? "").trim() || undefined,
    ratePerSqft: parseFloat(stripCommas(raw["rate_per_sqft"])),
    facing: String(raw["facing"] ?? "").trim() || undefined,
    notes: String(raw["notes"] ?? "").trim() || undefined,
  };
}

// ── Lead validation ───────────────────────────────────────────────────────────

const VALID_SOURCES = ["walk_in", "referral", "advertisement", "website", "social_media", "other"] as const;
const VALID_STATUSES = ["new", "contacted", "site_visit", "negotiation", "won", "lost"] as const;

export function validateLeadRow(raw: Record<string, unknown>, idx: number): RowError[] {
  const errs: RowError[] = [];
  const name = String(raw["name"] ?? "").trim();
  const phone = String(raw["phone"] ?? "").trim().replace(/\s/g, "");
  const source = String(raw["source"] ?? "").trim().toLowerCase();
  const status = String(raw["status"] ?? "").trim().toLowerCase();

  if (!name) errs.push({ row: idx + 2, field: "name", message: "Name is required" });
  if (!phone) errs.push({ row: idx + 2, field: "phone", message: "Phone is required" });
  else if (!PHONE_RE.test(phone)) errs.push({ row: idx + 2, field: "phone", message: "Phone must be 10–15 digits" });
  if (!source) errs.push({ row: idx + 2, field: "source", message: "Source is required" });
  else if (!(VALID_SOURCES as readonly string[]).includes(source))
    errs.push({ row: idx + 2, field: "source", message: `Must be one of: ${VALID_SOURCES.join(", ")}` });
  if (!status) errs.push({ row: idx + 2, field: "status", message: "Status is required" });
  else if (!(VALID_STATUSES as readonly string[]).includes(status))
    errs.push({ row: idx + 2, field: "status", message: `Must be one of: ${VALID_STATUSES.join(", ")}` });
  return errs;
}

export function parseLeadRow(raw: Record<string, unknown>): LeadImportRow {
  const budget = Number(raw["budget"]);
  return {
    name: String(raw["name"] ?? "").trim(),
    phone: String(raw["phone"] ?? "").trim().replace(/\s/g, ""),
    email: String(raw["email"] ?? "").trim() || undefined,
    source: String(raw["source"] ?? "").trim().toLowerCase(),
    status: String(raw["status"] ?? "").trim().toLowerCase(),
    budget: raw["budget"] !== "" && raw["budget"] !== undefined && !isNaN(budget) && budget > 0 ? budget : undefined,
    projectInterest: String(raw["project_interest"] ?? "").trim() || undefined,
    notes: String(raw["notes"] ?? "").trim() || undefined,
  };
}

// ── Invoice import ────────────────────────────────────────────────────────────

export type InvoiceImportRow = {
  vendorName: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  description: string;
  quantity: number;
  rate: number;
  gstRate: number;
  tds: number;
  narration?: string;
};

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Normalise an Indian date string (DD-MM-YYYY or YYYY-MM-DD or DD/MM/YYYY) to YYYY-MM-DD */
function normaliseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/\//g, "-");
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

export function validateInvoiceRow(raw: Record<string, unknown>, idx: number): RowError[] {
  const errs: RowError[] = [];
  const row = idx + 2;

  const vendorName = String(raw["vendor_name"] ?? raw["vendor"] ?? "").trim();
  const invoiceNo = String(raw["invoice_number"] ?? raw["invoice_no"] ?? raw["inv_no"] ?? "").trim();
  const dateRaw = String(raw["date"] ?? raw["invoice_date"] ?? "").trim();
  const description = String(raw["description"] ?? raw["item"] ?? raw["narration"] ?? "").trim();
  const quantity = Number(raw["quantity"] ?? raw["qty"] ?? 1);
  const rate = Number(raw["rate"] ?? raw["unit_price"] ?? raw["amount"] ?? 0);
  const gstRate = Number(raw["gst_rate"] ?? raw["gst%"] ?? 0);

  if (!vendorName) errs.push({ row, field: "vendor_name", message: "Vendor name is required" });
  if (!invoiceNo) errs.push({ row, field: "invoice_number", message: "Invoice number is required" });
  if (!dateRaw) errs.push({ row, field: "date", message: "Date is required" });
  else if (!normaliseDate(dateRaw)) errs.push({ row, field: "date", message: "Date must be DD-MM-YYYY or YYYY-MM-DD" });
  if (!description) errs.push({ row, field: "description", message: "Description is required" });
  if (isNaN(quantity) || quantity <= 0) errs.push({ row, field: "quantity", message: "Quantity must be a positive number" });
  if (isNaN(rate) || rate <= 0) errs.push({ row, field: "rate", message: "Rate must be a positive number" });
  if (isNaN(gstRate) || gstRate < 0 || gstRate > 100) errs.push({ row, field: "gst_rate", message: "GST rate must be 0–100" });
  void GSTIN_RE; // available for future GSTIN validation
  return errs;
}

export function parseInvoiceRow(raw: Record<string, unknown>): InvoiceImportRow {
  const quantity = Number(raw["quantity"] ?? raw["qty"] ?? 1);
  const rate = Number(raw["rate"] ?? raw["unit_price"] ?? raw["amount"] ?? 0);
  const gstRate = Number(raw["gst_rate"] ?? raw["gst%"] ?? 0);
  const tds = Number(raw["tds"] ?? raw["tds_amount"] ?? 0);
  const dueDateRaw = String(raw["due_date"] ?? raw["duedate"] ?? "").trim();

  return {
    vendorName: String(raw["vendor_name"] ?? raw["vendor"] ?? "").trim(),
    invoiceNumber: String(raw["invoice_number"] ?? raw["invoice_no"] ?? raw["inv_no"] ?? "").trim(),
    date: normaliseDate(String(raw["date"] ?? raw["invoice_date"] ?? "").trim()) ?? "",
    dueDate: dueDateRaw ? (normaliseDate(dueDateRaw) ?? undefined) : undefined,
    description: String(raw["description"] ?? raw["item"] ?? raw["narration"] ?? "").trim(),
    quantity: isNaN(quantity) ? 1 : quantity,
    rate: isNaN(rate) ? 0 : rate,
    gstRate: isNaN(gstRate) ? 0 : gstRate,
    tds: isNaN(tds) ? 0 : tds,
    narration: String(raw["narration"] ?? raw["notes"] ?? "").trim() || undefined,
  };
}

export function downloadInvoiceTemplate() {
  downloadCsv(
    [
      {
        vendor_name: "ABC Cement Traders",
        invoice_number: "INV-2025-001",
        date: "15-04-2025",
        due_date: "15-05-2025",
        description: "Cement supply - 500 bags",
        quantity: 500,
        rate: 380,
        gst_rate: 28,
        tds: 0,
        narration: "Phase 1 basement slab",
      },
      {
        vendor_name: "XYZ Construction Pvt Ltd",
        invoice_number: "XYZ-2025-042",
        date: "20-04-2025",
        due_date: "20-05-2025",
        description: "Labour charges April 2025",
        quantity: 1,
        rate: 150000,
        gst_rate: 18,
        tds: 15000,
        narration: "Tower A floors 3-5",
      },
    ],
    "sravantix-invoices-template.csv",
  );
}

// ── CSV parse helper ──────────────────────────────────────────────────────────

export function parseCsvFile(
  file: File,
): Promise<{ rows: Record<string, unknown>[]; parseErrors: string[] }> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (results) => {
        const parseErrors = results.errors.map(
          (e) => `Row ${e.row ?? "?"}: ${e.message}`,
        );
        resolve({ rows: results.data, parseErrors });
      },
      error: (err) => {
        resolve({ rows: [], parseErrors: [err.message] });
      },
    });
  });
}
