import { defineTable } from "convex/server";
import { v } from "convex/values";

export const loanStatusValidator = v.union(
  v.literal("active"),
  v.literal("closed"),
);

export const emiFrequencyValidator = v.union(
  v.literal("monthly"),
  v.literal("quarterly"),
);

/** A company/business loan — bank term loan or project finance. */
export const loans = defineTable({
  ownerId: v.id("users"),
  lenderName: v.string(),
  /** Loan account / sanction reference number */
  accountNumber: v.optional(v.string()),
  /** Optional project this loan finances. */
  projectId: v.optional(v.id("projects")),
  principal: v.number(),
  /** Annual interest rate, percentage e.g. 9.5 */
  interestRatePercent: v.number(),
  /** Tenure in number of EMI installments */
  tenureMonths: v.number(),
  emiFrequency: emiFrequencyValidator,
  /** Computed EMI amount per installment */
  emiAmount: v.number(),
  startDate: v.string(),
  status: loanStatusValidator,
  /** Liability account this loan is tracked under, for repayment journal entries */
  liabilityAccountId: v.optional(v.id("accounts")),
  notes: v.optional(v.string()),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_status", ["ownerId", "status"])
  .index("by_project", ["projectId"]);

export const loanInstallmentStatusValidator = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("overdue"),
);

/** One EMI installment in a loan's amortization schedule. */
export const loanInstallments = defineTable({
  ownerId: v.id("users"),
  loanId: v.id("loans"),
  installmentNumber: v.number(),
  dueDate: v.string(),
  principalComponent: v.number(),
  interestComponent: v.number(),
  totalAmount: v.number(),
  /** Outstanding principal after this installment, for display */
  closingBalance: v.number(),
  status: loanInstallmentStatusValidator,
  paidDate: v.optional(v.string()),
  /** Journal entry created when this installment was paid */
  paymentJournalEntryId: v.optional(v.id("journalEntries")),
})
  .index("by_loan", ["loanId"])
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_status", ["ownerId", "status"]);
