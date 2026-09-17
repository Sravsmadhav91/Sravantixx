import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireUser, effectiveOwnerId } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";
import { splitGstInclusive } from "./lib/gst.ts";
import {
  installmentStatusValidator,
  paymentModeValidator,
} from "./schema/realEstate.ts";

// ─── helpers ──────────────────────────────────────────────────────────────────

async function requireOwnedBooking(
  ctx: Parameters<typeof requireUser>[0],
  bookingId: Doc<"bookings">["_id"],
  ownerId: Doc<"users">["_id"],
): Promise<Doc<"bookings">> {
  const booking = await ctx.db.get("bookings", bookingId);
  if (!booking) throw new ConvexError({ code: "NOT_FOUND", message: "Booking not found" });
  if (booking.ownerId !== ownerId)
    throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
  return booking;
}

async function requireOwnedInstallment(
  ctx: Parameters<typeof requireUser>[0],
  installmentId: Doc<"paymentInstallments">["_id"],
  ownerId: Doc<"users">["_id"],
): Promise<Doc<"paymentInstallments">> {
  const inst = await ctx.db.get("paymentInstallments", installmentId);
  if (!inst) throw new ConvexError({ code: "NOT_FOUND", message: "Installment not found" });
  if (inst.ownerId !== ownerId)
    throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
  return inst;
}

// ─── installment queries ───────────────────────────────────────────────────────

export const listInstallments = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwnedBooking(ctx, args.bookingId, effectiveOwnerId(user));
    return await ctx.db
      .query("paymentInstallments")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .collect();
  },
});

export const listReceipts = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwnedBooking(ctx, args.bookingId, effectiveOwnerId(user));
    return await ctx.db
      .query("receipts")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .order("desc")
      .collect();
  },
});

/** Full buyer statement for a booking. */
export const getStatement = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const booking = await requireOwnedBooking(ctx, args.bookingId, effectiveOwnerId(user));

    const buyer = await ctx.db.get("buyers", booking.buyerId);
    const unit = await ctx.db.get("units", booking.unitId);
    const project = unit ? await ctx.db.get("projects", unit.projectId) : null;

    const installments = await ctx.db
      .query("paymentInstallments")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .collect();

    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .order("desc")
      .collect();

    const totalReceived = receipts.reduce((sum, r) => sum + r.amount, 0);
    const outstanding = booking.agreementValue - totalReceived;

    const now = new Date().toISOString();
    const overdueInstallments = installments.filter(
      (i) => i.status !== "paid" && i.dueDate && i.dueDate < now,
    );

    // Enrich with co-buyer docs
    const coBuyers = (
      await Promise.all((booking.coBuyerIds ?? []).map((id) => ctx.db.get("buyers", id)))
    ).filter((b): b is Doc<"buyers"> => b !== null);

    return {
      booking,
      buyer,
      coBuyers,
      unit: unit ? { ...unit, projectName: project?.name ?? "", projectRera: project?.reraNumber, projectCity: project?.city, projectAddress: project?.address } : null,
      installments,
      receipts,
      totalReceived,
      outstanding,
      overdueCount: overdueInstallments.length,
    };
  },
});

// ─── installment mutations ─────────────────────────────────────────────────────

export const addInstallment = mutation({
  args: {
    bookingId: v.id("bookings"),
    milestone: v.string(),
    dueDate: v.optional(v.string()),
    amount: v.number(),
    notes: v.optional(v.string()),
    triggerStageId: v.optional(v.id("constructionStages")),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "collections");
    const booking = await requireOwnedBooking(ctx, args.bookingId, effectiveOwnerId(user));
    if (booking.status === "cancelled")
      throw new ConvexError({ code: "CONFLICT", message: "Booking is cancelled" });

    if (args.triggerStageId) {
      const stage = await ctx.db.get("constructionStages", args.triggerStageId);
      if (!stage || stage.ownerId !== effectiveOwnerId(user)) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Construction stage not found" });
      }
    }

    return await ctx.db.insert("paymentInstallments", {
      ownerId: effectiveOwnerId(user),
      bookingId: args.bookingId,
      milestone: args.milestone,
      dueDate: args.dueDate,
      amount: args.amount,
      status: "pending",
      notes: args.notes,
      triggerStageId: args.triggerStageId,
    });
  },
});

export const updateInstallment = mutation({
  args: {
    installmentId: v.id("paymentInstallments"),
    milestone: v.string(),
    dueDate: v.optional(v.string()),
    amount: v.number(),
    notes: v.optional(v.string()),
    triggerStageId: v.optional(v.id("constructionStages")),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "collections");
    const inst = await requireOwnedInstallment(ctx, args.installmentId, effectiveOwnerId(user));
    if (inst.status === "paid")
      throw new ConvexError({ code: "CONFLICT", message: "Paid installments cannot be edited" });

    if (args.triggerStageId) {
      const stage = await ctx.db.get("constructionStages", args.triggerStageId);
      if (!stage || stage.ownerId !== effectiveOwnerId(user)) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Construction stage not found" });
      }
    }

    const { installmentId, ...fields } = args;
    await ctx.db.patch("paymentInstallments", installmentId, fields);
    return installmentId;
  },
});

export const raiseDemandsForInstallments = mutation({
  args: { installmentIds: v.array(v.id("paymentInstallments")) },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "collections");
    const ownerId = effectiveOwnerId(user);
    const now = new Date().toISOString();
    for (const id of args.installmentIds) {
      const inst = await requireOwnedInstallment(ctx, id, ownerId);
      if (inst.status === "pending") {
        await ctx.db.patch("paymentInstallments", id, {
          status: "demanded",
          demandedAt: now,
        });
      }
    }
    return args.installmentIds.length;
  },
});

export const removeInstallment = mutation({
  args: { installmentId: v.id("paymentInstallments") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role && user.role !== "owner") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the account owner can delete installments" });
    }
    const inst = await requireOwnedInstallment(ctx, args.installmentId, user._id);
    if (inst.status === "paid")
      throw new ConvexError({ code: "CONFLICT", message: "Paid installments cannot be deleted" });
    await ctx.db.delete("paymentInstallments", args.installmentId);
    return null;
  },
});

// ─── receipt mutations ─────────────────────────────────────────────────────────

export const recordReceipt = mutation({
  args: {
    bookingId: v.id("bookings"),
    installmentId: v.optional(v.id("paymentInstallments")),
    amount: v.number(),
    paymentDate: v.string(),
    paymentMode: paymentModeValidator,
    referenceNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "collections");
    const ownerId = effectiveOwnerId(user);
    const booking = await requireOwnedBooking(ctx, args.bookingId, ownerId);
    if (booking.status === "cancelled")
      throw new ConvexError({ code: "CONFLICT", message: "Booking is cancelled" });

    const split = splitGstInclusive(args.amount, booking.gstPercent);

    const receiptId = await ctx.db.insert("receipts", {
      ownerId,
      bookingId: args.bookingId,
      installmentId: args.installmentId,
      amount: args.amount,
      paymentDate: args.paymentDate,
      paymentMode: args.paymentMode,
      referenceNumber: args.referenceNumber,
      notes: args.notes,
      gstBaseAmount: split.baseAmount,
      gstAmount: split.gstAmount,
    });

    // Auto-mark linked installment as paid
    if (args.installmentId) {
      const inst = await ctx.db.get("paymentInstallments", args.installmentId);
      if (inst && inst.status !== "paid") {
        await ctx.db.patch("paymentInstallments", args.installmentId, { status: "paid" });
      }
    }

    return receiptId;
  },
});

export const removeReceipt = mutation({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role && user.role !== "owner") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the account owner can delete receipts" });
    }
    const receipt = await ctx.db.get("receipts", args.receiptId);
    if (!receipt) throw new ConvexError({ code: "NOT_FOUND", message: "Receipt not found" });
    if (receipt.ownerId !== user._id)
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });

    await ctx.db.delete("receipts", args.receiptId);

    // Revert linked installment back to demanded (or pending) if no other receipts remain
    if (receipt.installmentId) {
      const remaining = await ctx.db
        .query("receipts")
        .withIndex("by_installment", (q) =>
          q.eq("installmentId", receipt.installmentId),
        )
        .first();
      if (!remaining) {
        const inst = await ctx.db.get("paymentInstallments", receipt.installmentId);
        if (inst?.status === "paid") {
          await ctx.db.patch("paymentInstallments", receipt.installmentId, {
            status: inst.demandedAt ? "demanded" : "pending",
          });
        }
      }
    }

    return null;
  },
});

/** Overdue installments across all bookings for the signed-in user. */
export const listOverdue = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const now = new Date().toISOString();
    const all = await ctx.db
      .query("paymentInstallments")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();

    const overdue = all.filter(
      (i) => i.status !== "paid" && i.dueDate !== undefined && i.dueDate < now,
    );

    return await Promise.all(
      overdue.map(async (inst) => {
        const booking = await ctx.db.get("bookings", inst.bookingId);
        const buyer = booking ? await ctx.db.get("buyers", booking.buyerId) : null;
        const unit = booking ? await ctx.db.get("units", booking.unitId) : null;
        const project = unit ? await ctx.db.get("projects", unit.projectId) : null;
        return {
          ...inst,
          buyerName: buyer?.name ?? "Unknown",
          buyerPhone: buyer?.phone ?? "",
          unitNumber: unit?.number ?? "",
          projectName: project?.name ?? "",
          bookingId: inst.bookingId,
        };
      }),
    );
  },
});

/** Installments due within the next `withinDays` days (default 7). */
export const listUpcomingDue = query({
  args: { withinDays: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const now = new Date();
    const days = args.withinDays ?? 7;
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = now.toISOString();

    const all = await ctx.db
      .query("paymentInstallments")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();

    const upcoming = all.filter(
      (i) =>
        i.status !== "paid" &&
        i.dueDate !== undefined &&
        i.dueDate >= nowIso &&
        i.dueDate <= cutoff,
    );

    return await Promise.all(
      upcoming.map(async (inst) => {
        const booking = await ctx.db.get("bookings", inst.bookingId);
        const buyer = booking ? await ctx.db.get("buyers", booking.buyerId) : null;
        const unit = booking ? await ctx.db.get("units", booking.unitId) : null;
        const project = unit ? await ctx.db.get("projects", unit.projectId) : null;
        return {
          ...inst,
          buyerName: buyer?.name ?? "Unknown",
          buyerPhone: buyer?.phone ?? "",
          unitNumber: unit?.number ?? "",
          projectName: project?.name ?? "",
          bookingId: inst.bookingId,
        };
      }),
    );
  },
});

/** Mark an installment as reminded — stamps remindedAt. */
export const markReminded = mutation({
  args: { installmentId: v.id("paymentInstallments") },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "collections");
    await requireOwnedInstallment(ctx, args.installmentId, effectiveOwnerId(user));
    await ctx.db.patch("paymentInstallments", args.installmentId, {
      remindedAt: new Date().toISOString(),
    });
    return args.installmentId;
  },
});
