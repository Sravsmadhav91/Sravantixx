import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { effectiveOwnerId, requireOwner, requireUser } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

// ── Helpers ────────────────────────────────────────────────────────────────

async function getNextPoNumber(ctx: MutationCtx, ownerId: Id<"users">): Promise<string> {
  const last = await ctx.db
    .query("purchaseOrders")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .first();
  const year = new Date().getFullYear();
  if (!last) return `PO-${year}-001`;
  const match = last.poNumber.match(/PO-\d{4}-(\d+)$/);
  const seq = match ? parseInt(match[1], 10) + 1 : 1;
  return `PO-${year}-${String(seq).padStart(3, "0")}`;
}

async function getNextInvoiceRef(ctx: MutationCtx, ownerId: Id<"users">): Promise<string> {
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

// ═══════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════

export const listPurchaseOrders = query({
  args: {
    vendorId: v.optional(v.id("vendors")),
    status: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    let orders: Doc<"purchaseOrders">[];

    if (args.vendorId) {
      orders = await ctx.db
        .query("purchaseOrders")
        .withIndex("by_owner_and_vendor", (q) =>
          q.eq("ownerId", ownerId).eq("vendorId", args.vendorId!),
        )
        .order("desc")
        .take(args.limit ?? 200);
    } else {
      orders = await ctx.db
        .query("purchaseOrders")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .order("desc")
        .take(args.limit ?? 200);
    }

    if (args.status) orders = orders.filter((o) => o.status === args.status);
    if (args.projectId) orders = orders.filter((o) => o.projectId === args.projectId);

    const vendorIds = [...new Set(orders.map((o) => o.vendorId))];
    const vendorMap = new Map<string, string>();
    for (const vid of vendorIds) {
      const vendor = await ctx.db.get("vendors", vid);
      if (vendor) vendorMap.set(vid, vendor.name);
    }

    return orders.map((o) => ({
      ...o,
      vendorName: vendorMap.get(o.vendorId) ?? "Unknown",
    }));
  },
});

export const getPurchaseOrder = query({
  args: { poId: v.id("purchaseOrders") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const po = await ctx.db.get("purchaseOrders", args.poId);
    if (!po || po.ownerId !== ownerId) return null;

    const vendor = await ctx.db.get("vendors", po.vendorId);
    const lines = await ctx.db
      .query("purchaseOrderLines")
      .withIndex("by_po", (q) => q.eq("purchaseOrderId", args.poId))
      .collect();

    const linesWithAccount = await Promise.all(
      lines.map(async (line) => ({
        ...line,
        accountName: line.accountId
          ? (await ctx.db.get("accounts", line.accountId))?.name
          : undefined,
      })),
    );

    const project = po.projectId ? await ctx.db.get("projects", po.projectId) : null;

    return { po, vendor, lines: linesWithAccount, projectName: project?.name };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════

const lineValidator = v.object({
  description: v.string(),
  accountId: v.optional(v.id("accounts")),
  quantity: v.number(),
  unit: v.optional(v.string()),
  rate: v.number(),
  amount: v.number(),
  gstRate: v.optional(v.number()),
});

export const createPurchaseOrder = mutation({
  args: {
    vendorId: v.id("vendors"),
    date: v.string(),
    expectedDeliveryDate: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    narration: v.optional(v.string()),
    lines: v.array(lineValidator),
    cgst: v.number(),
    sgst: v.number(),
    igst: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"purchaseOrders">> => {
    const user = await requireModuleAccess(ctx, "payables");
    const ownerId = effectiveOwnerId(user);

    const vendor = await ctx.db.get("vendors", args.vendorId);
    if (!vendor || vendor.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Vendor not found" });
    }

    const subtotal = args.lines.reduce((s, l) => s + l.amount, 0);
    const total = subtotal + args.cgst + args.sgst + args.igst;
    const poNumber = await getNextPoNumber(ctx, ownerId);

    const poId = await ctx.db.insert("purchaseOrders", {
      ownerId,
      vendorId: args.vendorId,
      poNumber,
      date: args.date,
      expectedDeliveryDate: args.expectedDeliveryDate,
      status: "draft",
      projectId: args.projectId,
      narration: args.narration,
      subtotal,
      cgst: args.cgst,
      sgst: args.sgst,
      igst: args.igst,
      total,
    });

    for (const line of args.lines) {
      await ctx.db.insert("purchaseOrderLines", { ownerId, purchaseOrderId: poId, ...line });
    }

    return poId;
  },
});

export const updatePurchaseOrder = mutation({
  args: {
    poId: v.id("purchaseOrders"),
    vendorId: v.optional(v.id("vendors")),
    date: v.optional(v.string()),
    expectedDeliveryDate: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    narration: v.optional(v.string()),
    lines: v.optional(v.array(lineValidator)),
    cgst: v.optional(v.number()),
    sgst: v.optional(v.number()),
    igst: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "payables");
    const ownerId = effectiveOwnerId(user);
    const po = await ctx.db.get("purchaseOrders", args.poId);
    if (!po || po.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Purchase order not found" });
    }
    if (po.status !== "draft") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Only draft purchase orders can be edited" });
    }

    const { poId, lines, ...patch } = args;

    if (lines) {
      const subtotal = lines.reduce((s, l) => s + l.amount, 0);
      const cgst = patch.cgst ?? po.cgst;
      const sgst = patch.sgst ?? po.sgst;
      const igst = patch.igst ?? po.igst;
      const total = subtotal + cgst + sgst + igst;

      await ctx.db.patch("purchaseOrders", poId, { ...patch, subtotal, total });

      const existingLines = await ctx.db
        .query("purchaseOrderLines")
        .withIndex("by_po", (q) => q.eq("purchaseOrderId", poId))
        .collect();
      for (const l of existingLines) await ctx.db.delete("purchaseOrderLines", l._id);
      for (const line of lines) {
        await ctx.db.insert("purchaseOrderLines", { ownerId, purchaseOrderId: poId, ...line });
      }
    } else {
      await ctx.db.patch("purchaseOrders", poId, patch);
    }
  },
});

export const updatePurchaseOrderStatus = mutation({
  args: {
    poId: v.id("purchaseOrders"),
    status: v.union(
      v.literal("sent"),
      v.literal("partially_received"),
      v.literal("received"),
      v.literal("cancelled"),
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "payables");
    if (args.status === "sent" && user.role && user.role !== "owner" && user.role !== "project_manager") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the owner or project manager can approve a purchase order" });
    }
    const ownerId = effectiveOwnerId(user);
    const po = await ctx.db.get("purchaseOrders", args.poId);
    if (!po || po.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Purchase order not found" });
    }
    if (po.status === "cancelled") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot update a cancelled PO" });
    }
    await ctx.db.patch("purchaseOrders", args.poId, { status: args.status });
  },
});

export const convertToInvoice = mutation({
  args: {
    poId: v.id("purchaseOrders"),
    /** Vendor's invoice number */
    invoiceNumber: v.string(),
    /** Invoice date — defaults to today */
    invoiceDate: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    tds: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"purchaseInvoices">> => {
    const user = await requireModuleAccess(ctx, "payables");
    const ownerId = effectiveOwnerId(user);
    const po = await ctx.db.get("purchaseOrders", args.poId);
    if (!po || po.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Purchase order not found" });
    }
    if (po.status === "cancelled") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot convert a cancelled PO" });
    }
    if (po.linkedInvoiceId) {
      throw new ConvexError({ code: "CONFLICT", message: "This PO already has a linked invoice" });
    }

    const lines = await ctx.db
      .query("purchaseOrderLines")
      .withIndex("by_po", (q) => q.eq("purchaseOrderId", args.poId))
      .collect();

    const tds = args.tds ?? 0;
    const total = po.subtotal + po.cgst + po.sgst + po.igst - tds;
    const internalRef = await getNextInvoiceRef(ctx, ownerId);
    const invoiceDate = args.invoiceDate ?? new Date().toISOString().slice(0, 10);

    const invoiceId = await ctx.db.insert("purchaseInvoices", {
      ownerId,
      vendorId: po.vendorId,
      invoiceNumber: args.invoiceNumber,
      internalRef,
      date: invoiceDate,
      dueDate: args.dueDate,
      status: "draft",
      projectId: po.projectId,
      narration: po.narration ?? `From PO ${po.poNumber}`,
      subtotal: po.subtotal,
      cgst: po.cgst,
      sgst: po.sgst,
      igst: po.igst,
      tds,
      total,
      amountPaid: 0,
    });

    for (const line of lines) {
      const { _id, _creationTime, ownerId: _oid, purchaseOrderId: _poi, ...rest } = line;
      await ctx.db.insert("purchaseInvoiceLines", {
        ownerId,
        purchaseInvoiceId: invoiceId,
        ...rest,
      });
    }

    // Link the invoice back and mark PO as received
    await ctx.db.patch("purchaseOrders", args.poId, {
      linkedInvoiceId: invoiceId,
      status: "received",
    });

    return invoiceId;
  },
});

export const deletePurchaseOrder = mutation({
  args: { poId: v.id("purchaseOrders") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireOwner(ctx);
    const ownerId = effectiveOwnerId(user);
    const po = await ctx.db.get("purchaseOrders", args.poId);
    if (!po || po.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Purchase order not found" });
    }
    if (po.status !== "draft" && po.status !== "cancelled") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Only draft or cancelled POs can be deleted" });
    }
    const lines = await ctx.db
      .query("purchaseOrderLines")
      .withIndex("by_po", (q) => q.eq("purchaseOrderId", args.poId))
      .collect();
    for (const l of lines) await ctx.db.delete("purchaseOrderLines", l._id);
    await ctx.db.delete("purchaseOrders", args.poId);
  },
});
