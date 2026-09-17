import { defineTable } from "convex/server";
import { v } from "convex/values";

export const payrollRunStatusValidator = v.union(
  v.literal("draft"),
  v.literal("finalized"),
  v.literal("paid"),
);

/** Employee master. Current salary structure is embedded (no history versioning in this milestone). */
export const employees = defineTable({
  ownerId: v.id("users"),
  /** Auto-generated: EMP-001 */
  employeeCode: v.string(),
  name: v.string(),
  designation: v.string(),
  dateOfJoining: v.string(),
  dateOfLeaving: v.optional(v.string()),
  pan: v.optional(v.string()),
  uan: v.optional(v.string()),
  esiNumber: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  bankAccount: v.optional(v.string()),
  bankIfsc: v.optional(v.string()),
  bankName: v.optional(v.string()),
  /** Optional cost-center tag for department-wise payroll cost reporting */
  costCenterId: v.optional(v.id("costCenters")),
  // ── Current monthly salary structure ──
  basic: v.number(),
  hra: v.number(),
  conveyance: v.number(),
  specialAllowance: v.number(),
  otherAllowances: v.number(),
  pfApplicable: v.boolean(),
  esiApplicable: v.boolean(),
  isActive: v.boolean(),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_code", ["ownerId", "employeeCode"]);

export const payrollRuns = defineTable({
  ownerId: v.id("users"),
  /** "YYYY-MM" */
  month: v.string(),
  status: payrollRunStatusValidator,
  finalizedDate: v.optional(v.string()),
  paidDate: v.optional(v.string()),
  /** JE created on finalize (salary expense + statutory liabilities) */
  finalizeJournalEntryId: v.optional(v.id("journalEntries")),
  /** JE created when the net salary is actually paid out (salaries payable -> bank) */
  paymentJournalEntryId: v.optional(v.id("journalEntries")),
  totalGross: v.number(),
  totalDeductions: v.number(),
  totalNetPay: v.number(),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_month", ["ownerId", "month"]);

export const payslips = defineTable({
  ownerId: v.id("users"),
  payrollRunId: v.id("payrollRuns"),
  employeeId: v.id("employees"),
  // Earnings snapshot at time of run
  basic: v.number(),
  hra: v.number(),
  conveyance: v.number(),
  specialAllowance: v.number(),
  otherAllowances: v.number(),
  grossEarnings: v.number(),
  // Deductions
  pfEmployee: v.number(),
  pfEmployer: v.number(),
  esiEmployee: v.number(),
  esiEmployer: v.number(),
  professionalTax: v.number(),
  /** Editable while the run is in draft — TDS on salary (Section 192) */
  tds: v.number(),
  totalDeductions: v.number(),
  netPay: v.number(),
})
  .index("by_run", ["payrollRunId"])
  .index("by_employee", ["employeeId"])
  .index("by_owner", ["ownerId"]);
