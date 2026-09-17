/** Shared TDS quarter and section helpers for the TDS filing pages. */

export const TDS_SECTION_OPTIONS = [
  { value: "192", label: "192 — Salary" },
  { value: "192A", label: "192A — Premature EPF withdrawal (code 392)" },
  { value: "193", label: "193 — Interest on securities (code 1021)" },
  { value: "194B", label: "194B — Lottery / gambling (code 1060)" },
  { value: "194A", label: "194A — Interest other than securities" },
  { value: "194BA", label: "194BA — Online gaming (code 1060)" },
  { value: "194BB", label: "194BB — Horse racing (code 1061)" },
  { value: "194C", label: "194C — Contractor payments" },
  { value: "194D", label: "194D — Insurance commission (code 1006)" },
  { value: "194DA", label: "194DA — Life insurance payout (code 1007)" },
  { value: "194H", label: "194H — Commission / brokerage" },
  { value: "194I", label: "194I — Rent" },
  { value: "194J", label: "194J — Professional / technical fees" },
  { value: "194Q", label: "194Q — Purchase of goods" },
  { value: "VDA", label: "VDA — Crypto / VDA transactions (code 1037)" },
  { value: "194T", label: "194T — Partner remuneration (code 1067)" },
  { value: "195", label: "195 — Payments to non-residents" },
];

export const RETURN_TYPE_OPTIONS: { value: "24Q" | "26Q" | "27Q"; label: string; description: string }[] = [
  { value: "24Q", label: "24Q", description: "TDS on salary payments" },
  { value: "26Q", label: "26Q", description: "TDS on all payments other than salary (resident)" },
  { value: "27Q", label: "27Q", description: "TDS on payments to non-residents" },
];

/** Returns the current financial-year quarter label, e.g. "2026-27-Q3". */
export function currentQuarter(): string {
  const now = new Date();
  return quarterForDate(now.toISOString().slice(0, 10));
}

export function quarterForDate(dateIso: string): string {
  const [year, monthNum] = dateIso.slice(0, 7).split("-").map(Number);
  const fyStartYear = monthNum >= 4 ? year : year - 1;
  const quarterNum = monthNum >= 4 && monthNum <= 6 ? 1 : monthNum >= 7 && monthNum <= 9 ? 2 : monthNum >= 10 && monthNum <= 12 ? 3 : 4;
  return `${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, "0")}-Q${quarterNum}`;
}

/** Generates the last N quarters (including the current one) for a quarter picker. */
export function recentQuarters(count: number): string[] {
  const quarters: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
    quarters.push(quarterForDate(d.toISOString().slice(0, 10)));
  }
  return [...new Set(quarters)];
}
