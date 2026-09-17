import { defineTable } from "convex/server";
import { v } from "convex/values";

export const accountTypeValidator = v.union(
  v.literal("asset"),
  v.literal("liability"),
  v.literal("income"),
  v.literal("expense"),
  v.literal("equity"),
);

export const accountGroupValidator = v.union(
  // Assets
  v.literal("bank_and_cash"),
  v.literal("receivables"),
  v.literal("current_assets"),
  v.literal("fixed_assets"),
  // Liabilities
  v.literal("payables"),
  v.literal("current_liabilities"),
  v.literal("loans"),
  // Income
  v.literal("sales_income"),
  v.literal("other_income"),
  // Expenses
  v.literal("direct_expenses"),
  v.literal("indirect_expenses"),
  v.literal("finance_charges"),
  // Equity
  v.literal("capital"),
  v.literal("reserves"),
);

export const accounts = defineTable({
  ownerId: v.id("users"),
  /** Unique code like "1001", "2001" etc. */
  code: v.string(),
  name: v.string(),
  type: accountTypeValidator,
  group: accountGroupValidator,
  /** Opening balance in INR (signed — positive = normal balance side) */
  openingBalance: v.optional(v.number()),
  /** ISO date for opening balance */
  openingBalanceDate: v.optional(v.string()),
  /** System accounts cannot be deleted or have their type changed */
  isSystem: v.boolean(),
  isActive: v.boolean(),
  description: v.optional(v.string()),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_code", ["ownerId", "code"])
  .index("by_owner_and_type", ["ownerId", "type"])
  .index("by_owner_and_group", ["ownerId", "group"]);

export const journalEntryStatusValidator = v.union(
  v.literal("draft"),
  v.literal("posted"),
  v.literal("cancelled"),
);

/** Tally-style voucher types. Undefined = a plain manual journal entry. */
export const voucherTypeValidator = v.union(
  v.literal("sales"),
  v.literal("purchase"),
  v.literal("payment"),
  v.literal("receipt"),
  v.literal("contra"),
  v.literal("debit_note"),
  v.literal("credit_note"),
);

export const journalEntries = defineTable({
  ownerId: v.id("users"),
  /** Entry/voucher number like "JE-2025-001" or "PMT-2025-001" */
  entryNumber: v.string(),
  /** ISO date string (YYYY-MM-DD) */
  date: v.string(),
  narration: v.string(),
  status: journalEntryStatusValidator,
  /** Source: manual, booking_receipt, purchase_invoice, bank_import, voucher */
  source: v.string(),
  /** Optional reference to source document ID */
  sourceId: v.optional(v.string()),
  /** Reference like cheque no, UTR, etc. */
  reference: v.optional(v.string()),
  /** Total debit amount (must equal total credit) */
  totalAmount: v.number(),
  /** Set when this entry was created via a Tally-style voucher form */
  voucherType: v.optional(voucherTypeValidator),
  /** The main party/bank/cash account for a voucher, denormalized for fast list display */
  primaryAccountId: v.optional(v.id("accounts")),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_date", ["ownerId", "date"])
  .index("by_owner_and_status", ["ownerId", "status"])
  .index("by_owner_and_entry_number", ["ownerId", "entryNumber"])
  .index("by_owner_and_voucher_type", ["ownerId", "voucherType"]);

export const journalLines = defineTable({
  ownerId: v.id("users"),
  journalEntryId: v.id("journalEntries"),
  accountId: v.id("accounts"),
  /** "debit" or "credit" */
  side: v.union(v.literal("debit"), v.literal("credit")),
  amount: v.number(),
  narration: v.optional(v.string()),
  /** Optional project tag for project-wise P&L */
  projectId: v.optional(v.id("projects")),
  /** Optional cost center tag (department, function, etc.) for cost-center-wise P&L */
  costCenterId: v.optional(v.id("costCenters")),
})
  .index("by_entry", ["journalEntryId"])
  .index("by_account", ["accountId"])
  .index("by_owner", ["ownerId"])
  .index("by_account_and_entry", ["accountId", "journalEntryId"])
  .index("by_cost_center", ["costCenterId"]);

export const costCenters = defineTable({
  ownerId: v.id("users"),
  /** Unique short code like "SALES", "ADMIN", "MKT-BLR" */
  code: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  isActive: v.boolean(),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_code", ["ownerId", "code"]);
