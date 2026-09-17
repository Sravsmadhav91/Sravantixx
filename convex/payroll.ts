import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { effectiveOwnerId, requireOwner, requireUser } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

// ── PF/ESI statutory rates (India, standard rates) ──────────────────────────
const PF_EMPLOYEE_RATE = 0.12;
const PF_EMPLOYER_RATE = 0.12;
/** PF is calculated on Basic, capped at this wage ceiling per month per EPFO rules. */
const PF_WAGE_CEILING = 15000;
const ESI_EMPLOYEE_RATE = 0.0075;
const ESI_EMPLOYER_RATE = 0.0325;
/** ESI only applies below this gross monthly wage. */
const ESI_WAGE_CEILING = 21000;

function professionalTaxFor(gross: number): number {
  // Karnataka PT slabs (monthly)
  if (gross <= 25000) return 0;
  return 200;
}

// ── Helper: next employee code ──────────────────────────────────────────────

async function getNextEmployeeCode(ctx: MutationCtx, ownerId: Id<"users">): Promise<string> {
  const last = await ctx.db
    .query("employees")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .first();
  if (!last) return "EMP-001";
  const match = last.employeeCode.match(/EMP-(\d+)$/);
  const seq = match ? parseInt(match[1], 10) + 1 : 1;
  return `EMP-${String(seq).padStart(3, "0")}`;
}

async function findAccountByCode(ctx: MutationCtx, ownerId: Id<"users">, code: string): Promise<Id<"accounts"> | null> {
  const account = await ctx.db
    .query("accounts")
    .withIndex("by_owner_and_code", (q) => q.eq("ownerId", ownerId).eq("code", code))
    .first();
  return account?._id ?? null;
}

async function getNextJeNumber(ctx: MutationCtx, ownerId: Id<"users">): Promise<string> {
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
// EMPLOYEES
// ═══════════════════════════════════════════════════════════════════════════

export const listEmployees = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<Doc<"employees">[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    let employees = await ctx.db
      .query("employees")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    if (args.activeOnly) employees = employees.filter((e) => e.isActive);
    return employees.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const getEmployee = query({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args): Promise<Doc<"employees"> | null> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const employee = await ctx.db.get("employees", args.employeeId);
    if (!employee || employee.ownerId !== ownerId) return null;
    return employee;
  },
});

const employeeFieldsValidator = {
  name: v.string(),
  designation: v.string(),
  dateOfJoining: v.string(),
  pan: v.optional(v.string()),
  uan: v.optional(v.string()),
  esiNumber: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  bankAccount: v.optional(v.string()),
  bankIfsc: v.optional(v.string()),
  bankName: v.optional(v.string()),
  costCenterId: v.optional(v.id("costCenters")),
  basic: v.number(),
  hra: v.number(),
  conveyance: v.number(),
  specialAllowance: v.number(),
  otherAllowances: v.number(),
  pfApplicable: v.boolean(),
  esiApplicable: v.boolean(),
};

export const createEmployee = mutation({
  args: employeeFieldsValidator,
  handler: async (ctx, args): Promise<Id<"employees">> => {
    const user = await requireModuleAccess(ctx, "payroll");
    const ownerId = effectiveOwnerId(user);
    const employeeCode = await getNextEmployeeCode(ctx, ownerId);
    return await ctx.db.insert("employees", {
      ...args,
      ownerId,
      employeeCode,
      isActive: true,
    });
  },
});

export const updateEmployee = mutation({
  args: { employeeId: v.id("employees"), ...employeeFieldsValidator, isActive: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "payroll");
    const ownerId = effectiveOwnerId(user);
    const { employeeId, ...patch } = args;
    const employee = await ctx.db.get("employees", employeeId);
    if (!employee || employee.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Employee not found" });
    }
    await ctx.db.patch("employees", employeeId, patch);
  },
});

export const setEmployeeActive = mutation({
  args: { employeeId: v.id("employees"), isActive: v.boolean(), dateOfLeaving: v.optional(v.string()) },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "payroll");
    const ownerId = effectiveOwnerId(user);
    const employee = await ctx.db.get("employees", args.employeeId);
    if (!employee || employee.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Employee not found" });
    }
    await ctx.db.patch("employees", args.employeeId, {
      isActive: args.isActive,
      dateOfLeaving: args.isActive ? undefined : args.dateOfLeaving,
    });
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// PAYROLL RUNS
// ═══════════════════════════════════════════════════════════════════════════

type PayslipComputation = {
  employeeId: Id<"employees">;
  basic: number;
  hra: number;
  conveyance: number;
  specialAllowance: number;
  otherAllowances: number;
  grossEarnings: number;
  pfEmployee: number;
  pfEmployer: number;
  esiEmployee: number;
  esiEmployer: number;
  professionalTax: number;
  tds: number;
  totalDeductions: number;
  netPay: number;
};

function computePayslip(employee: Doc<"employees">): PayslipComputation {
  const grossEarnings = employee.basic + employee.hra + employee.conveyance + employee.specialAllowance + employee.otherAllowances;
  const pfBase = Math.min(employee.basic, PF_WAGE_CEILING);
  const pfEmployee = employee.pfApplicable ? Math.round(pfBase * PF_EMPLOYEE_RATE) : 0;
  const pfEmployer = employee.pfApplicable ? Math.round(pfBase * PF_EMPLOYER_RATE) : 0;
  const esiEligible = employee.esiApplicable && grossEarnings <= ESI_WAGE_CEILING;
  const esiEmployee = esiEligible ? Math.round(grossEarnings * ESI_EMPLOYEE_RATE) : 0;
  const esiEmployer = esiEligible ? Math.round(grossEarnings * ESI_EMPLOYER_RATE) : 0;
  const professionalTax = professionalTaxFor(grossEarnings);
  const tds = 0; // editable by owner before finalizing
  const totalDeductions = pfEmployee + esiEmployee + professionalTax + tds;
  return {
    employeeId: employee._id,
    basic: employee.basic,
    hra: employee.hra,
    conveyance: employee.conveyance,
    specialAllowance: employee.specialAllowance,
    otherAllowances: employee.otherAllowances,
    grossEarnings,
    pfEmployee,
    pfEmployer,
    esiEmployee,
    esiEmployer,
    professionalTax,
    tds,
    totalDeductions,
    netPay: grossEarnings - totalDeductions,
  };
}

export const listPayrollRuns = query({
  args: {},
  handler: async (ctx): Promise<Doc<"payrollRuns">[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    return await ctx.db
      .query("payrollRuns")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .collect();
  },
});

export const getPayrollRun = query({
  args: { payrollRunId: v.id("payrollRuns") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const run = await ctx.db.get("payrollRuns", args.payrollRunId);
    if (!run || run.ownerId !== ownerId) return null;

    const payslips = await ctx.db
      .query("payslips")
      .withIndex("by_run", (q) => q.eq("payrollRunId", args.payrollRunId))
      .collect();

    const withEmployee = await Promise.all(
      payslips.map(async (p) => {
        const employee = await ctx.db.get("employees", p.employeeId);
        return { ...p, employeeName: employee?.name ?? "Unknown", employeeCode: employee?.employeeCode ?? "—" };
      }),
    );

    return { run, payslips: withEmployee.sort((a, b) => a.employeeName.localeCompare(b.employeeName)) };
  },
});

/** Creates a draft payroll run for the given month, generating one payslip per active employee. */
export const createPayrollRun = mutation({
  args: { month: v.string() },
  handler: async (ctx, args): Promise<Id<"payrollRuns">> => {
    const user = await requireModuleAccess(ctx, "payroll");
    const ownerId = effectiveOwnerId(user);

    const existing = await ctx.db
      .query("payrollRuns")
      .withIndex("by_owner_and_month", (q) => q.eq("ownerId", ownerId).eq("month", args.month))
      .first();
    if (existing) {
      throw new ConvexError({ code: "CONFLICT", message: `A payroll run for ${args.month} already exists` });
    }

    const employees = (await ctx.db.query("employees").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect())
      .filter((e) => e.isActive);
    if (employees.length === 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "No active employees to run payroll for" });
    }

    const computations = employees.map(computePayslip);
    const totalGross = computations.reduce((s, c) => s + c.grossEarnings, 0);
    const totalDeductions = computations.reduce((s, c) => s + c.totalDeductions, 0);
    const totalNetPay = computations.reduce((s, c) => s + c.netPay, 0);

    const runId = await ctx.db.insert("payrollRuns", {
      ownerId,
      month: args.month,
      status: "draft",
      totalGross,
      totalDeductions,
      totalNetPay,
    });

    for (const c of computations) {
      await ctx.db.insert("payslips", { ownerId, payrollRunId: runId, ...c });
    }

    return runId;
  },
});

/** Updates a single payslip's TDS while the run is in draft, and recomputes totals. */
export const updatePayslipTds = mutation({
  args: { payslipId: v.id("payslips"), tds: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "payroll");
    const ownerId = effectiveOwnerId(user);
    const payslip = await ctx.db.get("payslips", args.payslipId);
    if (!payslip || payslip.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Payslip not found" });
    }
    const run = await ctx.db.get("payrollRuns", payslip.payrollRunId);
    if (!run || run.status !== "draft") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Only draft payroll runs can be edited" });
    }
    const oldDeductions = payslip.totalDeductions;
    const newTotalDeductions = payslip.pfEmployee + payslip.esiEmployee + payslip.professionalTax + args.tds;
    const newNetPay = payslip.grossEarnings - newTotalDeductions;

    await ctx.db.patch("payslips", args.payslipId, {
      tds: args.tds,
      totalDeductions: newTotalDeductions,
      netPay: newNetPay,
    });

    await ctx.db.patch("payrollRuns", run._id, {
      totalDeductions: run.totalDeductions - oldDeductions + newTotalDeductions,
      totalNetPay: run.totalNetPay - payslip.netPay + newNetPay,
    });
  },
});

/**
 * Finalizes a draft payroll run: posts a journal entry for salary expense + statutory
 * liabilities, and creates TDS deduction records (section 192) for any payslip with TDS > 0.
 */
export const finalizePayrollRun = mutation({
  args: { payrollRunId: v.id("payrollRuns"), date: v.string() },
  handler: async (ctx, args): Promise<Id<"journalEntries">> => {
    const user = await requireModuleAccess(ctx, "payroll");
    const ownerId = effectiveOwnerId(user);
    const run = await ctx.db.get("payrollRuns", args.payrollRunId);
    if (!run || run.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Payroll run not found" });
    }
    if (run.status !== "draft") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Only draft payroll runs can be finalized" });
    }

    const payslips = await ctx.db
      .query("payslips")
      .withIndex("by_run", (q) => q.eq("payrollRunId", args.payrollRunId))
      .collect();

    const salariesExpenseId = await findAccountByCode(ctx, ownerId, "4101");
    const pfPayableId = await findAccountByCode(ctx, ownerId, "2106");
    const esiPayableId = await findAccountByCode(ctx, ownerId, "2107");
    const ptPayableId = await findAccountByCode(ctx, ownerId, "2108");
    const salariesPayableId = await findAccountByCode(ctx, ownerId, "2105");
    const tdsPayableId = await findAccountByCode(ctx, ownerId, "2104");

    if (!salariesExpenseId || !salariesPayableId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Required accounts (4101 Salaries & Wages, 2105 Salaries Payable) not found. Ensure accounts are seeded." });
    }

    const totalGross = payslips.reduce((s, p) => s + p.grossEarnings, 0);
    const totalPf = payslips.reduce((s, p) => s + p.pfEmployee + p.pfEmployer, 0);
    const totalEsi = payslips.reduce((s, p) => s + p.esiEmployee + p.esiEmployer, 0);
    const totalPt = payslips.reduce((s, p) => s + p.professionalTax, 0);
    const totalTds = payslips.reduce((s, p) => s + p.tds, 0);
    const employerContribution = payslips.reduce((s, p) => s + p.pfEmployer + p.esiEmployer, 0);
    const totalNetPay = payslips.reduce((s, p) => s + p.netPay, 0);

    const jeLines: Array<{ accountId: Id<"accounts">; side: "debit" | "credit"; amount: number; narration?: string }> = [];

    // Debit: gross salary expense + employer PF/ESI contribution (additional cost to company)
    jeLines.push({ accountId: salariesExpenseId, side: "debit", amount: totalGross + employerContribution, narration: `Salaries for ${run.month}` });

    // Credit: statutory liabilities withheld/payable
    if (totalPf > 0 && pfPayableId) jeLines.push({ accountId: pfPayableId, side: "credit", amount: totalPf, narration: "PF Payable (employee + employer)" });
    if (totalEsi > 0 && esiPayableId) jeLines.push({ accountId: esiPayableId, side: "credit", amount: totalEsi, narration: "ESI Payable (employee + employer)" });
    if (totalPt > 0 && ptPayableId) jeLines.push({ accountId: ptPayableId, side: "credit", amount: totalPt, narration: "Professional Tax Payable" });
    if (totalTds > 0 && tdsPayableId) jeLines.push({ accountId: tdsPayableId, side: "credit", amount: totalTds, narration: "TDS on Salary (Sec 192)" });

    // Credit: net pay owed to employees
    jeLines.push({ accountId: salariesPayableId, side: "credit", amount: totalNetPay, narration: `Net salaries payable — ${run.month}` });

    const totalDebit = jeLines.filter((l) => l.side === "debit").reduce((s, l) => s + l.amount, 0);
    const totalCredit = jeLines.filter((l) => l.side === "credit").reduce((s, l) => s + l.amount, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new ConvexError({ code: "BAD_REQUEST", message: `Journal entry imbalanced: Dr ${totalDebit.toFixed(2)} vs Cr ${totalCredit.toFixed(2)}` });
    }

    const entryNumber = await getNextJeNumber(ctx, ownerId);
    const jeId = await ctx.db.insert("journalEntries", {
      ownerId,
      entryNumber,
      date: args.date,
      narration: `Payroll ${run.month} — salary expense & statutory liabilities`,
      status: "posted",
      source: "payroll",
      sourceId: args.payrollRunId,
      totalAmount: totalDebit,
    });
    for (const line of jeLines) {
      await ctx.db.insert("journalLines", { ownerId, journalEntryId: jeId, ...line });
    }

    // Create TDS deduction records (Section 192, return type 24Q) for payslips with TDS
    const [year, monthNum] = run.month.split("-").map(Number);
    const fyStartYear = monthNum >= 4 ? year : year - 1;
    const quarterNum = monthNum >= 4 && monthNum <= 6 ? 1 : monthNum >= 7 && monthNum <= 9 ? 2 : monthNum >= 10 && monthNum <= 12 ? 3 : 4;
    const quarter = `${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, "0")}-Q${quarterNum}`;

    for (const p of payslips) {
      if (p.tds <= 0) continue;
      const employee = await ctx.db.get("employees", p.employeeId);
      if (!employee) continue;

      let deductee = await ctx.db
        .query("tdsDeductees")
        .withIndex("by_owner_and_employee", (q) => q.eq("ownerId", ownerId).eq("employeeId", employee._id))
        .first();
      if (!deductee) {
        const deducteeId = await ctx.db.insert("tdsDeductees", {
          ownerId,
          type: "employee",
          employeeId: employee._id,
          name: employee.name,
          pan: employee.pan,
          category: "individual",
          isNonResident: false,
          isActive: true,
        });
        deductee = await ctx.db.get("tdsDeductees", deducteeId);
      }
      if (!deductee) continue;

      await ctx.db.insert("tdsDeductions", {
        ownerId,
        deducteeId: deductee._id,
        section: "192",
        returnType: "24Q",
        date: args.date,
        quarter,
        grossAmount: p.grossEarnings,
        rate: p.grossEarnings > 0 ? Math.round((p.tds / p.grossEarnings) * 10000) / 100 : 0,
        tdsAmount: p.tds,
        sourceType: "payslip",
        sourceId: p._id,
        certificateIssued: false,
      });
    }

    await ctx.db.patch("payrollRuns", args.payrollRunId, {
      status: "finalized",
      finalizedDate: args.date,
      finalizeJournalEntryId: jeId,
    });

    return jeId;
  },
});

/** Records the actual bank payout of net salaries for a finalized run. */
export const markPayrollRunPaid = mutation({
  args: { payrollRunId: v.id("payrollRuns"), date: v.string(), bankAccountId: v.optional(v.id("accounts")) },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "payroll");
    const ownerId = effectiveOwnerId(user);
    const run = await ctx.db.get("payrollRuns", args.payrollRunId);
    if (!run || run.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Payroll run not found" });
    }
    if (run.status !== "finalized") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Only finalized payroll runs can be marked paid" });
    }

    const salariesPayableId = await findAccountByCode(ctx, ownerId, "2105");
    const bankAccountId = args.bankAccountId ?? await findAccountByCode(ctx, ownerId, "1002");
    if (!salariesPayableId || !bankAccountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Required accounts not found" });
    }

    const entryNumber = await getNextJeNumber(ctx, ownerId);
    const jeId = await ctx.db.insert("journalEntries", {
      ownerId,
      entryNumber,
      date: args.date,
      narration: `Net salary payout — ${run.month}`,
      status: "posted",
      source: "payroll",
      sourceId: args.payrollRunId,
      totalAmount: run.totalNetPay,
    });
    await ctx.db.insert("journalLines", { ownerId, journalEntryId: jeId, accountId: salariesPayableId, side: "debit", amount: run.totalNetPay });
    await ctx.db.insert("journalLines", { ownerId, journalEntryId: jeId, accountId: bankAccountId, side: "credit", amount: run.totalNetPay });

    await ctx.db.patch("payrollRuns", args.payrollRunId, {
      status: "paid",
      paidDate: args.date,
      paymentJournalEntryId: jeId,
    });
  },
});
