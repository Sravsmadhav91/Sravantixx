import type { WithoutSystemFields } from "convex/server";
import type { Doc } from "../_generated/dataModel";

type AccountSeed = Omit<WithoutSystemFields<Doc<"accounts">>, "ownerId">;

/** Default Indian real-estate chart of accounts (TallyPrime-style groups) */
export const DEFAULT_ACCOUNTS: AccountSeed[] = [
  // ── ASSETS ──────────────────────────────────────────────────────────────────
  { code: "1001", name: "Cash in Hand", type: "asset", group: "bank_and_cash", isSystem: true, isActive: true },
  { code: "1002", name: "Bank Account – Primary", type: "asset", group: "bank_and_cash", isSystem: true, isActive: true },
  { code: "1003", name: "Bank Account – Secondary", type: "asset", group: "bank_and_cash", isSystem: false, isActive: true },
  { code: "1101", name: "Buyer Receivables", type: "asset", group: "receivables", isSystem: true, isActive: true },
  { code: "1102", name: "Advance to Vendors", type: "asset", group: "receivables", isSystem: false, isActive: true },
  { code: "1201", name: "TDS Receivable", type: "asset", group: "current_assets", isSystem: false, isActive: true },
  { code: "1202", name: "GST Input Credit", type: "asset", group: "current_assets", isSystem: false, isActive: true },
  { code: "1203", name: "Prepaid Expenses", type: "asset", group: "current_assets", isSystem: false, isActive: true },
  { code: "1301", name: "Land & Development Cost", type: "asset", group: "fixed_assets", isSystem: true, isActive: true },
  { code: "1302", name: "Construction Work in Progress", type: "asset", group: "fixed_assets", isSystem: true, isActive: true },
  { code: "1303", name: "Office Equipment", type: "asset", group: "fixed_assets", isSystem: false, isActive: true },
  { code: "1304", name: "Vehicles", type: "asset", group: "fixed_assets", isSystem: false, isActive: true },

  // ── LIABILITIES ─────────────────────────────────────────────────────────────
  { code: "2001", name: "Vendor Payables", type: "liability", group: "payables", isSystem: true, isActive: true },
  { code: "2002", name: "Subcontractor Payables", type: "liability", group: "payables", isSystem: false, isActive: true },
  { code: "2101", name: "Advance from Buyers", type: "liability", group: "current_liabilities", isSystem: true, isActive: true },
  { code: "2102", name: "GST Payable – CGST", type: "liability", group: "current_liabilities", isSystem: false, isActive: true },
  { code: "2103", name: "GST Payable – SGST", type: "liability", group: "current_liabilities", isSystem: false, isActive: true },
  { code: "2104", name: "TDS Payable", type: "liability", group: "current_liabilities", isSystem: false, isActive: true },
  { code: "2105", name: "Salaries Payable", type: "liability", group: "current_liabilities", isSystem: false, isActive: true },
  { code: "2106", name: "PF Payable", type: "liability", group: "current_liabilities", isSystem: false, isActive: true },
  { code: "2107", name: "ESI Payable", type: "liability", group: "current_liabilities", isSystem: false, isActive: true },
  { code: "2108", name: "Professional Tax Payable", type: "liability", group: "current_liabilities", isSystem: false, isActive: true },
  { code: "2201", name: "Bank Loan", type: "liability", group: "loans", isSystem: false, isActive: true },
  { code: "2202", name: "Construction Finance", type: "liability", group: "loans", isSystem: false, isActive: true },

  // ── INCOME ──────────────────────────────────────────────────────────────────
  { code: "3001", name: "Unit Sales Revenue", type: "income", group: "sales_income", isSystem: true, isActive: true },
  { code: "3002", name: "Booking Amount Received", type: "income", group: "sales_income", isSystem: true, isActive: true },
  { code: "3003", name: "Plot Sales Revenue", type: "income", group: "sales_income", isSystem: false, isActive: true },
  { code: "3101", name: "Interest Income", type: "income", group: "other_income", isSystem: false, isActive: true },
  { code: "3102", name: "Forfeiture Income", type: "income", group: "other_income", isSystem: false, isActive: true },
  { code: "3103", name: "Penalty / Delay Charges", type: "income", group: "other_income", isSystem: false, isActive: true },

  // ── EXPENSES ────────────────────────────────────────────────────────────────
  { code: "4001", name: "Construction Materials", type: "expense", group: "direct_expenses", isSystem: true, isActive: true },
  { code: "4002", name: "Labour Charges", type: "expense", group: "direct_expenses", isSystem: true, isActive: true },
  { code: "4003", name: "Subcontractor Charges", type: "expense", group: "direct_expenses", isSystem: false, isActive: true },
  { code: "4004", name: "Architect & Consultant Fees", type: "expense", group: "direct_expenses", isSystem: false, isActive: true },
  { code: "4005", name: "Land Acquisition Cost", type: "expense", group: "direct_expenses", isSystem: false, isActive: true },
  { code: "4006", name: "GST Expense on Purchases", type: "expense", group: "direct_expenses", isSystem: false, isActive: true },
  { code: "4101", name: "Salaries & Wages", type: "expense", group: "indirect_expenses", isSystem: false, isActive: true },
  { code: "4102", name: "Office Rent", type: "expense", group: "indirect_expenses", isSystem: false, isActive: true },
  { code: "4103", name: "Marketing & Advertising", type: "expense", group: "indirect_expenses", isSystem: false, isActive: true },
  { code: "4104", name: "Legal & Professional Charges", type: "expense", group: "indirect_expenses", isSystem: false, isActive: true },
  { code: "4105", name: "RERA Registration Fees", type: "expense", group: "indirect_expenses", isSystem: false, isActive: true },
  { code: "4106", name: "Approval & Statutory Charges", type: "expense", group: "indirect_expenses", isSystem: false, isActive: true },
  { code: "4107", name: "Electricity & Utilities", type: "expense", group: "indirect_expenses", isSystem: false, isActive: true },
  { code: "4108", name: "Vehicle & Travel Expenses", type: "expense", group: "indirect_expenses", isSystem: false, isActive: true },
  { code: "4109", name: "Miscellaneous Expenses", type: "expense", group: "indirect_expenses", isSystem: false, isActive: true },
  { code: "4201", name: "Bank Charges", type: "expense", group: "finance_charges", isSystem: false, isActive: true },
  { code: "4202", name: "Loan Interest", type: "expense", group: "finance_charges", isSystem: false, isActive: true },

  // ── EQUITY / CAPITAL ────────────────────────────────────────────────────────
  { code: "5001", name: "Promoter Capital", type: "equity", group: "capital", isSystem: true, isActive: true },
  { code: "5002", name: "Partner Capital", type: "equity", group: "capital", isSystem: false, isActive: true },
  { code: "5101", name: "Retained Earnings", type: "equity", group: "reserves", isSystem: true, isActive: true },
  { code: "5102", name: "General Reserve", type: "equity", group: "reserves", isSystem: false, isActive: true },
];
