import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { effectiveOwnerId, requireOwner, requireUser } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";
import { isValidPan, normalizePan } from "./lib/validators.ts";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// ── Helper: next PI ref ────────────────────────────────────────────────────

async function getNextInvoiceRef(
  ctx: MutationCtx,
  ownerId: Id<"users">,
): Promise<string> {
  const last = await ctx.db
    .query("purchaseInvoices")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .first();
  const year = new Date().getFullYear();
  if (!last) return `PI-${year}-001`;
  const match = last.internalRef.match(/PI-\d{4}-(\d+)$/);
  const seq = match ? parseInt(match[1], 10) + 1 : 1;
  return `PI-${year}-${String(seq).padStart(3, "0")}`;
}

// ── Helper: find account by code ───────────────────────────────────────────

export async function findAccountByCode(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"users">,
  code: string,
): Promise<Id<"accounts"> | null> {
  const account = await ctx.db
    .query("accounts")
    .withIndex("by_owner_and_code", (q) => q.eq("ownerId", ownerId).eq("code", code))
    .first();
  return account?._id ?? null;
}

/**
 * Finds the "GST Expense on Purchases" account (4006) by code, creating it if
 * this owner's chart of accounts predates it (e.g. seeded before this account
 * existed in DEFAULT_ACCOUNTS).
 */
async function ensureGstExpenseAccount(
  ctx: MutationCtx,
  ownerId: Id<"users">,
): Promise<Id<"accounts">> {
  const existing = await findAccountByCode(ctx, ownerId, "4006");
  if (existing) return existing;
  return await ctx.db.insert("accounts", {
    ownerId,
    code: "4006",
    name: "GST Expense on Purchases",
    type: "expense",
    group: "direct_expenses",
    isSystem: false,
    isActive: true,
  });
}

// ── Helper: next journal entry number ─────────────────────────────────────

async function getNextEntryNumber(
  ctx: MutationCtx,
  ownerId: Id<"users">,
): Promise<string> {
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
// VENDORS
// ═══════════════════════════════════════════════════════════════════════════

export const listVendors = query({
  args: {
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Doc<"vendors">[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    let vendors = await ctx.db
      .query("vendors")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();

    if (args.active !== undefined) {
      vendors = vendors.filter((v) => v.isActive === args.active);
    }
    if (args.category) {
      vendors = vendors.filter((v) => v.category === args.category);
    }
    if (args.search) {
      const q = args.search.toLowerCase();
      vendors = vendors.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          (v.gstin ?? "").toLowerCase().includes(q) ||
          (v.pan ?? "").toLowerCase().includes(q),
      );
    }
    return vendors.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const getVendor = query({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, args): Promise<Doc<"vendors"> | null> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const vendor = await ctx.db.get("vendors", args.vendorId);
    if (!vendor || vendor.ownerId !== ownerId) return null;
    return vendor;
  },
});

export const createVendor = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    gstin: v.optional(v.string()),
    pan: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    pincode: v.optional(v.string()),
    bankAccount: v.optional(v.string()),
    bankIfsc: v.optional(v.string()),
    bankName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"vendors">> => {
    const user = await requireModuleAccess(ctx, "payables");
    const ownerId = effectiveOwnerId(user);
    if (args.pan && !isValidPan(args.pan)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Enter a valid PAN (e.g. ABCDE1234F)" });
    }
    return await ctx.db.insert("vendors", {
      ...args,
      pan: args.pan ? normalizePan(args.pan) : undefined,
      ownerId,
      isActive: true,
    });
  },
});

export const updateVendor = mutation({
  args: {
    vendorId: v.id("vendors"),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    gstin: v.optional(v.string()),
    pan: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    pincode: v.optional(v.string()),
    bankAccount: v.optional(v.string()),
    bankIfsc: v.optional(v.string()),
    bankName: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "payables");
    const ownerId = effectiveOwnerId(user);
    const { vendorId, ...patch } = args;
    const vendor = await ctx.db.get("vendors", vendorId);
    if (!vendor || vendor.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Vendor not found" });
    }
    if (patch.pan !== undefined) {
      if (patch.pan && !isValidPan(patch.pan)) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Enter a valid PAN (e.g. ABCDE1234F)" });
      }
      patch.pan = patch.pan ? normalizePan(patch.pan) : undefined;
    }
    await ctx.db.patch("vendors", vendorId, patch);
  },
});

export const deleteVendor = mutation({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireOwner(ctx);
    const ownerId = effectiveOwnerId(user);
    const vendor = await ctx.db.get("vendors", args.vendorId);
    if (!vendor || vendor.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Vendor not found" });
    }
    // Check for invoices
    const invoice = await ctx.db
      .query("purchaseInvoices")
      .withIndex("by_owner_and_vendor", (q) =>
        q.eq("ownerId", ownerId).eq("vendorId", args.vendorId),
      )
      .first();
    if (invoice) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Cannot delete vendor with invoices. Deactivate instead.",
      });
    }
    await ctx.db.delete("vendors", args.vendorId);
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// PURCHASE INVOICES
// ═══════════════════════════════════════════════════════════════════════════

type PurchaseInvoiceLine = {
  description: string;
  accountId?: Id<"accounts">;
  quantity: number;
  unit?: string;
  rate: number;
  amount: number;
  gstRate?: number;
};

export const listPurchaseInvoices = query({
  args: {
    vendorId: v.optional(v.id("vendors")),
    status: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    let invoices: Doc<"purchaseInvoices">[];

    if (args.vendorId) {
      invoices = await ctx.db
        .query("purchaseInvoices")
        .withIndex("by_owner_and_vendor", (q) =>
          q.eq("ownerId", ownerId).eq("vendorId", args.vendorId!),
        )
        .order("desc")
        .take(args.limit ?? 200);
    } else {
      invoices = await ctx.db
        .query("purchaseInvoices")
        .withIndex("by_owner_and_date", (q) => {
          const q2 = q.eq("ownerId", ownerId);
          if (args.fromDate) return q2.gte("date", args.fromDate);
          return q2;
        })
        .order("desc")
        .take(args.limit ?? 200);
    }

    if (args.toDate) invoices = invoices.filter((i) => i.date <= args.toDate!);
    if (args.status) invoices = invoices.filter((i) => i.status === args.status);
    if (args.projectId) invoices = invoices.filter((i) => i.projectId === args.projectId);

    // Attach vendor name
    const vendorIds = [...new Set(invoices.map((i) => i.vendorId))];
    const vendorMap = new Map<string, string>();
    for (const vid of vendorIds) {
      const v = await ctx.db.get("vendors", vid);
      if (v) vendorMap.set(vid, v.name);
    }

    return invoices.map((i) => ({
      ...i,
      vendorName: vendorMap.get(i.vendorId) ?? "Unknown",
      outstanding: i.total - i.amountPaid,
    }));
  },
});

export const getPurchaseInvoice = query({
  args: { invoiceId: v.id("purchaseInvoices") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const invoice = await ctx.db.get("purchaseInvoices", args.invoiceId);
    if (!invoice || invoice.ownerId !== ownerId) return null;

    const vendor = await ctx.db.get("vendors", invoice.vendorId);
    const lines = await ctx.db
      .query("purchaseInvoiceLines")
      .withIndex("by_invoice", (q) => q.eq("purchaseInvoiceId", args.invoiceId))
      .collect();

    const linesWithAccount = await Promise.all(
      lines.map(async (line) => ({
        ...line,
        accountName: line.accountId
          ? (await ctx.db.get("accounts", line.accountId))?.name
          : undefined,
      })),
    );

    return { invoice, vendor, lines: linesWithAccount };
  },
});

export const createPurchaseInvoice = mutation({
  args: {
    vendorId: v.id("vendors"),
    invoiceNumber: v.string(),
    date: v.string(),
    dueDate: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    narration: v.optional(v.string()),
    lines: v.array(
      v.object({
        description: v.string(),
        accountId: v.optional(v.id("accounts")),
        quantity: v.number(),
        unit: v.optional(v.string()),
        rate: v.number(),
        amount: v.number(),
        gstRate: v.optional(v.number()),
      }),
    ),
    cgst: v.number(),
    sgst: v.number(),
    igst: v.number(),
    tds: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"purchaseInvoices">> => {
    const user = await requireModuleAccess(ctx, "payables");
    const ownerId = effectiveOwnerId(user);

    const vendor = await ctx.db.get("vendors", args.vendorId);
    if (!vendor || vendor.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Vendor not found" });
    }

    const subtotal = args.lines.reduce((s, l) => s + l.amount, 0);
    const total = subtotal + args.cgst + args.sgst + args.igst - args.tds;
    const internalRef = await getNextInvoiceRef(ctx, ownerId);

    const invoiceId = await ctx.db.insert("purchaseInvoices", {
      ownerId,
      vendorId: args.vendorId,
      invoiceNumber: args.invoiceNumber,
      internalRef,
      date: args.date,
      dueDate: args.dueDate,
      status: "draft",
      projectId: args.projectId,
      narration: args.narration,
      subtotal,
      cgst: args.cgst,
      sgst: args.sgst,
      igst: args.igst,
      tds: args.tds,
      total,
      amountPaid: 0,
    });

    for (const line of args.lines) {
      await ctx.db.insert("purchaseInvoiceLines", {
        ownerId,
        purchaseInvoiceId: invoiceId,
        ...line,
      });
    }

    return invoiceId;
  },
});

export const updatePurchaseInvoice = mutation({
  args: {
    invoiceId: v.id("purchaseInvoices"),
    invoiceNumber: v.optional(v.string()),
    date: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    narration: v.optional(v.string()),
    lines: v.optional(
      v.array(
        v.object({
          description: v.string(),
          accountId: v.optional(v.id("accounts")),
          quantity: v.number(),
          unit: v.optional(v.string()),
          rate: v.number(),
          amount: v.number(),
          gstRate: v.optional(v.number()),
        }),
      ),
    ),
    cgst: v.optional(v.number()),
    sgst: v.optional(v.number()),
    igst: v.optional(v.number()),
    tds: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "payables");
    const ownerId = effectiveOwnerId(user);
    const invoice = await ctx.db.get("purchaseInvoices", args.invoiceId);
    if (!invoice || invoice.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Invoice not found" });
    }
    if (invoice.status !== "draft") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Only draft invoices can be edited" });
    }

    const { invoiceId, lines, ...patch } = args;

    // Recompute totals if lines provided
    if (lines) {
      const subtotal = lines.reduce((s, l) => s + l.amount, 0);
      const cgst = patch.cgst ?? invoice.cgst;
      const sgst = patch.sgst ?? invoice.sgst;
      const igst = patch.igst ?? invoice.igst;
      const tds = patch.tds ?? invoice.tds;
      const total = subtotal + cgst + sgst + igst - tds;

      await ctx.db.patch("purchaseInvoices", invoiceId, { ...patch, subtotal, total });

      // Replace lines
      const existingLines = await ctx.db
        .query("purchaseInvoiceLines")
        .withIndex("by_invoice", (q) => q.eq("purchaseInvoiceId", invoiceId))
        .collect();
      for (const l of existingLines) await ctx.db.delete("purchaseInvoiceLines", l._id);
      for (const line of lines) {
        await ctx.db.insert("purchaseInvoiceLines", { ownerId, purchaseInvoiceId: invoiceId, ...line });
      }
    } else {
      await ctx.db.patch("purchaseInvoices", invoiceId, patch);
    }
  },
});

export const approvePurchaseInvoice = mutation({
  args: { invoiceId: v.id("purchaseInvoices") },
  handler: async (ctx, args): Promise<Id<"journalEntries">> => {
    const user = await requireModuleAccess(ctx, "payables");
    const ownerId = effectiveOwnerId(user);
    const invoice = await ctx.db.get("purchaseInvoices", args.invoiceId);
    if (!invoice || invoice.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Invoice not found" });
    }
    if (invoice.status !== "draft") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Only draft invoices can be approved" });
    }

    // Find lines + accounts
    const lines = await ctx.db
      .query("purchaseInvoiceLines")
      .withIndex("by_invoice", (q) => q.eq("purchaseInvoiceId", args.invoiceId))
      .collect();

    const vendor = await ctx.db.get("vendors", invoice.vendorId);

    // Default accounts for auto-JE:
    // Expense Dr: line accountId or "4001" (Construction Materials)
    // GST Expense on Purchases Dr: "4006" (GST is expensed, not held as a recoverable credit)
    // TDS Payable Cr: "2104"
    // Vendor Payable Cr: "2001"

    const vendorPayableId = await findAccountByCode(ctx, ownerId, "2001");
    const gstExpenseId = await ensureGstExpenseAccount(ctx, ownerId);
    const tdsPayableId = await findAccountByCode(ctx, ownerId, "2104");
    const defaultExpenseId = await findAccountByCode(ctx, ownerId, "4001");

    if (!vendorPayableId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Vendor Payables account (2001) not found. Ensure accounts are seeded." });
    }

    const jeLines: Array<{ accountId: Id<"accounts">; side: "debit" | "credit"; amount: number; narration?: string }> = [];

    // Debit each expense line (a negative amount, e.g. from an imported credit
    // note, flips to a credit so the entry still balances)
    for (const line of lines) {
      const acctId = line.accountId ?? defaultExpenseId;
      if (!acctId || line.amount === 0) continue;
      jeLines.push({
        accountId: acctId,
        side: line.amount > 0 ? "debit" : "credit",
        amount: Math.abs(line.amount),
        narration: line.description,
      });
    }

    // Debit GST as an expense (also flips to credit for a negative/credit-note invoice)
    const totalGst = invoice.cgst + invoice.sgst + invoice.igst;
    if (totalGst !== 0) {
      jeLines.push({
        accountId: gstExpenseId,
        side: totalGst > 0 ? "debit" : "credit",
        amount: Math.abs(totalGst),
        narration: "GST Expense on Purchases",
      });
    }

    // Credit TDS Payable if any
    if (invoice.tds > 0 && tdsPayableId) {
      jeLines.push({ accountId: tdsPayableId, side: "credit", amount: invoice.tds, narration: "TDS Deducted" });
    }

    // Credit Vendor Payable for full total (a negative total, from a credit
    // note, flips to a debit — it reduces what's owed to the vendor)
    jeLines.push({
      accountId: vendorPayableId,
      side: invoice.total >= 0 ? "credit" : "debit",
      amount: Math.abs(invoice.total),
      narration: `${vendor?.name ?? "Vendor"} — ${invoice.invoiceNumber}`,
    });

    const totalDebit = jeLines.filter((l) => l.side === "debit").reduce((s, l) => s + l.amount, 0);
    const totalCredit = jeLines.filter((l) => l.side === "credit").reduce((s, l) => s + l.amount, 0);

    // Validate balance
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Journal entry imbalanced: Dr ${totalDebit.toFixed(2)} vs Cr ${totalCredit.toFixed(2)}. Check expense accounts.`,
      });
    }

    const entryNumber = await getNextEntryNumber(ctx, ownerId);
    const jeId = await ctx.db.insert("journalEntries", {
      ownerId,
      entryNumber,
      date: invoice.date,
      narration: `Purchase Invoice ${invoice.internalRef} — ${vendor?.name ?? "Vendor"}`,
      status: "posted",
      source: "purchase_invoice",
      sourceId: args.invoiceId,
      reference: invoice.invoiceNumber,
      totalAmount: totalDebit,
    });

    for (const line of jeLines) {
      await ctx.db.insert("journalLines", { ownerId, journalEntryId: jeId, ...line });
    }

    // Update invoice
    await ctx.db.patch("purchaseInvoices", args.invoiceId, {
      status: "approved",
      journalEntryId: jeId,
    });

    return jeId;
  },
});

/**
 * One-time cleanup: moves already-posted purchase-invoice GST amounts off the
 * "GST Input Credit" asset account (1202) onto the "GST Expense on Purchases"
 * expense account (4006), so GST on purchases is treated as expensed rather
 * than a recoverable credit — matching the new behavior in approvePurchaseInvoice.
 * Only touches journal lines created by purchase invoice approval (source
 * "purchase_invoice"); safe to run more than once (no-op once nothing is left
 * on account 1202 from purchase invoices).
 */
export const reclassifyGstInputCreditToExpense = mutation({
  args: {},
  handler: async (ctx): Promise<{ reclassified: number }> => {
    const user = await requireOwner(ctx);
    const ownerId = effectiveOwnerId(user);

    const gstInputId = await findAccountByCode(ctx, ownerId, "1202");
    if (!gstInputId) return { reclassified: 0 };
    const gstExpenseId = await ensureGstExpenseAccount(ctx, ownerId);

    const linesOnGstInput = await ctx.db
      .query("journalLines")
      .withIndex("by_account", (q) => q.eq("accountId", gstInputId))
      .collect();

    let reclassified = 0;
    for (const line of linesOnGstInput) {
      if (line.ownerId !== ownerId) continue;
      const entry = await ctx.db.get("journalEntries", line.journalEntryId);
      if (!entry || entry.source !== "purchase_invoice") continue;
      await ctx.db.patch("journalLines", line._id, { accountId: gstExpenseId });
      reclassified++;
    }
    return { reclassified };
  },
});

export const recordPayment = mutation({
  args: {
    invoiceId: v.id("purchaseInvoices"),
    amount: v.number(),
    date: v.string(),
    reference: v.optional(v.string()),
    /** Bank/cash account to credit. Defaults to "1002" Bank Account Primary */
    paymentAccountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "payables");
    const ownerId = effectiveOwnerId(user);
    const invoice = await ctx.db.get("purchaseInvoices", args.invoiceId);
    if (!invoice || invoice.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Invoice not found" });
    }
    if (invoice.status === "draft" || invoice.status === "cancelled") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Invoice must be approved before recording payment" });
    }

    const outstanding = invoice.total - invoice.amountPaid;
    if (args.amount > outstanding + 0.01) {
      throw new ConvexError({ code: "BAD_REQUEST", message: `Payment amount (${args.amount}) exceeds outstanding (${outstanding})` });
    }

    const vendorPayableId = await findAccountByCode(ctx, ownerId, "2001");
    const bankAccountId = args.paymentAccountId ?? await findAccountByCode(ctx, ownerId, "1002");

    if (!vendorPayableId || !bankAccountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Required accounts not found" });
    }

    const vendor = await ctx.db.get("vendors", invoice.vendorId);
    const entryNumber = await getNextEntryNumber(ctx, ownerId);
    const jeId = await ctx.db.insert("journalEntries", {
      ownerId,
      entryNumber,
      date: args.date,
      narration: `Payment for ${invoice.internalRef} — ${vendor?.name ?? "Vendor"}`,
      status: "posted",
      source: "purchase_invoice",
      sourceId: args.invoiceId,
      reference: args.reference,
      totalAmount: args.amount,
    });

    // Debit Vendor Payable (reduces liability), Credit Bank
    await ctx.db.insert("journalLines", { ownerId, journalEntryId: jeId, accountId: vendorPayableId, side: "debit", amount: args.amount });
    await ctx.db.insert("journalLines", { ownerId, journalEntryId: jeId, accountId: bankAccountId, side: "credit", amount: args.amount });

    const newAmountPaid = invoice.amountPaid + args.amount;
    const newStatus = newAmountPaid >= invoice.total - 0.01 ? "paid" : "approved";
    await ctx.db.patch("purchaseInvoices", args.invoiceId, {
      amountPaid: newAmountPaid,
      status: newStatus as "approved" | "paid",
    });
  },
});

export const cancelPurchaseInvoice = mutation({
  args: { invoiceId: v.id("purchaseInvoices") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireOwner(ctx);
    const ownerId = effectiveOwnerId(user);
    const invoice = await ctx.db.get("purchaseInvoices", args.invoiceId);
    if (!invoice || invoice.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Invoice not found" });
    }
    if (invoice.status === "paid") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot cancel a fully paid invoice" });
    }
    // If journal entry exists, cancel it
    if (invoice.journalEntryId) {
      await ctx.db.patch("journalEntries", invoice.journalEntryId, { status: "cancelled" });
    }
    await ctx.db.patch("purchaseInvoices", args.invoiceId, { status: "cancelled" });
  },
});

// ── Vendor Ledger ─────────────────────────────────────────────────────────

export const getVendorLedger = query({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const vendor = await ctx.db.get("vendors", args.vendorId);
    if (!vendor || vendor.ownerId !== ownerId) return null;

    const invoices = await ctx.db
      .query("purchaseInvoices")
      .withIndex("by_owner_and_vendor", (q) =>
        q.eq("ownerId", ownerId).eq("vendorId", args.vendorId),
      )
      .order("desc")
      .collect();

    const today = new Date();
    const agingSummary = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    let totalOutstanding = 0;

    const rows = invoices
      .filter((i) => i.status !== "cancelled")
      .map((i) => {
        const outstanding = i.total - i.amountPaid;
        if (outstanding > 0.01 && i.dueDate) {
          const due = new Date(i.dueDate);
          const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);
          if (daysOverdue <= 0) agingSummary.current += outstanding;
          else if (daysOverdue <= 30) agingSummary.days30 += outstanding;
          else if (daysOverdue <= 60) agingSummary.days60 += outstanding;
          else if (daysOverdue <= 90) agingSummary.days90 += outstanding;
          else agingSummary.over90 += outstanding;
        }
        totalOutstanding += outstanding;
        return { ...i, outstanding };
      });

    return { vendor, invoices: rows, agingSummary, totalOutstanding };
  },
});

// ── AP Aging Summary ─────────────────────────────────────────────────────

export const getApAgingSummary = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    const invoices = await ctx.db
      .query("purchaseInvoices")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();

    const vendorMap = new Map<string, { name: string; current: number; days30: number; days60: number; days90: number; over90: number; total: number }>();
    const today = new Date();

    for (const inv of invoices) {
      if (inv.status === "cancelled" || inv.status === "paid") continue;
      const outstanding = inv.total - inv.amountPaid;
      if (outstanding <= 0.01) continue;

      if (!vendorMap.has(inv.vendorId)) {
        const v = await ctx.db.get("vendors", inv.vendorId);
        vendorMap.set(inv.vendorId, { name: v?.name ?? "Unknown", current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 });
      }
      const entry = vendorMap.get(inv.vendorId)!;
      entry.total += outstanding;

      if (inv.dueDate) {
        const due = new Date(inv.dueDate);
        const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);
        if (daysOverdue <= 0) entry.current += outstanding;
        else if (daysOverdue <= 30) entry.days30 += outstanding;
        else if (daysOverdue <= 60) entry.days60 += outstanding;
        else if (daysOverdue <= 90) entry.days90 += outstanding;
        else entry.over90 += outstanding;
      } else {
        entry.current += outstanding;
      }
    }

    return Array.from(vendorMap.entries()).map(([vendorId, data]) => ({ vendorId, ...data }));
  },
});
