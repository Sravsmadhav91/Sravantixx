/**
 * Indian bank statement parser.
 * Handles CSV, plain-text, and raw row-arrays (from Excel direct parse).
 * Supports SBI, HDFC, ICICI, Axis, Kotak, Bank of India, PNB, Canara,
 * Union Bank, KVB, Federal Bank, South Indian Bank, co-operative banks,
 * and any generic Dr/Cr or split Debit/Credit format.
 */

export type ParsedTransaction = {
  date: string; // YYYY-MM-DD
  description: string;
  reference?: string;
  debit: number;
  credit: number;
  balance?: number;
};

export type ParseResult = {
  transactions: ParsedTransaction[];
  openingBalance?: number;
  closingBalance?: number;
  fromDate?: string;
  toDate?: string;
  bankFormat: string;
  errors: string[];
  /** All non-empty column header strings found — used by the manual column mapper */
  detectedHeaders?: string[];
};

// ── Excel serial date → YYYY-MM-DD ───────────────────────────────────────────

function excelSerialToDate(serial: number): string | null {
  // Excel serial date: days since 1900-01-01 (with Lotus 1-2-3 bug: 1900 = leap year)
  if (serial < 1 || serial > 2958465) return null; // rough sanity check
  const utc = new Date((serial - 25569) * 86400 * 1000);
  if (isNaN(utc.getTime())) return null;
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── Date parsing ──────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function parseIndianDate(raw: string | number | Date | undefined): string | null {
  if (raw === undefined || raw === null || raw === "") return null;

  // Already a Date object
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Numeric: could be Excel serial date
  if (typeof raw === "number") {
    if (raw > 0 && raw < 2958465) return excelSerialToDate(raw);
    return null;
  }

  const s = raw.trim().replace(/\//g, "-").replace(/\./g, "-");

  // DD-MM-YYYY or DD-MM-YY
  const dmy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (dmy) {
    const [, d, mo, y] = dmy;
    const year = y.length === 2 ? (parseInt(y) > 50 ? "19" + y : "20" + y) : y;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // YYYY-MM-DD
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    const [, y, mo, d] = ymd;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // "01 Jan 2025" or "01-Jan-2025" or "1-JAN-25"
  const mdy = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[\s-](\d{2,4})$/);
  if (mdy) {
    const [, d, mon, y] = mdy;
    const mo = MONTH_MAP[mon.toLowerCase()];
    const year = y.length === 2 ? (parseInt(y) > 50 ? "19" + y : "20" + y) : y;
    if (mo) return `${year}-${mo}-${d.padStart(2, "0")}`;
  }

  // JavaScript Date string (from XLSX cellDates conversion)
  if (s.includes(" ") && s.length > 10) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${mo}-${dd}`;
    }
  }

  return null;
}

// ── Amount parsing ────────────────────────────────────────────────────────────

export function parseAmount(raw: string | number | undefined): number {
  if (raw === undefined || raw === null || raw === "") return 0;
  if (typeof raw === "number") return isNaN(raw) ? 0 : Math.abs(raw);
  const cleaned = String(raw).replace(/[₹,\s\u00A0\u202F]/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "—" || cleaned.toLowerCase() === "nil") return 0;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.abs(n);
}

// ── Column detection ──────────────────────────────────────────────────────────

export type ColumnMap = {
  date: number;
  description: number;
  debit: number;
  credit: number;
  balance?: number;
  reference?: number;
  amount?: number;  // single amount column
  drCr?: number;   // Dr/Cr indicator column
  valueDate?: number;
};

export function detectColumns(headers: string[]): { map: ColumnMap | null; format: string } {
  const h = headers.map((c) =>
    String(c ?? "").toLowerCase().trim()
      .replace(/\s+/g, " ")
      .replace(/[^\w\s()/.\\-]/g, ""),
  );

  const find = (...names: string[]): number =>
    h.findIndex((c) => names.some((n) => c.includes(n)));
  const has = (...names: string[]): boolean => find(...names) >= 0;

  // ── HDFC ─────────────────────────────────────────────────────────────────────
  if (has("narration") && has("value dt", "value date")) {
    return {
      format: "HDFC",
      map: {
        date: find("date"),
        description: find("narration"),
        reference: find("chq", "ref no"),
        debit: find("debit amount", "withdrawal amt", "withdrawal", "debit dr", "debitdr", "debit"),
        credit: find("credit amount", "deposit amt", "deposit", "credit cr", "creditcr", "credit"),
        balance: find("closing balance", "balance"),
        valueDate: find("value dt", "value date"),
      },
    };
  }

  // ── SBI ───────────────────────────────────────────────────────────────────────
  if (has("txn date") || (has("value date") && has("description", "particulars"))) {
    return {
      format: "SBI",
      map: {
        date: find("txn date", "trans date", "transaction date", "date"),
        description: find("description", "particulars", "remarks", "narration"),
        reference: find("ref no", "cheque no", "chq no", "ref"),
        debit: find("debit", "debit dr", "debitdr"),
        credit: find("credit", "credit cr", "creditcr"),
        balance: find("balance"),
        valueDate: find("value date"),
      },
    };
  }

  // ── ICICI ─────────────────────────────────────────────────────────────────────
  if (has("transaction remarks") || (has("withdrawal amount") && has("deposit amount"))) {
    return {
      format: "ICICI",
      map: {
        date: find("transaction date", "trans date", "date"),
        description: find("transaction remarks", "remarks", "particulars", "narration"),
        reference: find("ref", "chq"),
        debit: find("withdrawal amount", "withdrawal"),
        credit: find("deposit amount", "deposit"),
        balance: find("balance"),
      },
    };
  }

  // ── Axis Bank ─────────────────────────────────────────────────────────────────
  if (has("tran date") || (has("particulars") && has("chqno", "cheque no"))) {
    return {
      format: "Axis",
      map: {
        date: find("tran date", "trans date", "date"),
        description: find("particulars", "description", "narration"),
        reference: find("chqno", "cheque no", "chq", "ref"),
        debit: find("debit"),
        credit: find("credit"),
        balance: find("balance"),
      },
    };
  }

  // ── Kotak ─────────────────────────────────────────────────────────────────────
  if (has("dr (", "dr(") || has("cr (", "cr(")) {
    return {
      format: "Kotak",
      map: {
        date: find("dt", "date"),
        description: find("description", "narration", "particulars"),
        reference: find("chq", "ref"),
        debit: find("dr (", "dr(", "debit"),
        credit: find("cr (", "cr(", "credit"),
        balance: find("bal (", "bal(", "balance"),
      },
    };
  }

  // ── Nationalized / PSU banks (BOI, PNB, Canara, Union, Syndicate, etc.) ──────
  if (has("withdrawal", "withdrawl") && has("deposit")) {
    return {
      format: "Nationalized Bank",
      map: {
        date: find("date", "txn date", "trans date"),
        description: find("particulars", "narration", "description", "remarks"),
        reference: find("cheque", "chq", "ref"),
        debit: find("withdrawal", "withdrawl"),
        credit: find("deposit"),
        balance: find("balance"),
      },
    };
  }

  // ── South Indian / Private banks (KVB, Federal, South Indian Bank, IOB) ──────
  // Common format: Trans Date | Value Date | Description/Narration | Chq./Ref.No. | Debit(Dr.) INR | Credit(Cr.) INR | Balance INR
  if (has("instrument") || has("particulars") || has("narration") || has("description/narration")) {
    const dateIdx = find("trans date", "txn date", "transaction date", "date", "value date");
    const descIdx = find("description/narration", "particulars", "narration", "description", "remarks");
    const debitIdx = find("debit", "dr", "withdrawal");
    const creditIdx = find("credit", "cr", "deposit");
    const balanceIdx = find("balance");
    if (dateIdx >= 0 && descIdx >= 0 && (debitIdx >= 0 || creditIdx >= 0)) {
      return {
        format: "South Indian Bank",
        map: {
          date: dateIdx,
          description: descIdx,
          reference: find("chq./ref.no.", "chq/ref", "instrument", "chq", "ref", "cheque"),
          debit: debitIdx,
          credit: creditIdx,
          balance: balanceIdx >= 0 ? balanceIdx : undefined,
        },
      };
    }
  }

  // ── Single Amount + Dr/Cr indicator ──────────────────────────────────────────
  const amtIdx = find("amount");
  const drcrIdx = find("dr/cr", "cr/dr", "transaction type", "type", "dr cr", "drcr", "mode", "debit/credit");
  if (amtIdx >= 0 && drcrIdx >= 0) {
    return {
      format: "Generic (Dr/Cr)",
      map: {
        date: find("date", "txn date", "trans date"),
        description: find("description", "narration", "particulars", "remarks"),
        reference: find("ref", "chq", "cheque"),
        debit: -1,
        credit: -1,
        amount: amtIdx,
        drCr: drcrIdx,
        balance: find("balance"),
      },
    };
  }

  // ── Generic: separate Debit/Credit ───────────────────────────────────────────
  const debitIdx = find("debit", "withdrawal", "dr");
  const creditIdx = find("credit", "deposit", "cr");
  const dateIdx = find("date", "txn date", "trans date");
  const descIdx = find("description", "narration", "particulars", "remarks");
  if (dateIdx >= 0 && descIdx >= 0 && (debitIdx >= 0 || creditIdx >= 0)) {
    return {
      format: "Generic",
      map: {
        date: dateIdx,
        description: descIdx,
        reference: find("ref", "chq", "cheque"),
        debit: debitIdx,
        credit: creditIdx,
        balance: find("balance"),
      },
    };
  }

  // ── Last resort: if we have date + amount columns (single amount, no Dr/Cr) ──
  if (dateIdx >= 0 && descIdx >= 0 && amtIdx >= 0) {
    return {
      format: "Generic (Amount only)",
      map: {
        date: dateIdx,
        description: descIdx,
        debit: -1,
        credit: amtIdx, // treat all amounts as credits; user can swap in manual mapper
        balance: find("balance"),
      },
    };
  }

  return { map: null, format: "Unknown" };
}

// ── Row → ParsedTransaction ───────────────────────────────────────────────────

function rowToTransaction(
  cols: (string | number | Date | undefined)[],
  map: ColumnMap,
): ParsedTransaction | null {
  const getRaw = (idx: number) => idx >= 0 && idx < cols.length ? cols[idx] : undefined;
  const get = (idx: number): string => {
    const v = getRaw(idx);
    return v === undefined || v === null ? "" : String(v).trim();
  };

  const rawDate = getRaw(map.date);
  const parsedDate = parseIndianDate(rawDate as string | number | Date | undefined);
  if (!parsedDate) return null;

  // Sanity: date must be after 2000 and not in the future by more than 1 year
  const year = parseInt(parsedDate.slice(0, 4));
  if (year < 2000 || year > new Date().getFullYear() + 1) return null;

  let debit = 0;
  let credit = 0;

  if (map.amount !== undefined && map.amount >= 0 && map.drCr !== undefined && map.drCr >= 0) {
    const amt = parseAmount(getRaw(map.amount) as string | number);
    const drCr = get(map.drCr).toLowerCase();
    if (drCr.includes("cr") || drCr.includes("credit") || drCr === "c" || drCr === "deposit") {
      credit = amt;
    } else if (drCr.includes("dr") || drCr.includes("debit") || drCr === "d" || drCr === "withdrawal") {
      debit = amt;
    } else {
      credit = amt; // default to credit if indeterminate
    }
  } else {
    debit = parseAmount(map.debit >= 0 ? getRaw(map.debit) as string | number : undefined);
    credit = parseAmount(map.credit >= 0 ? getRaw(map.credit) as string | number : undefined);
  }

  if (debit === 0 && credit === 0) return null;

  const description = get(map.description).replace(/"/g, "").trim();
  if (!description) return null;

  const balance =
    map.balance !== undefined && map.balance >= 0
      ? parseAmount(getRaw(map.balance) as string | number) || undefined
      : undefined;
  const reference =
    map.reference !== undefined && map.reference >= 0
      ? get(map.reference) || undefined
      : undefined;

  return { date: parsedDate, description, reference, debit, credit, balance };
}

// ── Check if a row looks like a header ───────────────────────────────────────

const HEADER_KEYWORDS = [
  "date", "narration", "particulars", "description", "debit", "credit",
  "withdrawal", "deposit", "amount", "balance", "txn", "tran", "ref",
  "cheque", "chq", "sl no", "serial", "instrument", "remarks",
];

// Summary/label cell markers — these cells should NOT count as column headers
const LABEL_PREFIXES = ["opening", "closing", "brought", "carried", "total", "as at", "as on", "report", "account no", "details"];

function headerCellScore(cells: (string | number | Date | undefined)[]): number {
  const strs = cells.map((c) => String(c ?? "").trim().toLowerCase());
  return strs.filter((s) => {
    if (!s) return false;
    if (typeof cells[strs.indexOf(s)] === "number") return false; // numeric cells → not headers
    if (s.endsWith(":")) return false;                             // "Opening Balance:" style
    if (LABEL_PREFIXES.some((p) => s.startsWith(p))) return false;
    return HEADER_KEYWORDS.some((kw) => s.includes(kw));
  }).length;
}

// ── Parse from raw rows (Excel direct parse) ─────────────────────────────────

/**
 * Parse bank statement data from raw rows (as returned by XLSX.utils.sheet_to_json header:1).
 * An optional `manualMap` overrides auto-detection of columns.
 */
export function parseBankStatementRows(
  rawRows: (string | number | Date | undefined)[][],
  manualMap?: Partial<ColumnMap>,
): ParseResult {
  const errors: string[] = [];
  const transactions: ParsedTransaction[] = [];

  if (rawRows.length < 2) {
    return { transactions: [], bankFormat: "Unknown", errors: ["File has no data rows"] };
  }

  // ── Find header row: pick highest-scoring row in first 30 rows ──────────────
  // A real header row scores 4–7 (one keyword per column).
  // A summary row like "Opening Balance: X  Closing Balance: Y" scores 0–1.
  let headerIdx = -1;
  let bestScore = 1; // require at least score of 2 to qualify
  for (let i = 0; i < Math.min(30, rawRows.length); i++) {
    const score = headerCellScore(rawRows[i]);
    if (score > bestScore) {
      bestScore = score;
      headerIdx = i;
    }
  }

  // Fallback: first row with >= 3 non-empty cells
  if (headerIdx === -1) {
    for (let i = 0; i < Math.min(20, rawRows.length); i++) {
      const nonEmpty = rawRows[i].filter((c) => String(c ?? "").trim() !== "");
      if (nonEmpty.length >= 3) { headerIdx = i; break; }
    }
  }

  if (headerIdx === -1) {
    return {
      transactions: [],
      bankFormat: "Unknown",
      errors: ["Could not find header row. Expected columns like Date, Description, Debit, Credit."],
    };
  }

  // Build header strings — flatten merged cells by repeating last seen non-empty value
  const headerRow = rawRows[headerIdx];
  const headers: string[] = [];
  let lastHeader = "";
  for (const cell of headerRow) {
    const s = String(cell ?? "").trim();
    if (s) { headers.push(s); lastHeader = s; }
    else { headers.push(lastHeader ? `${lastHeader}` : ""); } // merged cell repeats
  }
  const detectedHeaders = headers.filter(Boolean);

  // ── Resolve column map ───────────────────────────────────────────────────────
  let map: ColumnMap | null;
  let format: string;

  if (manualMap && manualMap.date !== undefined && manualMap.description !== undefined) {
    map = {
      date: manualMap.date ?? -1,
      description: manualMap.description ?? -1,
      debit: manualMap.debit ?? -1,
      credit: manualMap.credit ?? -1,
      balance: manualMap.balance,
      reference: manualMap.reference,
      amount: manualMap.amount,
      drCr: manualMap.drCr,
    };
    format = "Custom";
  } else {
    const detected = detectColumns(headers);
    map = detected.map;
    format = detected.format;
  }

  if (!map) {
    return {
      transactions: [],
      bankFormat: "Unknown",
      errors: [
        `Could not detect column structure. Headers found: ${detectedHeaders.join(", ")}. ` +
        "Please map columns manually below.",
      ],
      detectedHeaders,
    };
  }

  // ── Parse data rows ───────────────────────────────────────────────────────────
  let openingBalance: number | undefined;
  let closingBalance: number | undefined;

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.every((c) => String(c ?? "").trim() === "")) continue;

    // Opening/closing balance labels
    const rowStr = row.map((c) => String(c ?? "").toLowerCase()).join(" ");
    if (rowStr.includes("opening") || rowStr.includes("brought forward") || rowStr.includes("b/f")) {
      const nums = row
        .map((c) => parseAmount(typeof c === "number" ? c : String(c ?? "")))
        .filter((n) => n > 0);
      if (nums.length > 0) openingBalance = nums[nums.length - 1];
    }
    if (rowStr.includes("closing") || rowStr.includes("carried forward") || rowStr.includes("c/f")) {
      const nums = row
        .map((c) => parseAmount(typeof c === "number" ? c : String(c ?? "")))
        .filter((n) => n > 0);
      if (nums.length > 0) closingBalance = nums[nums.length - 1];
    }

    const tx = rowToTransaction(row, map);
    if (tx) {
      transactions.push(tx);
      if (tx.balance !== undefined) closingBalance = tx.balance;
    }
  }

  if (transactions.length === 0) {
    errors.push(
      "No valid transactions found. " +
      "Try mapping columns manually using the column mapper below.",
    );
  }

  const dates = transactions.map((t) => t.date).sort();
  return {
    transactions,
    openingBalance,
    closingBalance,
    fromDate: dates[0],
    toDate: dates[dates.length - 1],
    bankFormat: format,
    errors,
    detectedHeaders,
  };
}

// ── CSV text parser ───────────────────────────────────────────────────────────

export function parseBankStatementCSV(csvText: string): ParseResult {
  const raw = csvText.replace(/^\uFEFF/, "").trim();
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const errors: string[] = [];
  const transactions: ParsedTransaction[] = [];

  if (lines.length < 2) {
    return { transactions: [], bankFormat: "Unknown", errors: ["File is empty or has no data rows"] };
  }

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  };

  let headerIdx = 0;
  const KEYWORDS = ["date", "narration", "particulars", "debit", "credit", "description", "withdrawal", "deposit", "balance", "amount", "txn", "tran"];
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if (KEYWORDS.some((kw) => lower.includes(kw))) { headerIdx = i; break; }
  }

  const headers = parseRow(lines[headerIdx]);
  const { map, format } = detectColumns(headers);
  const detectedHeaders = headers.filter(Boolean);

  if (!map) {
    return {
      transactions: [],
      bankFormat: "Unknown",
      errors: [
        `Could not detect columns. Headers: ${detectedHeaders.join(", ")}. ` +
        "Ensure Date, Description, Debit, and Credit columns are present.",
      ],
      detectedHeaders,
    };
  }

  let openingBalance: number | undefined;
  let closingBalance: number | undefined;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseRow(line);
    if (cols.length < 2) continue;

    const lower = line.toLowerCase();
    if (lower.includes("opening") || lower.includes("brought forward")) {
      const amts = line.match(/[\d,]+\.?\d*/g);
      if (amts) openingBalance = parseAmount(amts[amts.length - 1]);
    }
    if (lower.includes("closing") || lower.includes("carried forward")) {
      const amts = line.match(/[\d,]+\.?\d*/g);
      if (amts) closingBalance = parseAmount(amts[amts.length - 1]);
    }

    const tx = rowToTransaction(cols, map);
    if (tx) {
      transactions.push(tx);
      if (tx.balance !== undefined) closingBalance = tx.balance;
    }
  }

  if (transactions.length === 0) {
    errors.push("No valid transactions found. Check date format (DD-MM-YYYY) and Debit/Credit column values.");
  }

  const dates = transactions.map((t) => t.date).sort();
  return {
    transactions,
    openingBalance,
    closingBalance,
    fromDate: dates[0],
    toDate: dates[dates.length - 1],
    bankFormat: format,
    errors,
    detectedHeaders,
  };
}
