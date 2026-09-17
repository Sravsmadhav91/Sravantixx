/**
 * Heuristic matching used when reconciling bank statement debit lines
 * (money going out) against vendors and default expense categories.
 * Every suggestion here is meant to be reviewed and confirmed by the user
 * before anything posts to the ledger — see recordVendorPaymentFromBankTx
 * and postBankTransaction in ../banking.ts.
 */

const STOPWORDS = new Set([
  "and", "the", "pvt", "ltd", "private", "limited", "enterprises",
  "industries", "traders", "construction", "constructions", "company", "co",
  "co.", "corp", "corporation", "associates", "sons", "bros", "brothers",
]);

/** Lowercases and strips everything but letters/digits — used for whole-string substring matching. */
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Splits into lowercase alphanumeric tokens, dropping short/common noise words. */
function significantTokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * True when two tokens are the same word, allowing for the truncation many
 * bank exports apply to fixed-width narration columns (e.g. "INFRASTRUCTU"
 * for "INFRASTRUCTURES"). Requires a decent-length shared prefix so short
 * words don't spuriously match.
 */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const minLen = Math.min(a.length, b.length);
  if (minLen < 5) return false;
  return a.startsWith(b) || b.startsWith(a);
}

export type VendorMatchCandidate = { id: string; name: string };

export type VendorMatchResult = { id: string; name: string; score: number } | null;

/**
 * Finds the best-scoring vendor whose name plausibly appears in a bank
 * narration line. Returns null when nothing scores above the confidence
 * threshold — callers should leave those lines for manual review.
 */
export function matchVendorInNarration(
  narration: string,
  vendors: VendorMatchCandidate[],
): VendorMatchResult {
  const normNarration = normalizeForMatch(narration);
  const narrationTokens = significantTokens(narration);

  let best: { id: string; name: string; score: number } | null = null;

  for (const vendor of vendors) {
    const normVendor = normalizeForMatch(vendor.name);
    if (normVendor.length >= 4 && normNarration.includes(normVendor)) {
      // Whole (normalized) vendor name appears verbatim in the narration —
      // the strongest possible signal. Rank longer names higher since they
      // are more specific (less likely to be a coincidental substring).
      const score = 100 + normVendor.length;
      if (!best || score > best.score) best = { id: vendor.id, name: vendor.name, score };
      continue;
    }

    const vendorTokens = significantTokens(vendor.name);
    if (vendorTokens.length === 0) continue;
    const overlap = vendorTokens.filter((vt) => narrationTokens.some((nt) => tokensMatch(vt, nt))).length;
    const overlapRatio = overlap / vendorTokens.length;
    if (overlap >= 1 && overlapRatio >= 0.6) {
      const score = 50 + overlap * 5;
      if (!best || score > best.score) best = { id: vendor.id, name: vendor.name, score };
    }
  }

  return best;
}

/** Keyword → default expense/cash account code, checked in order (most specific first). */
const EXPENSE_KEYWORD_RULES: { keywords: string[]; accountCode: string }[] = [
  { keywords: ["petty cash", "drawdown casa", "cash withdrawal", "self cheque"], accountCode: "1001" },
  { keywords: ["loan interest", "int jun", "int mar", "int dec", "int sep", "term loan"], accountCode: "4202" },
  { keywords: ["bank charges", "processing fee", "od renewal", "annual fee"], accountCode: "4201" },
  { keywords: ["salary", "salaries", "wages", "payroll"], accountCode: "4101" },
  { keywords: ["rent"], accountCode: "4102" },
  { keywords: ["marketing", "advertising", "advert", "promo"], accountCode: "4103" },
  { keywords: ["legal", "professional fee", "consultant", "architect", "advocate", "audit fee", "ca fees"], accountCode: "4104" },
  { keywords: ["rera", "registration fee", "license fee"], accountCode: "4105" },
  { keywords: ["approval", "statutory", "sanction fee"], accountCode: "4106" },
  { keywords: ["electricity", "escom", "bescom", "current bill", "power bill"], accountCode: "4107" },
  { keywords: ["fuel", "diesel", "petrol", "vehicle", "travel", "toll"], accountCode: "4108" },
  { keywords: ["printer", "cartridge", "stationery", "security agency", "courier"], accountCode: "4109" },
  {
    keywords: ["plumber", "electrician", "mason", "carpenter", "labour contractor", "labour", "labor"],
    accountCode: "4002",
  },
  { keywords: ["subcontractor", "sub contractor"], accountCode: "4003" },
  {
    keywords: ["tiles", "hollow blocks", "granito", "cement", "steel", "sand", "bricks", "pipes", "hardware", "paint"],
    accountCode: "4001",
  },
];

/** Best-effort default expense account code for a debit line, based on narration keywords. Returns null if nothing matches. */
export function suggestExpenseAccountCode(narration: string): string | null {
  const lower = narration.toLowerCase();
  for (const rule of EXPENSE_KEYWORD_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) return rule.accountCode;
  }
  return null;
}
