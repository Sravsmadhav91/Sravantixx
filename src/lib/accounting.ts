import type { Doc } from "@/convex/_generated/dataModel";

export type AccountType = Doc<"accounts">["type"];
export type AccountGroup = Doc<"accounts">["group"];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: "Asset",
  liability: "Liability",
  income: "Income",
  expense: "Expense",
  equity: "Equity / Capital",
};

export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  asset: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950",
  liability: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950",
  income: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950",
  expense: "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950",
  equity: "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950",
};

export const ACCOUNT_GROUP_LABELS: Record<AccountGroup, string> = {
  bank_and_cash: "Bank & Cash",
  receivables: "Receivables",
  current_assets: "Current Assets",
  fixed_assets: "Fixed Assets",
  payables: "Payables",
  current_liabilities: "Current Liabilities",
  loans: "Loans & Borrowings",
  sales_income: "Sales Income",
  other_income: "Other Income",
  direct_expenses: "Direct Expenses",
  indirect_expenses: "Indirect Expenses",
  finance_charges: "Finance Charges",
  capital: "Capital",
  reserves: "Reserves & Surplus",
};

export const ACCOUNT_GROUPS_BY_TYPE: Record<AccountType, AccountGroup[]> = {
  asset: ["bank_and_cash", "receivables", "current_assets", "fixed_assets"],
  liability: ["payables", "current_liabilities", "loans"],
  income: ["sales_income", "other_income"],
  expense: ["direct_expenses", "indirect_expenses", "finance_charges"],
  equity: ["capital", "reserves"],
};

export const TYPE_ORDER: AccountType[] = [
  "asset",
  "liability",
  "income",
  "expense",
  "equity",
];

// ── Vouchers (Tally-style) ──────────────────────────────────────────────────

export type VoucherType =
  | "sales"
  | "purchase"
  | "payment"
  | "receipt"
  | "contra"
  | "debit_note"
  | "credit_note";

export type VoucherConfig = {
  label: string;
  /** Shown as the primary account's dr/cr side */
  primarySide: "debit" | "credit";
  primaryLabel: string;
  primaryPlaceholder: string;
  /** Shown as the line accounts' dr/cr side (always opposite of primarySide) */
  lineSide: "debit" | "credit";
  lineLabel: string;
  linePlaceholder: string;
  description: string;
};

export const VOUCHER_CONFIG: Record<VoucherType, VoucherConfig> = {
  sales: {
    label: "Sales Voucher",
    primarySide: "debit",
    primaryLabel: "Party / Customer Account",
    primaryPlaceholder: "Buyer receivable or customer account…",
    lineSide: "credit",
    lineLabel: "Sales / Income Accounts",
    linePlaceholder: "Sales income account…",
    description: "Records a sale — debits the customer/receivable account and credits income.",
  },
  purchase: {
    label: "Purchase Voucher",
    primarySide: "credit",
    primaryLabel: "Party / Vendor Account",
    primaryPlaceholder: "Vendor payable account…",
    lineSide: "debit",
    lineLabel: "Purchase / Expense Accounts",
    linePlaceholder: "Expense account…",
    description: "Records a purchase — credits the vendor/payable account and debits expenses.",
  },
  payment: {
    label: "Payment Voucher",
    primarySide: "credit",
    primaryLabel: "Bank / Cash Account (Paid From)",
    primaryPlaceholder: "Bank or cash account…",
    lineSide: "debit",
    lineLabel: "Accounts Debited",
    linePlaceholder: "Expense, vendor, or other account…",
    description: "Records money paid out — credits the bank/cash account and debits the payee accounts.",
  },
  receipt: {
    label: "Receipt Voucher",
    primarySide: "debit",
    primaryLabel: "Bank / Cash Account (Received Into)",
    primaryPlaceholder: "Bank or cash account…",
    lineSide: "credit",
    lineLabel: "Accounts Credited",
    linePlaceholder: "Income, buyer, or other account…",
    description: "Records money received — debits the bank/cash account and credits the payer accounts.",
  },
  contra: {
    label: "Contra Voucher",
    primarySide: "debit",
    primaryLabel: "Bank / Cash Account (Transfer To)",
    primaryPlaceholder: "Destination bank or cash account…",
    lineSide: "credit",
    lineLabel: "Bank / Cash Account (Transfer From)",
    linePlaceholder: "Source bank or cash account…",
    description: "Records a transfer between your own bank/cash accounts.",
  },
  debit_note: {
    label: "Debit Note",
    primarySide: "debit",
    primaryLabel: "Vendor Account",
    primaryPlaceholder: "Vendor payable account…",
    lineSide: "credit",
    lineLabel: "Purchase Return / Expense Accounts",
    linePlaceholder: "Purchase return or expense account…",
    description: "Reduces amount owed to a vendor — e.g. for a purchase return or price adjustment.",
  },
  credit_note: {
    label: "Credit Note",
    primarySide: "credit",
    primaryLabel: "Customer Account",
    primaryPlaceholder: "Buyer receivable account…",
    lineSide: "debit",
    lineLabel: "Sales Return / Income Accounts",
    linePlaceholder: "Sales return or income account…",
    description: "Reduces amount owed by a customer — e.g. for a sales return or refund adjustment.",
  },
};

export const VOUCHER_TYPE_ORDER: VoucherType[] = [
  "sales",
  "purchase",
  "payment",
  "receipt",
  "contra",
  "debit_note",
  "credit_note",
];
