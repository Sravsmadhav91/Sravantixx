import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { effectiveOwnerId, requireUser } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";
import { isValidPan, normalizePan } from "./lib/validators.ts";
import { nextAccountCode } from "./lib/accountCodes.ts";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export type LabourerWithBalance = Doc<"labourers"> & {
  projectName: string | null;
  workTotal: number;
  advanceTotal: number;
  paymentTotal: number;
  balance: number;
};

async function computeBalance(
  ctx: Parameters<typeof requireUser>[0],
  labourerId: Id<"labourers">,
): Promise<{ workTotal: number; advanceTotal: number; paymentTotal: number; balance: number }> {
  const entries = await ctx.db
    .query("labourLedgerEntries")
    .withIndex("by_labourer", (q) => q.eq("labourerId", labourerId))
    .collect();

  let workTotal = 0;
  let advanceTotal = 0;
  let paymentTotal = 0;
  for (const e of entries) {
    if (e.type === "work") workTotal += e.amount;
    else if (e.type === "advance") advanceTotal += e.amount;
    else paymentTotal += e.amount;
  }
  return { workTotal, advanceTotal, paymentTotal, balance: workTotal - advanceTotal - paymentTotal };
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

/**
 * Creates the ledger account representing amounts owed to a labourer/group
 * (liability > payables), so bank reconciliation and other accounting views
 * can post/select it directly like any vendor or buyer account.
 */
export async function createLabourerAccount(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  labourerName: string,
): Promise<Id<"accounts">> {
  const code = await nextAccountCode(ctx, ownerId, "liability");
  return ctx.db.insert("accounts", {
    ownerId,
    code,
    name: `Labour Payable — ${labourerName}`,
    type: "liability",
    group: "payables",
    isSystem: false,
    isActive: true,
  });
}

/** Finds the "Labour Charges" expense account (seeded as code 4002), used for "work done" entries. */
async function getLabourChargesAccountId(ctx: MutationCtx, ownerId: Id<"users">): Promise<Id<"accounts">> {
  const account = await ctx.db
    .query("accounts")
    .withIndex("by_owner_and_code", (q) => q.eq("ownerId", ownerId).eq("code", "4002"))
    .unique();
  if (!account) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Labour Charges account (4002) not found" });
  }
  return account._id;
}

export async function getTdsPayableAccountId(ctx: MutationCtx, ownerId: Id<"users">): Promise<Id<"accounts">> {
  const account = await ctx.db
    .query("accounts")
    .withIndex("by_owner_and_code", (q) => q.eq("ownerId", ownerId).eq("code", "2104"))
    .first();
  if (!account) throw new ConvexError({ code: "NOT_FOUND", message: "TDS Payable account (2104) not found" });
  return account._id;
}

export async function getOrCreateLabourerDeductee(ctx: MutationCtx, ownerId: Id<"users">, labourer: Doc<"labourers">): Promise<Id<"tdsDeductees">> {
  const existing = await ctx.db
    .query("tdsDeductees")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  const matching = existing.find((deductee) => deductee.type === "other" && deductee.name === labourer.name && deductee.pan === labourer.pan);
  if (matching) return matching._id;
  return ctx.db.insert("tdsDeductees", {
    ownerId,
    type: "other",
    name: labourer.name,
    pan: labourer.pan,
    category: "individual",
    isNonResident: false,
    isActive: true,
  });
}

export function tdsQuarterForDate(dateIso: string): string {
  const [year, month] = dateIso.slice(0, 7).split("-").map(Number);
  const fyStart = month >= 4 ? year : year - 1;
  const quarter = month <= 3 ? 4 : month <= 6 ? 1 : month <= 9 ? 2 : 3;
  return `${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}-Q${quarter}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════

export const listLabourers = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<LabourerWithBalance[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    let labourers = await ctx.db
      .query("labourers")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    if (args.activeOnly) {
      labourers = labourers.filter((l) => l.isActive);
    }

    const projectIds = [...new Set(labourers.map((l) => l.projectId).filter((p): p is Id<"projects"> => !!p))];
    const projectMap = new Map<string, string>();
    for (const pid of projectIds) {
      const p = await ctx.db.get("projects", pid);
      if (p) projectMap.set(pid, p.name);
    }

    const results: LabourerWithBalance[] = [];
    for (const l of labourers) {
      const totals = await computeBalance(ctx, l._id);
      results.push({
        ...l,
        projectName: l.projectId ? projectMap.get(l.projectId) ?? null : null,
        ...totals,
      });
    }
    return results.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const getLabourer = query({
  args: { labourerId: v.id("labourers") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const labourer = await ctx.db.get("labourers", args.labourerId);
    if (!labourer || labourer.ownerId !== ownerId) return null;

    const entries = await ctx.db
      .query("labourLedgerEntries")
      .withIndex("by_labourer", (q) => q.eq("labourerId", args.labourerId))
      .order("desc")
      .collect();

    const totals = await computeBalance(ctx, args.labourerId);
    const project = labourer.projectId ? await ctx.db.get("projects", labourer.projectId) : null;

    return { labourer, project, entries, ...totals };
  },
});

/** Search active labourers for the bank reconciliation "Link Labourer" dialog. */
export const searchLabourersForLink = query({
  args: { search: v.string() },
  handler: async (ctx, args): Promise<Array<{ _id: Id<"labourers">; name: string; skill?: string; balance: number }>> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const all = await ctx.db
      .query("labourers")
      .withIndex("by_owner_and_active", (q) => q.eq("ownerId", ownerId).eq("isActive", true))
      .collect();
    const search = args.search.trim().toLowerCase();
    const filtered = search
      ? all.filter((l) => l.name.toLowerCase().includes(search))
      : all;
    const results = [];
    for (const l of filtered.slice(0, 20)) {
      const { balance } = await computeBalance(ctx, l._id);
      results.push({ _id: l._id, name: l.name, skill: l.skill, balance });
    }
    return results;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const createLabourer = mutation({
  args: {
    name: v.string(),
    type: v.union(v.literal("individual"), v.literal("group")),
    memberCount: v.number(),
    phone: v.optional(v.string()),
    skill: v.optional(v.string()),
    pan: v.string(),
    projectId: v.optional(v.id("projects")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"labourers">> => {
    const user = await requireModuleAccess(ctx, "labour");
    const ownerId = effectiveOwnerId(user);
    if (!isValidPan(args.pan)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Enter a valid PAN (e.g. ABCDE1234F)" });
    }
    if (args.projectId) {
      const project = await ctx.db.get("projects", args.projectId);
      if (!project || project.ownerId !== ownerId) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Project not found" });
      }
    }
    const accountId = await createLabourerAccount(ctx, ownerId, args.name);
    return ctx.db.insert("labourers", { ownerId, isActive: true, ...args, pan: normalizePan(args.pan), accountId });
  },
});

export const updateLabourer = mutation({
  args: {
    labourerId: v.id("labourers"),
    name: v.optional(v.string()),
    memberCount: v.optional(v.number()),
    phone: v.optional(v.string()),
    skill: v.optional(v.string()),
    pan: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "labour");
    const ownerId = effectiveOwnerId(user);
    const { labourerId, ...patch } = args;
    const labourer = await ctx.db.get("labourers", labourerId);
    if (!labourer || labourer.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Labourer not found" });
    }
    if (patch.pan !== undefined) {
      if (!isValidPan(patch.pan)) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Enter a valid PAN (e.g. ABCDE1234F)" });
      }
      patch.pan = normalizePan(patch.pan);
    }
    await ctx.db.patch("labourers", labourerId, patch);
    // Keep the ledger account name in sync with the labourer's display name.
    if (patch.name !== undefined && labourer.accountId) {
      await ctx.db.patch("accounts", labourer.accountId, { name: `Labour Payable — ${patch.name}` });
    }
  },
});

export const deleteLabourer = mutation({
  args: { labourerId: v.id("labourers") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "labour");
    const ownerId = effectiveOwnerId(user);
    const labourer = await ctx.db.get("labourers", args.labourerId);
    if (!labourer || labourer.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Labourer not found" });
    }
    let batch = await ctx.db
      .query("labourLedgerEntries")
      .withIndex("by_labourer", (q) => q.eq("labourerId", args.labourerId))
      .take(200);
    while (batch.length > 0) {
      for (const entry of batch) {
        if (entry.journalEntryId) {
          await ctx.db.patch("journalEntries", entry.journalEntryId, { status: "cancelled" });
        }
        await ctx.db.delete("labourLedgerEntries", entry._id);
      }
      batch = await ctx.db
        .query("labourLedgerEntries")
        .withIndex("by_labourer", (q) => q.eq("labourerId", args.labourerId))
        .take(200);
    }
    // Deactivate rather than delete the ledger account — journal lines may still reference it.
    if (labourer.accountId) {
      await ctx.db.patch("accounts", labourer.accountId, { isActive: false });
    }
    await ctx.db.delete("labourers", args.labourerId);
  },
});

export const addLedgerEntry = mutation({
  args: {
    labourerId: v.id("labourers"),
    type: v.union(v.literal("work"), v.literal("advance"), v.literal("payment")),
    date: v.string(),
    amount: v.number(),
    projectId: v.optional(v.id("projects")),
    description: v.optional(v.string()),
    /** Bank/cash account the advance or payment was paid from. Required for "advance" and "payment". */
    sourceAccountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args): Promise<Id<"labourLedgerEntries">> => {
    const user = await requireModuleAccess(ctx, "labour");
    const ownerId = effectiveOwnerId(user);
    const labourer = await ctx.db.get("labourers", args.labourerId);
    if (!labourer || labourer.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Labourer not found" });
    }
    if (args.amount <= 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Amount must be greater than zero" });
    }
    if (args.type !== "work" && !args.sourceAccountId) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Select the bank/cash account this was paid from" });
    }

    const tdsSection = args.type === "payment" ? "194C" : undefined;
    const tdsRate = args.type === "payment" ? 1 : 0;
    const tdsAmount = args.type === "payment" ? Math.round(args.amount * (tdsRate / 100)) : 0;
    const bankAmount = args.amount - tdsAmount;
    const tdsPayableAccountId = tdsAmount > 0 ? await getTdsPayableAccountId(ctx, ownerId) : undefined;

    // Ensure the labourer has a ledger account even if they pre-date this feature.
    let accountId = labourer.accountId;
    if (!accountId) {
      accountId = await createLabourerAccount(ctx, ownerId, labourer.name);
      await ctx.db.patch("labourers", args.labourerId, { accountId });
    }

    const entryNumber = await getNextEntryNumber(ctx, ownerId);
    const narration = args.description ?? `${args.type === "work" ? "Work done" : args.type === "advance" ? "Advance" : "Payment"} — ${labourer.name}`;
    let journalEntryId: Id<"journalEntries">;

    if (args.type === "work") {
      const expenseAccountId = await getLabourChargesAccountId(ctx, ownerId);
      journalEntryId = await ctx.db.insert("journalEntries", {
        ownerId, entryNumber, date: args.date, narration, status: "posted",
        source: "labour", sourceId: undefined, totalAmount: args.amount,
      });
      await ctx.db.insert("journalLines", { ownerId, journalEntryId, accountId: expenseAccountId, side: "debit", amount: args.amount, projectId: args.projectId, narration });
      await ctx.db.insert("journalLines", { ownerId, journalEntryId, accountId, side: "credit", amount: args.amount, projectId: args.projectId, narration });
    } else {
      // Advance or payment: reduces what we owe them (Dr their payable), paid from a bank/cash account (Cr).
      journalEntryId = await ctx.db.insert("journalEntries", {
        ownerId, entryNumber, date: args.date, narration, status: "posted",
        source: "labour", sourceId: undefined, totalAmount: args.amount,
      });
      await ctx.db.insert("journalLines", { ownerId, journalEntryId, accountId, side: "debit", amount: args.amount, projectId: args.projectId, narration });
      await ctx.db.insert("journalLines", { ownerId, journalEntryId, accountId: args.sourceAccountId as Id<"accounts">, side: "credit", amount: bankAmount, projectId: args.projectId, narration });
      if (tdsPayableAccountId) {
        await ctx.db.insert("journalLines", { ownerId, journalEntryId, accountId: tdsPayableAccountId, side: "credit", amount: tdsAmount, projectId: args.projectId, narration: "TDS Payable — 194C" });
      }
    }

    const entryId = await ctx.db.insert("labourLedgerEntries", { ownerId, ...args, journalEntryId, tdsSection, tdsRate: tdsAmount > 0 ? tdsRate : undefined, tdsAmount: tdsAmount > 0 ? tdsAmount : undefined });
    if (tdsAmount > 0) {
      const deducteeId = await getOrCreateLabourerDeductee(ctx, ownerId, labourer);
      await ctx.db.insert("tdsDeductions", {
        ownerId,
        deducteeId,
        section: "194C",
        returnType: "26Q",
        date: args.date,
        quarter: tdsQuarterForDate(args.date),
        grossAmount: args.amount,
        rate: tdsRate,
        tdsAmount,
        sourceType: "labour_payment",
        sourceId: entryId,
        certificateIssued: false,
        notes: `Automatic TDS from labour payment — ${labourer.name}`,
      });
    }
    return entryId;
  },
});

export const deleteLedgerEntry = mutation({
  args: { entryId: v.id("labourLedgerEntries") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "labour");
    const ownerId = effectiveOwnerId(user);
    const entry = await ctx.db.get("labourLedgerEntries", args.entryId);
    if (!entry || entry.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Entry not found" });
    }
    if (entry.journalEntryId) {
      await ctx.db.patch("journalEntries", entry.journalEntryId, { status: "cancelled" });
    }
    await ctx.db.delete("labourLedgerEntries", args.entryId);
  },
});

/**
 * One-time backfill: creates a ledger account for any existing labourer/group
 * that predates this feature and doesn't have one yet.
 */
export const backfillLabourerAccounts = mutation({
  args: {},
  handler: async (ctx): Promise<{ created: number }> => {
    const user = await requireModuleAccess(ctx, "labour");
    const ownerId = effectiveOwnerId(user);
    const labourers = await ctx.db
      .query("labourers")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    let created = 0;
    for (const l of labourers) {
      if (!l.accountId) {
        const accountId = await createLabourerAccount(ctx, ownerId, l.name);
        await ctx.db.patch("labourers", l._id, { accountId });
        created++;
      }
    }
    return { created };
  },
});
