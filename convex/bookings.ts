import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser, effectiveOwnerId } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";

export type BookingWithDetails = Doc<"bookings"> & {
  buyer: Doc<"buyers">;
  /** All buyers: primary first, then co-buyers */
  allBuyers: Doc<"buyers">[];
  unit: Doc<"units"> & { projectName: string };
};

/** Fetch and attach co-buyer docs to a booking */
async function enrichBooking(
  ctx: { db: { get: (table: "buyers", id: Id<"buyers">) => Promise<Doc<"buyers"> | null> } },
  booking: Doc<"bookings"> & { buyer: Doc<"buyers">; unit: Doc<"units"> & { projectName: string } },
): Promise<BookingWithDetails> {
  const coIds = booking.coBuyerIds ?? [];
  const coBuyers = (
    await Promise.all(coIds.map((id) => ctx.db.get("buyers", id)))
  ).filter((b): b is Doc<"buyers"> => b !== null);
  return { ...booking, allBuyers: [booking.buyer, ...coBuyers] };
}

export const list = query({
  args: {},
  handler: async (ctx): Promise<BookingWithDetails[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .collect();

    return await Promise.all(
      bookings.map(async (booking) => {
        const buyer = await ctx.db.get("buyers", booking.buyerId);
        const unit = await ctx.db.get("units", booking.unitId);
        const project = unit ? await ctx.db.get("projects", unit.projectId) : null;
        if (!buyer || !unit || !project) {
          throw new ConvexError({ code: "NOT_FOUND", message: "Related record not found" });
        }
        return enrichBooking(ctx, { ...booking, buyer, unit: { ...unit, projectName: project.name } });
      }),
    );
  },
});

/** Paginated booking list for the Bookings and Collections pages. */
export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.union(v.literal("active"), v.literal("cancelled"))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const result = args.status
      ? await ctx.db
          .query("bookings")
          .withIndex("by_owner_and_status", (q) =>
            q.eq("ownerId", ownerId).eq("status", args.status!),
          )
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("bookings")
          .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
          .order("desc")
          .paginate(args.paginationOpts);

    const page: BookingWithDetails[] = await Promise.all(
      result.page.map(async (booking) => {
        const buyer = await ctx.db.get("buyers", booking.buyerId);
        const unit = await ctx.db.get("units", booking.unitId);
        const project = unit ? await ctx.db.get("projects", unit.projectId) : null;
        if (!buyer || !unit || !project) {
          throw new ConvexError({ code: "NOT_FOUND", message: "Related record not found" });
        }
        return enrichBooking(ctx, { ...booking, buyer, unit: { ...unit, projectName: project.name } });
      }),
    );

    return { ...result, page };
  },
});

export const listByBuyer = query({
  args: { buyerId: v.id("buyers") },
  handler: async (ctx, args): Promise<BookingWithDetails[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    // Bookings where this buyer is primary
    const primaryBookings = await ctx.db
      .query("bookings")
      .withIndex("by_buyer", (q) => q.eq("buyerId", args.buyerId))
      .order("desc")
      .collect();

    // Bookings where this buyer is a co-buyer (scan by owner, filter)
    const allOwnerBookings = await ctx.db
      .query("bookings")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();

    const coBookings = allOwnerBookings.filter(
      (b) =>
        b.coBuyerIds?.includes(args.buyerId) &&
        !primaryBookings.some((pb) => pb._id === b._id),
    );

    const combined = [...primaryBookings, ...coBookings].sort(
      (a, b) => b._creationTime - a._creationTime,
    );

    return await Promise.all(
      combined.map(async (booking) => {
        const buyer = await ctx.db.get("buyers", booking.buyerId);
        const unit = await ctx.db.get("units", booking.unitId);
        const project = unit ? await ctx.db.get("projects", unit.projectId) : null;
        if (!buyer || !unit || !project || buyer.ownerId !== ownerId) {
          throw new ConvexError({ code: "NOT_FOUND", message: "Related record not found" });
        }
        return enrichBooking(ctx, { ...booking, buyer, unit: { ...unit, projectName: project.name } });
      }),
    );
  },
});

export const getByUnit = query({
  args: { unitId: v.id("units") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("bookings")
      .withIndex("by_unit", (q) => q.eq("unitId", args.unitId))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
  },
});

export const create = mutation({
  args: {
    unitId: v.id("units"),
    buyerId: v.id("buyers"),
    coBuyerIds: v.optional(v.array(v.id("buyers"))),
    bookingDate: v.string(),
    agreementValue: v.number(),
    bookingAmount: v.number(),
    notes: v.optional(v.string()),
    gstPercent: v.optional(v.number()),
    gstAmount: v.optional(v.number()),
    carParkingCharges: v.optional(v.number()),
    maintenanceFund: v.optional(v.number()),
    corpusFundRatePerSqft: v.optional(v.number()),
    corpusFund: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "bookings");
    const ownerId = effectiveOwnerId(user);

    const unit = await ctx.db.get("units", args.unitId);
    if (!unit) throw new ConvexError({ code: "NOT_FOUND", message: "Unit not found" });
    if (unit.ownerId !== ownerId)
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    if (unit.status !== "available" && unit.status !== "on_hold") {
      throw new ConvexError({
        code: "CONFLICT",
        message: "This unit is already booked or sold",
      });
    }

    const buyer = await ctx.db.get("buyers", args.buyerId);
    if (!buyer) throw new ConvexError({ code: "NOT_FOUND", message: "Buyer not found" });
    if (buyer.ownerId !== ownerId)
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });

    // Validate co-buyers
    const coBuyerIds = args.coBuyerIds?.filter((id) => id !== args.buyerId) ?? [];
    for (const coId of coBuyerIds) {
      const co = await ctx.db.get("buyers", coId);
      if (!co || co.ownerId !== ownerId)
        throw new ConvexError({ code: "NOT_FOUND", message: "Co-buyer not found" });
    }

    // Bookings created by non-owners require owner approval before the unit is locked in as sold.
    // The unit is still marked "booked" immediately so it can't be double-booked while pending.
    const isStaff = !!user.role && user.role !== "owner";

    await ctx.db.patch("units", args.unitId, { status: "booked" });

    return await ctx.db.insert("bookings", {
      ownerId,
      unitId: args.unitId,
      buyerId: args.buyerId,
      coBuyerIds: coBuyerIds.length > 0 ? coBuyerIds : undefined,
      bookingDate: args.bookingDate,
      agreementValue: args.agreementValue,
      bookingAmount: args.bookingAmount,
      status: "active",
      notes: args.notes,
      gstPercent: args.gstPercent,
      gstAmount: args.gstAmount,
      carParkingCharges: args.carParkingCharges,
      maintenanceFund: args.maintenanceFund,
      corpusFundRatePerSqft: args.corpusFundRatePerSqft,
      corpusFund: args.corpusFund,
      approvalStatus: isStaff ? "pending_approval" : "approved",
      submittedBy: isStaff ? user._id : undefined,
      submittedAt: isStaff ? new Date().toISOString() : undefined,
    });
  },
});

// ─── approval workflow ──────────────────────────────────────────────────────

/** Pending approvals for the owner (or the owner a staff member is linked to). */
export const listPendingApprovals = query({
  args: {},
  handler: async (ctx): Promise<BookingWithDetails[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_owner_and_approval_status", (q) =>
        q.eq("ownerId", ownerId).eq("approvalStatus", "pending_approval"),
      )
      .order("desc")
      .collect();

    return await Promise.all(
      bookings.map(async (booking) => {
        const buyer = await ctx.db.get("buyers", booking.buyerId);
        const unit = await ctx.db.get("units", booking.unitId);
        const project = unit ? await ctx.db.get("projects", unit.projectId) : null;
        if (!buyer || !unit || !project) {
          throw new ConvexError({ code: "NOT_FOUND", message: "Related record not found" });
        }
        return enrichBooking(ctx, { ...booking, buyer, unit: { ...unit, projectName: project.name } });
      }),
    );
  },
});

/** Count of pending approvals — for a lightweight notification badge. */
export const getPendingApprovalsCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const pending = await ctx.db
      .query("bookings")
      .withIndex("by_owner_and_approval_status", (q) =>
        q.eq("ownerId", ownerId).eq("approvalStatus", "pending_approval"),
      )
      .collect();
    return pending.length;
  },
});

export const approveBooking = mutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role && user.role !== "owner") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the account owner can approve bookings" });
    }
    const booking = await ctx.db.get("bookings", args.bookingId);
    if (!booking) throw new ConvexError({ code: "NOT_FOUND", message: "Booking not found" });
    if (booking.ownerId !== user._id)
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    if (booking.approvalStatus !== "pending_approval") {
      throw new ConvexError({ code: "CONFLICT", message: "This booking is not pending approval" });
    }

    await ctx.db.patch("bookings", args.bookingId, {
      approvalStatus: "approved",
      reviewedBy: user._id,
      reviewedAt: new Date().toISOString(),
    });
    return args.bookingId;
  },
});

export const rejectBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role && user.role !== "owner") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the account owner can reject bookings" });
    }
    const booking = await ctx.db.get("bookings", args.bookingId);
    if (!booking) throw new ConvexError({ code: "NOT_FOUND", message: "Booking not found" });
    if (booking.ownerId !== user._id)
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    if (booking.approvalStatus !== "pending_approval") {
      throw new ConvexError({ code: "CONFLICT", message: "This booking is not pending approval" });
    }

    // Rejecting frees up the unit again and cancels the booking.
    await ctx.db.patch("bookings", args.bookingId, {
      approvalStatus: "rejected",
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      cancellationReason: args.rejectionReason ?? "Booking rejected by owner",
      reviewedBy: user._id,
      reviewedAt: new Date().toISOString(),
      rejectionReason: args.rejectionReason,
    });
    await ctx.db.patch("units", booking.unitId, { status: "available" });
    return args.bookingId;
  },
});

export const updateBookingDate = mutation({
  args: {
    bookingId: v.id("bookings"),
    bookingDate: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "bookings");
    const ownerId = effectiveOwnerId(user);
    const booking = await ctx.db.get("bookings", args.bookingId);
    if (!booking) throw new ConvexError({ code: "NOT_FOUND", message: "Booking not found" });
    if (booking.ownerId !== ownerId)
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    await ctx.db.patch("bookings", args.bookingId, { bookingDate: args.bookingDate });
  },
});

/**
 * Mark (or unmark) the sale deed as registered on a given date. Once
 * registered, GST Returns reports this booking's receipts as a regular
 * outward supply instead of an advance received.
 */
export const setRegistrationDate = mutation({
  args: {
    bookingId: v.id("bookings"),
    registrationDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "collections");
    const ownerId = effectiveOwnerId(user);
    const booking = await ctx.db.get("bookings", args.bookingId);
    if (!booking) throw new ConvexError({ code: "NOT_FOUND", message: "Booking not found" });
    if (booking.ownerId !== ownerId)
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    await ctx.db.patch("bookings", args.bookingId, { registrationDate: args.registrationDate });
    return args.bookingId;
  },
});

export const updateCoBuyers = mutation({
  args: {
    bookingId: v.id("bookings"),
    coBuyerIds: v.array(v.id("buyers")),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "bookings");
    const ownerId = effectiveOwnerId(user);
    const booking = await ctx.db.get("bookings", args.bookingId);
    if (!booking) throw new ConvexError({ code: "NOT_FOUND", message: "Booking not found" });
    if (booking.ownerId !== ownerId)
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });

    // Remove primary buyer if accidentally included
    const filtered = args.coBuyerIds.filter((id) => id !== booking.buyerId);
    await ctx.db.patch("bookings", args.bookingId, {
      coBuyerIds: filtered.length > 0 ? filtered : undefined,
    });
  },
});

export const cancel = mutation({
  args: {
    bookingId: v.id("bookings"),
    cancellationReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role && user.role !== "owner") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the account owner can cancel bookings" });
    }
    const booking = await ctx.db.get("bookings", args.bookingId);
    if (!booking) throw new ConvexError({ code: "NOT_FOUND", message: "Booking not found" });
    if (booking.ownerId !== user._id)
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    if (booking.status === "cancelled")
      throw new ConvexError({ code: "CONFLICT", message: "Booking is already cancelled" });

    await ctx.db.patch("bookings", args.bookingId, {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      cancellationReason: args.cancellationReason,
    });

    await ctx.db.patch("units", booking.unitId, { status: "available" });
    return args.bookingId;
  },
});
