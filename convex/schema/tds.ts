import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Deductee categories affect TDS rate slabs for some sections (e.g. 194J individual vs company). */
export const deducteeTypeValidator = v.union(
  v.literal("vendor"),
  v.literal("employee"),
  v.literal("other"),
);

export const deducteeCategoryValidator = v.union(
  v.literal("individual"),
  v.literal("huf"),
  v.literal("firm"),
  v.literal("company"),
  v.literal("other"),
);

/** Common TDS sections used by a real-estate developer. 192 -> 24Q, 195 -> 27Q, everything else -> 26Q. */
export const tdsSectionValidator = v.union(
  v.literal("192"), // Salary
  v.literal("192A"), // Premature EPF withdrawal
  v.literal("193"), // Interest on securities
  v.literal("194B"), // Lottery / gambling
  v.literal("194A"), // Interest other than securities
  v.literal("194BA"), // Online gaming
  v.literal("194BB"), // Horse racing
  v.literal("194C"), // Contractor payments
  v.literal("194D"), // Insurance commission
  v.literal("194DA"), // Life insurance payout
  v.literal("194H"), // Commission / brokerage
  v.literal("194I"), // Rent
  v.literal("194J"), // Professional / technical fees
  v.literal("194Q"), // Purchase of goods
  v.literal("VDA"), // Crypto / VDA transactions
  v.literal("194T"), // Partner remuneration
  v.literal("195"), // Payments to non-residents
);

export const tdsReturnTypeValidator = v.union(
  v.literal("24Q"),
  v.literal("26Q"),
  v.literal("27Q"),
);

export const tdsChallanStatusValidator = v.union(
  v.literal("pending"),
  v.literal("paid"),
);

/** Per-owner TDS deductor (TAN) profile, used on challans, Form 16/16A, and quarterly returns. */
export const tdsSettings = defineTable({
  ownerId: v.id("users"),
  tan: v.optional(v.string()),
  deductorName: v.optional(v.string()),
  /** Company, Individual, Partnership Firm, etc. */
  deductorType: v.optional(v.string()),
  address: v.optional(v.string()),
  stateName: v.optional(v.string()),
  pincode: v.optional(v.string()),
  responsiblePersonName: v.optional(v.string()),
  responsiblePersonDesignation: v.optional(v.string()),
}).index("by_owner", ["ownerId"]);

/** Deductee master — vendors, employees, or ad-hoc "other" parties (e.g. landlords, non-residents). */
export const tdsDeductees = defineTable({
  ownerId: v.id("users"),
  type: deducteeTypeValidator,
  /** Set when type === "vendor" */
  vendorId: v.optional(v.id("vendors")),
  /** Set when type === "employee" */
  employeeId: v.optional(v.id("employees")),
  name: v.string(),
  pan: v.optional(v.string()),
  category: deducteeCategoryValidator,
  address: v.optional(v.string()),
  isNonResident: v.boolean(),
  isActive: v.boolean(),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_vendor", ["ownerId", "vendorId"])
  .index("by_owner_and_employee", ["ownerId", "employeeId"]);

/** A single TDS deduction event — one row per payment/credit where tax was deducted at source. */
export const tdsDeductions = defineTable({
  ownerId: v.id("users"),
  deducteeId: v.id("tdsDeductees"),
  section: tdsSectionValidator,
  returnType: tdsReturnTypeValidator,
  /** ISO date (YYYY-MM-DD) of deduction */
  date: v.string(),
  /** FY quarter label like "2025-26-Q2" */
  quarter: v.string(),
  /** Amount paid/credited before tax */
  grossAmount: v.number(),
  /** Rate percentage applied, e.g. 10 */
  rate: v.number(),
  tdsAmount: v.number(),
  /** Where this deduction originated */
  sourceType: v.union(v.literal("purchase_invoice"), v.literal("payslip"), v.literal("labour_payment"), v.literal("manual")),
  sourceId: v.optional(v.string()),
  /** Linked once a challan payment covers this deduction */
  challanId: v.optional(v.id("tdsChallans")),
  /** Set once a Form 16/16A certificate PDF has been generated for this deduction's quarter */
  certificateIssued: v.boolean(),
  notes: v.optional(v.string()),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_quarter", ["ownerId", "quarter"])
  .index("by_deductee", ["deducteeId"])
  .index("by_challan", ["challanId"])
  .index("by_owner_and_return_type", ["ownerId", "returnType"]);

/** Form 281 challan used to deposit TDS with the government; groups one or more deductions. */
export const tdsChallans = defineTable({
  ownerId: v.id("users"),
  /** Auto-generated internal ref: CHL-2025-001 */
  internalRef: v.string(),
  /** BSR code of the collecting bank branch */
  bsrCode: v.optional(v.string()),
  /** Challan serial number issued by the bank on payment */
  challanSerialNumber: v.optional(v.string()),
  paymentDate: v.string(),
  quarter: v.string(),
  section: tdsSectionValidator,
  amount: v.number(),
  status: tdsChallanStatusValidator,
  /** Link to the journal entry recording the TDS payment to the government */
  journalEntryId: v.optional(v.id("journalEntries")),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_quarter", ["ownerId", "quarter"]);
