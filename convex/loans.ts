import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { effectiveOwnerId, requireUser } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/** Standard reducing-balance EMI amortization schedule. */
function buildAmortizationSchedule(
  principal: number,
  annualRatePercent: number,
  installments: number,
  frequency: "monthly" | "quarterly",
  startDate: string,
): { emiAmount: number; schedule: Array<{ principalComponent: number; interestComponent: number; totalAmount: number; closingBalance: number; dueDate: string }> } {
  const periodsPerYear = frequency === "monthly" ? 12 : 4;
  const r = annualRatePercent / 100 / periodsPerYear;
  const emi = r === 0
    ? principal / installments
    : (principal * r * Math.pow(1 + r, installments)) / (Math.pow(1 + r, installments) - 1);

  const monthsPerPeriod = frequency === "monthly" ? 1 : 3;
  const start = new Date(startDate);
  let balance = principal;
  const schedule: Array<{ principalComponent: number; interestComponent: number; totalAmount: number; closingBalance: number; dueDate: string }> = [];

  for (let i = 1; i <= installments; i++) {
    const interestComponent = balance * r;
    let principalComponent = emi - interestComponent;
    if (i === installments) {
      // Last installment absorbs any rounding residue so balance closes exactly to zero.
      principalComponent = balance;
    }
    balance = Math.max(0, balance - principalComponent);
    const due = new Date(start);
    due.setMonth(due.getMonth() + i * monthsPerPeriod);
    schedule.push({
      principalComponent: Math.round(principalComponent),
      interestComponent: Math.round(interestComponent),
      totalAmount: Math.round(principalComponent + interestComponent),
      closingBalance: Math.round(balance),
      dueDate: due.toISOString().slice(0, 10),
    });
  }

  return { emiAmount: Math.round(emi), schedule };
}

async function getNextEntryNumber(ctx: MutationCtx, ownerId: Id<"users">): Promise<string> {
  const last = await ctx.db
    .query("journalEntries")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .first();
  const year = new Date().getFullYear();
  if (!last) return `JE-${year}-001`;
  const match = last.entryNumber.match(/JE-\d{4}-(\d+)$/);
  const seq = match ? parseInt(match[1], 10) + 1 : 1;
  return `JE-${year}-${String(seq).padStart(3, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════

export type LoanWithSummary = Doc<"loans"> & {
  projectName: string | null;
  outstandingPrincipal: number;
  nextInstallment: Doc<"loanInstallments"> | null;
};

export const listLoans = query({
  args: { status: v.optional(v.union(v.literal("active"), v.literal("closed"))) },
  handler: async (ctx, args): Promise<LoanWithSummary[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    let loans: Doc<"loans">[];
    if (args.status) {
      loans = await ctx.db
        .query("loans")
        .withIndex("by_owner_and_status", (q) => q.eq("ownerId", ownerId).eq("status", args.status!))
        .collect();
    } else {
      loans = await ctx.db
        .query("loans")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .collect();
    }

    const projectIds = [...new Set(loans.map((l) => l.projectId).filter((p): p is Id<"projects"> => !!p))];
    const projectMap = new Map<string, string>();
    for (const pid of projectIds) {
      const p = await ctx.db.get("projects", pid);
      if (p) projectMap.set(pid, p.name);
    }

    const results: LoanWithSummary[] = [];
    for (const loan of loans) {
      const installments = await ctx.db
        .query("loanInstallments")
        .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
        .collect();
      const unpaid = installments.filter((i) => i.status !== "paid").sort((a, b) => a.installmentNumber - b.installmentNumber);
      const lastPaid = installments.filter((i) => i.status === "paid").sort((a, b) => b.installmentNumber - a.installmentNumber)[0];
      const outstandingPrincipal = lastPaid ? lastPaid.closingBalance : loan.principal;
      results.push({
        ...loan,
        projectName: loan.projectId ? projectMap.get(loan.projectId) ?? null : null,
        outstandingPrincipal,
        nextInstallment: unpaid[0] ?? null,
      });
    }
    return results.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const getLoan = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const loan = await ctx.db.get("loans", args.loanId);
    if (!loan || loan.ownerId !== ownerId) return null;

    const [project, liabilityAccount, installments] = await Promise.all([
      loan.projectId ? ctx.db.get("projects", loan.projectId) : Promise.resolve(null),
      loan.liabilityAccountId ? ctx.db.get("accounts", loan.liabilityAccountId) : Promise.resolve(null),
      ctx.db
        .query("loanInstallments")
        .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
        .collect(),
    ]);

    return {
      loan,
      project,
      liabilityAccount,
      installments: installments.sort((a, b) => a.installmentNumber - b.installmentNumber),
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const createLoan = mutation({
  args: {
    lenderName: v.string(),
    accountNumber: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    principal: v.number(),
    interestRatePercent: v.number(),
    tenureMonths: v.number(),
    emiFrequency: v.union(v.literal("monthly"), v.literal("quarterly")),
    startDate: v.string(),
    liabilityAccountId: v.optional(v.id("accounts")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"loans">> => {
    const user = await requireModuleAccess(ctx, "loans");
    const ownerId = effectiveOwnerId(user);

    if (args.principal <= 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Principal must be greater than zero" });
    }
    if (args.tenureMonths <= 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Tenure must be at least 1 installment" });
    }
    if (args.projectId) {
      const project = await ctx.db.get("projects", args.projectId);
      if (!project || project.ownerId !== ownerId) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Project not found" });
      }
    }
    if (args.liabilityAccountId) {
      const account = await ctx.db.get("accounts", args.liabilityAccountId);
      if (!account || account.ownerId !== ownerId) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Liability account not found" });
      }
    }

    const { emiAmount, schedule } = buildAmortizationSchedule(
      args.principal,
      args.interestRatePercent,
      args.tenureMonths,
      args.emiFrequency,
      args.startDate,
    );

    const loanId = await ctx.db.insert("loans", {
      ownerId,
      lenderName: args.lenderName,
      accountNumber: args.accountNumber,
      projectId: args.projectId,
      principal: args.principal,
      interestRatePercent: args.interestRatePercent,
      tenureMonths: args.tenureMonths,
      emiFrequency: args.emiFrequency,
      emiAmount,
      startDate: args.startDate,
      status: "active",
      liabilityAccountId: args.liabilityAccountId,
      notes: args.notes,
    });

    for (let i = 0; i < schedule.length; i++) {
      const s = schedule[i];
      await ctx.db.insert("loanInstallments", {
        ownerId,
        loanId,
        installmentNumber: i + 1,
        dueDate: s.dueDate,
        principalComponent: s.principalComponent,
        interestComponent: s.interestComponent,
        totalAmount: s.totalAmount,
        closingBalance: s.closingBalance,
        status: "pending",
      });
    }

    return loanId;
  },
});

export const updateLoan = mutation({
  args: {
    loanId: v.id("loans"),
    lenderName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    liabilityAccountId: v.optional(v.id("accounts")),
    notes: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("closed"))),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "loans");
    const ownerId = effectiveOwnerId(user);
    const { loanId, ...patch } = args;
    const loan = await ctx.db.get("loans", loanId);
    if (!loan || loan.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Loan not found" });
    }
    await ctx.db.patch("loans", loanId, patch);
  },
});

export const deleteLoan = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "loans");
    const ownerId = effectiveOwnerId(user);
    const loan = await ctx.db.get("loans", args.loanId);
    if (!loan || loan.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Loan not found" });
    }
    const installments = await ctx.db
      .query("loanInstallments")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .collect();
    if (installments.some((i) => i.status === "paid")) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot delete a loan with recorded payments. Close it instead." });
    }
    for (const i of installments) await ctx.db.delete("loanInstallments", i._id);
    await ctx.db.delete("loans", args.loanId);
  },
});

export const recordInstallmentPayment = mutation({
  args: {
    installmentId: v.id("loanInstallments"),
    paidDate: v.string(),
    bankAccountId: v.id("accounts"),
    interestExpenseAccountId: v.id("accounts"),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "loans");
    const ownerId = effectiveOwnerId(user);
    const installment = await ctx.db.get("loanInstallments", args.installmentId);
    if (!installment || installment.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Installment not found" });
    }
    if (installment.status === "paid") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Installment is already paid" });
    }
    const loan = await ctx.db.get("loans", installment.loanId);
    if (!loan) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Loan not found" });
    }

    const bankAccount = await ctx.db.get("accounts", args.bankAccountId);
    const interestAccount = await ctx.db.get("accounts", args.interestExpenseAccountId);
    if (!bankAccount || bankAccount.ownerId !== ownerId || !interestAccount || interestAccount.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Account not found" });
    }

    let journalEntryId: Id<"journalEntries"> | undefined;
    if (loan.liabilityAccountId) {
      const entryNumber = await getNextEntryNumber(ctx, ownerId);
      journalEntryId = await ctx.db.insert("journalEntries", {
        ownerId,
        entryNumber,
        date: args.paidDate,
        narration: `Loan EMI #${installment.installmentNumber} — ${loan.lenderName}`,
        status: "posted",
        source: "loan_installment",
        sourceId: installment._id,
        totalAmount: installment.totalAmount,
      });
      if (installment.principalComponent > 0) {
        await ctx.db.insert("journalLines", {
          ownerId,
          journalEntryId,
          accountId: loan.liabilityAccountId,
          side: "debit",
          amount: installment.principalComponent,
          narration: "Principal repayment",
        });
      }
      if (installment.interestComponent > 0) {
        await ctx.db.insert("journalLines", {
          ownerId,
          journalEntryId,
          accountId: args.interestExpenseAccountId,
          side: "debit",
          amount: installment.interestComponent,
          narration: "Interest expense",
        });
      }
      await ctx.db.insert("journalLines", {
        ownerId,
        journalEntryId,
        accountId: args.bankAccountId,
        side: "credit",
        amount: installment.totalAmount,
        narration: "EMI payment",
      });
    }

    await ctx.db.patch("loanInstallments", args.installmentId, {
      status: "paid",
      paidDate: args.paidDate,
      paymentJournalEntryId: journalEntryId,
    });

    // Auto-close the loan once every installment is paid.
    const allInstallments = await ctx.db
      .query("loanInstallments")
      .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
      .collect();
    const allPaid = allInstallments.every((i) => (i._id === args.installmentId ? true : i.status === "paid"));
    if (allPaid) {
      await ctx.db.patch("loans", loan._id, { status: "closed" });
    }
  },
});
