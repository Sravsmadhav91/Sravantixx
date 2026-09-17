import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { effectiveOwnerId, requireOwner, requireUser } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  deducteeCategoryValidator,
  deducteeTypeValidator,
  tdsReturnTypeValidator,
  tdsSectionValidator,
} from "./schema/tds.ts";

// ── TDS rate table (standard rates, resident deductees) ─────────────────────
// Used only as a suggested default; the owner can override the rate per deduction.
export const TDS_RATE_TABLE: Record<string, { label: string; rate: number; threshold: number }> = {
  "192": { label: "Salary (192)", rate: 0, threshold: 0 }, // slab-based, computed in payroll
  "192A": { label: "Premature EPF withdrawal (192A) · code 392", rate: 10, threshold: 50000 },
  "193": { label: "Interest on securities (193) · code 1021", rate: 10, threshold: 10000 },
  "194A": { label: "Bank / post office interest (194A) · code 1021", rate: 10, threshold: 50000 },
  "194B": { label: "Lottery / gambling (194B) · code 1060", rate: 30, threshold: 10000 },
  "194BA": { label: "Online gaming (194BA) · code 1060", rate: 30, threshold: 0 },
  "194BB": { label: "Horse racing (194BB) · code 1061", rate: 30, threshold: 10000 },
  "194C": { label: "Contractor payments (194C) · codes 1023 / 1024", rate: 1, threshold: 30000 },
  "194D": { label: "Insurance commission (194D) · code 1006", rate: 2, threshold: 20000 },
  "194DA": { label: "Life insurance payout (194DA) · code 1007", rate: 2, threshold: 100000 },
  "194H": { label: "Brokerage / commission (194H) · code 1006", rate: 2, threshold: 20000 },
  "194I": { label: "Rent: plant / machinery (194I) · code 1007", rate: 2, threshold: 50000 },
  "194J": { label: "Professional / technical fees (194J) · codes 1026 / 1027 / 1028", rate: 10, threshold: 50000 },
  "194Q": { label: "Purchase of goods (194Q)", rate: 0.1, threshold: 5000000 },
  "VDA": { label: "Crypto / VDA transactions · code 1037", rate: 1, threshold: 0 },
  "194T": { label: "Partner remuneration · code 1067", rate: 10, threshold: 0 },
  "195": { label: "Payments to non-residents (195)", rate: 30, threshold: 0 },
};

function quarterForDate(dateIso: string): string {
  const [year, monthNum] = dateIso.slice(0, 7).split("-").map(Number);
  const fyStartYear = monthNum >= 4 ? year : year - 1;
  const quarterNum = monthNum >= 4 && monthNum <= 6 ? 1 : monthNum >= 7 && monthNum <= 9 ? 2 : monthNum >= 10 && monthNum <= 12 ? 3 : 4;
  return `${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, "0")}-Q${quarterNum}`;
}

async function getNextChallanRef(ctx: MutationCtx, ownerId: Id<"users">): Promise<string> {
  const last = await ctx.db
    .query("tdsChallans")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .first();
  const year = new Date().getFullYear();
  if (!last) return `CHL-${year}-001`;
  const match = last.internalRef.match(/CHL-\d{4}-(\d+)$/);
  const seq = match ? parseInt(match[1], 10) + 1 : 1;
  return `CHL-${year}-${String(seq).padStart(3, "0")}`;
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
// TDS SETTINGS (Deductor / TAN profile)
// ═══════════════════════════════════════════════════════════════════════════

export const getTdsSettings = query({
  args: {},
  handler: async (ctx): Promise<Doc<"tdsSettings"> | null> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    return await ctx.db.query("tdsSettings").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).first();
  },
});

export const saveTdsSettings = mutation({
  args: {
    tan: v.optional(v.string()),
    deductorName: v.optional(v.string()),
    deductorType: v.optional(v.string()),
    address: v.optional(v.string()),
    stateName: v.optional(v.string()),
    pincode: v.optional(v.string()),
    responsiblePersonName: v.optional(v.string()),
    responsiblePersonDesignation: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "tds");
    const existing = await ctx.db.query("tdsSettings").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).first();
    if (existing) {
      await ctx.db.patch("tdsSettings", existing._id, args);
    } else {
      await ctx.db.insert("tdsSettings", { ownerId: user._id, ...args });
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// DEDUCTEE MASTER
// ═══════════════════════════════════════════════════════════════════════════

export const listDeductees = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<Doc<"tdsDeductees">[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    let deductees = await ctx.db.query("tdsDeductees").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect();
    if (args.activeOnly) deductees = deductees.filter((d) => d.isActive);
    return deductees.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createDeductee = mutation({
  args: {
    type: deducteeTypeValidator,
    vendorId: v.optional(v.id("vendors")),
    name: v.string(),
    pan: v.optional(v.string()),
    category: deducteeCategoryValidator,
    address: v.optional(v.string()),
    isNonResident: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"tdsDeductees">> => {
    const user = await requireModuleAccess(ctx, "tds");
    const ownerId = effectiveOwnerId(user);
    return await ctx.db.insert("tdsDeductees", { ...args, ownerId, isActive: true });
  },
});

export const updateDeductee = mutation({
  args: {
    deducteeId: v.id("tdsDeductees"),
    name: v.optional(v.string()),
    pan: v.optional(v.string()),
    category: v.optional(deducteeCategoryValidator),
    address: v.optional(v.string()),
    isNonResident: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "tds");
    const ownerId = effectiveOwnerId(user);
    const { deducteeId, ...patch } = args;
    const deductee = await ctx.db.get("tdsDeductees", deducteeId);
    if (!deductee || deductee.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Deductee not found" });
    }
    await ctx.db.patch("tdsDeductees", deducteeId, patch);
  },
});

/** Finds or creates a deductee linked to a vendor, used when logging a deduction from a purchase invoice. */
async function getOrCreateVendorDeductee(ctx: MutationCtx, ownerId: Id<"users">, vendorId: Id<"vendors">): Promise<Doc<"tdsDeductees">> {
  const existing = await ctx.db
    .query("tdsDeductees")
    .withIndex("by_owner_and_vendor", (q) => q.eq("ownerId", ownerId).eq("vendorId", vendorId))
    .first();
  if (existing) return existing;

  const vendor = await ctx.db.get("vendors", vendorId);
  if (!vendor) throw new ConvexError({ code: "NOT_FOUND", message: "Vendor not found" });

  const deducteeId = await ctx.db.insert("tdsDeductees", {
    ownerId,
    type: "vendor",
    vendorId,
    name: vendor.name,
    pan: vendor.pan,
    category: "other",
    isNonResident: false,
    isActive: true,
  });
  const deductee = await ctx.db.get("tdsDeductees", deducteeId);
  if (!deductee) throw new ConvexError({ code: "NOT_FOUND", message: "Failed to create deductee" });
  return deductee;
}

// ═══════════════════════════════════════════════════════════════════════════
// TDS DEDUCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export const listDeductions = query({
  args: { quarter: v.optional(v.string()), returnType: v.optional(tdsReturnTypeValidator) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    let deductions: Doc<"tdsDeductions">[];
    if (args.quarter) {
      deductions = await ctx.db
        .query("tdsDeductions")
        .withIndex("by_owner_and_quarter", (q) => q.eq("ownerId", ownerId).eq("quarter", args.quarter!))
        .collect();
    } else if (args.returnType) {
      deductions = await ctx.db
        .query("tdsDeductions")
        .withIndex("by_owner_and_return_type", (q) => q.eq("ownerId", ownerId).eq("returnType", args.returnType!))
        .collect();
    } else {
      deductions = await ctx.db.query("tdsDeductions").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect();
    }

    const deducteeIds = [...new Set(deductions.map((d) => d.deducteeId))];
    const deducteeMap = new Map<string, Doc<"tdsDeductees">>();
    for (const id of deducteeIds) {
      const d = await ctx.db.get("tdsDeductees", id);
      if (d) deducteeMap.set(id, d);
    }

    return deductions
      .map((d) => ({ ...d, deducteeName: deducteeMap.get(d.deducteeId)?.name ?? "Unknown", deducteePan: deducteeMap.get(d.deducteeId)?.pan }))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
});

/** Manually logs a TDS deduction against a vendor (e.g. rent, professional fees) not tied to a purchase invoice. */
export const createManualDeduction = mutation({
  args: {
    vendorId: v.optional(v.id("vendors")),
    deducteeId: v.optional(v.id("tdsDeductees")),
    section: tdsSectionValidator,
    date: v.string(),
    grossAmount: v.number(),
    rate: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"tdsDeductions">> => {
    const user = await requireModuleAccess(ctx, "tds");
    const ownerId = effectiveOwnerId(user);

    let deductee: Doc<"tdsDeductees">;
    if (args.deducteeId) {
      const found = await ctx.db.get("tdsDeductees", args.deducteeId);
      if (!found || found.ownerId !== ownerId) throw new ConvexError({ code: "NOT_FOUND", message: "Deductee not found" });
      deductee = found;
    } else if (args.vendorId) {
      deductee = await getOrCreateVendorDeductee(ctx, ownerId, args.vendorId);
    } else {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Provide either a vendor or a deductee" });
    }

    const returnType = args.section === "195" ? "27Q" : args.section === "192" ? "24Q" : "26Q";
    const tdsAmount = Math.round(args.grossAmount * (args.rate / 100));

    return await ctx.db.insert("tdsDeductions", {
      ownerId,
      deducteeId: deductee._id,
      section: args.section,
      returnType,
      date: args.date,
      quarter: quarterForDate(args.date),
      grossAmount: args.grossAmount,
      rate: args.rate,
      tdsAmount,
      sourceType: "manual",
      certificateIssued: false,
    });
  },
});

/** Logs a TDS deduction sourced from an existing (already-created) purchase invoice's tds field. */
export const createDeductionFromPurchaseInvoice = mutation({
  args: { purchaseInvoiceId: v.id("purchaseInvoices"), section: tdsSectionValidator, rate: v.number() },
  handler: async (ctx, args): Promise<Id<"tdsDeductions">> => {
    const user = await requireModuleAccess(ctx, "tds");
    const ownerId = effectiveOwnerId(user);
    const invoice = await ctx.db.get("purchaseInvoices", args.purchaseInvoiceId);
    if (!invoice || invoice.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Purchase invoice not found" });
    }
    if (invoice.tds <= 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "This invoice has no TDS amount" });
    }

    // Avoid duplicate deduction records for the same invoice
    const existing = await ctx.db
      .query("tdsDeductions")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    if (existing.some((d) => d.sourceType === "purchase_invoice" && d.sourceId === args.purchaseInvoiceId)) {
      throw new ConvexError({ code: "CONFLICT", message: "A TDS deduction already exists for this invoice" });
    }

    const deductee = await getOrCreateVendorDeductee(ctx, ownerId, invoice.vendorId);
    const returnType = args.section === "195" ? "27Q" : "26Q";

    return await ctx.db.insert("tdsDeductions", {
      ownerId,
      deducteeId: deductee._id,
      section: args.section,
      returnType,
      date: invoice.date,
      quarter: quarterForDate(invoice.date),
      grossAmount: invoice.subtotal,
      rate: args.rate,
      tdsAmount: invoice.tds,
      sourceType: "purchase_invoice",
      sourceId: args.purchaseInvoiceId,
      certificateIssued: false,
    });
  },
});

/** Purchase invoices with a TDS amount that don't yet have a linked deduction record. */
export const listUnlinkedTdsInvoices = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const invoices = await ctx.db.query("purchaseInvoices").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect();
    const deductions = await ctx.db.query("tdsDeductions").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect();
    const linkedInvoiceIds = new Set(deductions.filter((d) => d.sourceType === "purchase_invoice").map((d) => d.sourceId));

    const candidates = invoices.filter((i) => i.tds > 0 && i.status !== "cancelled" && !linkedInvoiceIds.has(i._id));
    const vendorIds = [...new Set(candidates.map((i) => i.vendorId))];
    const vendorMap = new Map<string, string>();
    for (const vid of vendorIds) {
      const v = await ctx.db.get("vendors", vid);
      if (v) vendorMap.set(vid, v.name);
    }
    return candidates.map((i) => ({ ...i, vendorName: vendorMap.get(i.vendorId) ?? "Unknown" }));
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// CHALLANS (Form 281)
// ═══════════════════════════════════════════════════════════════════════════

export const listChallans = query({
  args: {},
  handler: async (ctx): Promise<Doc<"tdsChallans">[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    return await ctx.db.query("tdsChallans").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).order("desc").collect();
  },
});

/** Deductions not yet linked to a challan, grouped implicitly by quarter+section on the frontend. */
export const listUnpaidDeductions = query({
  args: { quarter: v.string(), section: tdsSectionValidator },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const deductions = await ctx.db
      .query("tdsDeductions")
      .withIndex("by_owner_and_quarter", (q) => q.eq("ownerId", ownerId).eq("quarter", args.quarter))
      .collect();
    return deductions.filter((d) => d.section === args.section && !d.challanId);
  },
});

/** Creates a challan covering a set of deductions for one quarter+section, and posts the TDS payment JE. */
export const createChallan = mutation({
  args: {
    quarter: v.string(),
    section: tdsSectionValidator,
    paymentDate: v.string(),
    bsrCode: v.optional(v.string()),
    challanSerialNumber: v.optional(v.string()),
    deductionIds: v.array(v.id("tdsDeductions")),
    bankAccountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args): Promise<Id<"tdsChallans">> => {
    const user = await requireModuleAccess(ctx, "tds");
    const ownerId = effectiveOwnerId(user);

    if (args.deductionIds.length === 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Select at least one deduction to pay" });
    }

    const deductions = await Promise.all(args.deductionIds.map((id) => ctx.db.get("tdsDeductions", id)));
    let amount = 0;
    for (const d of deductions) {
      if (!d || d.ownerId !== ownerId) throw new ConvexError({ code: "NOT_FOUND", message: "Deduction not found" });
      if (d.challanId) throw new ConvexError({ code: "CONFLICT", message: "A deduction is already linked to a challan" });
      amount += d.tdsAmount;
    }

    const tdsPayableId = await findAccountByCode(ctx, ownerId, "2104");
    const bankAccountId = args.bankAccountId ?? (await findAccountByCode(ctx, ownerId, "1002"));
    let journalEntryId: Id<"journalEntries"> | undefined;
    if (tdsPayableId && bankAccountId) {
      const entryNumber = await getNextJeNumber(ctx, ownerId);
      journalEntryId = await ctx.db.insert("journalEntries", {
        ownerId,
        entryNumber,
        date: args.paymentDate,
        narration: `TDS payment — ${args.section} — ${args.quarter}`,
        status: "posted",
        source: "tds_challan",
        totalAmount: amount,
      });
      await ctx.db.insert("journalLines", { ownerId, journalEntryId, accountId: tdsPayableId, side: "debit", amount });
      await ctx.db.insert("journalLines", { ownerId, journalEntryId, accountId: bankAccountId, side: "credit", amount });
    }

    const internalRef = await getNextChallanRef(ctx, ownerId);
    const challanId = await ctx.db.insert("tdsChallans", {
      ownerId,
      internalRef,
      bsrCode: args.bsrCode,
      challanSerialNumber: args.challanSerialNumber,
      paymentDate: args.paymentDate,
      quarter: args.quarter,
      section: args.section,
      amount,
      status: "paid",
      journalEntryId,
    });

    for (const id of args.deductionIds) {
      await ctx.db.patch("tdsDeductions", id, { challanId });
    }

    return challanId;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// FORM 16 / 16A CERTIFICATES
// ═══════════════════════════════════════════════════════════════════════════

export const markCertificateIssued = mutation({
  args: { deductionId: v.id("tdsDeductions") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "tds");
    const ownerId = effectiveOwnerId(user);
    const deduction = await ctx.db.get("tdsDeductions", args.deductionId);
    if (!deduction || deduction.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Deduction not found" });
    }
    await ctx.db.patch("tdsDeductions", args.deductionId, { certificateIssued: true });
  },
});

/** Data needed to render a Form 16A / Form 16 certificate for one deductee in one quarter. */
export const getCertificateData = query({
  args: { deducteeId: v.id("tdsDeductees"), quarter: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const deductee = await ctx.db.get("tdsDeductees", args.deducteeId);
    if (!deductee || deductee.ownerId !== ownerId) return null;

    const deductions = (
      await ctx.db.query("tdsDeductions").withIndex("by_deductee", (q) => q.eq("deducteeId", args.deducteeId)).collect()
    ).filter((d) => d.quarter === args.quarter);

    const settings = await ctx.db.query("tdsSettings").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).first();
    const challanIds = [...new Set(deductions.map((d) => d.challanId).filter((c): c is Id<"tdsChallans"> => !!c))];
    const challans = new Map<string, Doc<"tdsChallans">>();
    for (const id of challanIds) {
      const c = await ctx.db.get("tdsChallans", id);
      if (c) challans.set(id, c);
    }

    return {
      deductee,
      settings,
      deductions: deductions.map((d) => ({ ...d, challan: d.challanId ? challans.get(d.challanId) : undefined })),
      totalTds: deductions.reduce((s, d) => s + d.tdsAmount, 0),
      returnType: deductions[0]?.returnType ?? "26Q",
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// QUARTERLY E-TDS RETURN SUMMARIES (24Q / 26Q / 27Q)
// ═══════════════════════════════════════════════════════════════════════════

export type QuarterlyReturnSummary = {
  quarter: string;
  returnType: "24Q" | "26Q" | "27Q";
  rows: {
    deducteeName: string;
    pan: string;
    section: string;
    date: string;
    grossAmount: number;
    rate: number;
    tdsAmount: number;
    challanRef?: string;
    certificateIssued: boolean;
  }[];
  totalGross: number;
  totalTds: number;
  deducteeCount: number;
  challanCount: number;
};

export const getQuarterlyReturnSummary = query({
  args: { quarter: v.string(), returnType: tdsReturnTypeValidator },
  handler: async (ctx, args): Promise<QuarterlyReturnSummary> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    const deductions = (
      await ctx.db
        .query("tdsDeductions")
        .withIndex("by_owner_and_quarter", (q) => q.eq("ownerId", ownerId).eq("quarter", args.quarter))
        .collect()
    ).filter((d) => d.returnType === args.returnType);

    const deducteeIds = [...new Set(deductions.map((d) => d.deducteeId))];
    const deducteeMap = new Map<string, Doc<"tdsDeductees">>();
    for (const id of deducteeIds) {
      const d = await ctx.db.get("tdsDeductees", id);
      if (d) deducteeMap.set(id, d);
    }
    const challanIds = [...new Set(deductions.map((d) => d.challanId).filter((c): c is Id<"tdsChallans"> => !!c))];
    const challanMap = new Map<string, Doc<"tdsChallans">>();
    for (const id of challanIds) {
      const c = await ctx.db.get("tdsChallans", id);
      if (c) challanMap.set(id, c);
    }

    const rows = deductions
      .map((d) => {
        const deductee = deducteeMap.get(d.deducteeId);
        const challan = d.challanId ? challanMap.get(d.challanId) : undefined;
        return {
          deducteeName: deductee?.name ?? "Unknown",
          pan: deductee?.pan ?? "PANNOTAVBL",
          section: d.section,
          date: d.date,
          grossAmount: d.grossAmount,
          rate: d.rate,
          tdsAmount: d.tdsAmount,
          challanRef: challan?.internalRef,
          certificateIssued: d.certificateIssued,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      quarter: args.quarter,
      returnType: args.returnType as "24Q" | "26Q" | "27Q",
      rows,
      totalGross: rows.reduce((s, r) => s + r.grossAmount, 0),
      totalTds: rows.reduce((s, r) => s + r.tdsAmount, 0),
      deducteeCount: new Set(deductions.map((d) => d.deducteeId)).size,
      challanCount: new Set(deductions.map((d) => d.challanId).filter(Boolean)).size,
    };
  },
});
