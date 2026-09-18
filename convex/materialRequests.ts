import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { effectiveOwnerId, requireOwnedProject, requireUser } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

async function getNextRequestNumber(ctx: MutationCtx, ownerId: Id<"users">): Promise<string> {
  const last = await ctx.db
    .query("materialRequests")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .first();
  const year = new Date().getFullYear();
  if (!last) return `MR-${year}-001`;
  const match = last.requestNumber.match(/MR-\d{4}-(\d+)$/);
  const seq = match ? parseInt(match[1], 10) + 1 : 1;
  return `MR-${year}-${String(seq).padStart(3, "0")}`;
}

const lineValidator = v.object({
  stockItemId: v.optional(v.id("stockItems")),
  description: v.string(),
  unit: v.string(),
  quantity: v.number(),
  notes: v.optional(v.string()),
});

// ═══════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════

export const listMaterialRequests = query({
  args: {
    projectId: v.optional(v.id("projects")),
    status: v.optional(
      v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("ordered")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    let requests: Doc<"materialRequests">[];
    if (args.status) {
      requests = await ctx.db
        .query("materialRequests")
        .withIndex("by_owner_and_status", (q) => q.eq("ownerId", ownerId).eq("status", args.status!))
        .order("desc")
        .collect();
    } else {
      requests = await ctx.db
        .query("materialRequests")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .order("desc")
        .collect();
    }
    if (args.projectId) requests = requests.filter((r) => r.projectId === args.projectId);

    const projectIds = [...new Set(requests.map((r) => r.projectId))];
    const projectMap = new Map<string, string>();
    for (const pid of projectIds) {
      const p = await ctx.db.get("projects", pid);
      if (p) projectMap.set(pid, p.name);
    }
    const userIds = [...new Set(requests.map((r) => r.requestedById))];
    const userMap = new Map<string, string>();
    for (const uid of userIds) {
      const u = await ctx.db.get("users", uid);
      if (u) userMap.set(uid, u.name ?? u.email ?? "Unknown");
    }

    return requests.map((r) => ({
      ...r,
      projectName: projectMap.get(r.projectId) ?? "Unknown",
      requestedByName: userMap.get(r.requestedById) ?? "Unknown",
    }));
  },
});

export const getMaterialRequest = query({
  args: { requestId: v.id("materialRequests") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const request = await ctx.db.get("materialRequests", args.requestId);
    if (!request || request.ownerId !== ownerId) return null;

    const [project, requestedBy, lines] = await Promise.all([
      ctx.db.get("projects", request.projectId),
      ctx.db.get("users", request.requestedById),
      ctx.db
        .query("materialRequestLines")
        .withIndex("by_request", (q) => q.eq("materialRequestId", args.requestId))
        .collect(),
    ]);

    return { request, project, requestedBy, lines };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const createMaterialRequest = mutation({
  args: {
    projectId: v.id("projects"),
    neededByDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    lines: v.array(lineValidator),
  },
  handler: async (ctx, args): Promise<Id<"materialRequests">> => {
    const user = await requireModuleAccess(ctx, "materialRequests");
    const ownerId = effectiveOwnerId(user);
    await requireOwnedProject(ctx, args.projectId, ownerId);

    if (args.lines.length === 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Add at least one material line" });
    }

    const requestNumber = await getNextRequestNumber(ctx, ownerId);
    const requestId = await ctx.db.insert("materialRequests", {
      ownerId,
      projectId: args.projectId,
      requestNumber,
      requestedById: user._id,
      requestDate: new Date().toISOString().slice(0, 10),
      neededByDate: args.neededByDate,
      status: "pending",
      notes: args.notes,
    });

    for (const line of args.lines) {
      await ctx.db.insert("materialRequestLines", { ownerId, materialRequestId: requestId, ...line });
    }

    return requestId;
  },
});

export const updateMaterialRequest = mutation({
  args: {
    requestId: v.id("materialRequests"),
    neededByDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    lines: v.optional(v.array(lineValidator)),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "materialRequests");
    const ownerId = effectiveOwnerId(user);
    const request = await ctx.db.get("materialRequests", args.requestId);
    if (!request || request.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Material request not found" });
    }
    if (request.status !== "pending") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Only pending requests can be edited" });
    }

    const { requestId, lines, ...patch } = args;
    await ctx.db.patch("materialRequests", requestId, patch);

    if (lines) {
      const existingLines = await ctx.db
        .query("materialRequestLines")
        .withIndex("by_request", (q) => q.eq("materialRequestId", requestId))
        .collect();
      for (const l of existingLines) await ctx.db.delete("materialRequestLines", l._id);
      for (const line of lines) {
        await ctx.db.insert("materialRequestLines", { ownerId, materialRequestId: requestId, ...line });
      }
    }
  },
});

export const reviewMaterialRequest = mutation({
  args: {
    requestId: v.id("materialRequests"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireUser(ctx);
    if (user.role && user.role !== "owner" && user.role !== "project_manager") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the owner or project manager can review requests" });
    }
    const ownerId = effectiveOwnerId(user);
    const request = await ctx.db.get("materialRequests", args.requestId);
    if (!request || request.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Material request not found" });
    }
    if (request.status !== "pending") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Only pending requests can be reviewed" });
    }
    if (args.decision === "rejected" && !args.rejectionReason?.trim()) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Provide a reason for rejecting this request" });
    }
    await ctx.db.patch("materialRequests", args.requestId, {
      status: args.decision,
      reviewedById: user._id,
      reviewedAt: new Date().toISOString(),
      rejectionReason: args.decision === "rejected" ? args.rejectionReason : undefined,
    });
  },
});

export const cancelMaterialRequest = mutation({
  args: { requestId: v.id("materialRequests") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "materialRequests");
    const ownerId = effectiveOwnerId(user);
    const request = await ctx.db.get("materialRequests", args.requestId);
    if (!request || request.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Material request not found" });
    }
    if (request.status === "ordered") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "This request has already been converted to a purchase order" });
    }
    const lines = await ctx.db
      .query("materialRequestLines")
      .withIndex("by_request", (q) => q.eq("materialRequestId", args.requestId))
      .collect();
    for (const l of lines) await ctx.db.delete("materialRequestLines", l._id);
    await ctx.db.delete("materialRequests", args.requestId);
  },
});

/** Converts an approved material request into a draft Purchase Order, pre-filled from its lines. */
export const convertToPurchaseOrder = mutation({
  args: {
    requestId: v.id("materialRequests"),
    vendorId: v.id("vendors"),
    /** Rate per unit for each line, in the same order as the request's lines. */
    rates: v.array(v.number()),
    expectedDeliveryDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"purchaseOrders">> => {
    const user = await requireModuleAccess(ctx, "payables");
    const ownerId = effectiveOwnerId(user);
    const request = await ctx.db.get("materialRequests", args.requestId);
    if (!request || request.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Material request not found" });
    }
    if (request.status !== "approved") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Only approved requests can be converted to a purchase order" });
    }
    const vendor = await ctx.db.get("vendors", args.vendorId);
    if (!vendor || vendor.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Vendor not found" });
    }

    const lines = await ctx.db
      .query("materialRequestLines")
      .withIndex("by_request", (q) => q.eq("materialRequestId", args.requestId))
      .collect();
    if (lines.length !== args.rates.length) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Provide a rate for every material line" });
    }

    const poLines = lines.map((line, i) => ({
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      rate: args.rates[i],
      amount: line.quantity * args.rates[i],
    }));
    const subtotal = poLines.reduce((s, l) => s + l.amount, 0);

    const last = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .first();
    const year = new Date().getFullYear();
    const match = last?.poNumber.match(/PO-\d{4}-(\d+)$/);
    const seq = match ? parseInt(match[1], 10) + 1 : 1;
    const poNumber = last ? `PO-${year}-${String(seq).padStart(3, "0")}` : `PO-${year}-001`;

    const poId = await ctx.db.insert("purchaseOrders", {
      ownerId,
      vendorId: args.vendorId,
      poNumber,
      date: new Date().toISOString().slice(0, 10),
      expectedDeliveryDate: args.expectedDeliveryDate,
      status: "draft",
      projectId: request.projectId,
      narration: `From material request ${request.requestNumber}`,
      subtotal,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total: subtotal,
    });

    for (const line of poLines) {
      await ctx.db.insert("purchaseOrderLines", { ownerId, purchaseOrderId: poId, ...line });
    }

    await ctx.db.patch("materialRequests", args.requestId, {
      status: "ordered",
      linkedPurchaseOrderId: poId,
    });

    return poId;
  },
});
