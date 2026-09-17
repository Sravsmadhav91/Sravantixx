/**
 * Buyer Self-Service Portal — buyer-facing queries.
 *
 * Buyers sign in with the same Hercules Auth as staff/owners, but see only
 * their own bookings. A buyer is matched to their `buyers` record(s) by
 * comparing the signed-in identity's email to `buyers.email`.
 *
 * NOTE: `buyers.email` is optional and therefore cannot be indexed (Convex
 * disallows indexing optional fields). Matching is done with a bounded scan
 * (`.take(500)`) rather than an index lookup. This is fine at the scale of a
 * single developer's buyer book; revisit with a dedicated indexed lookup
 * table if the buyer base grows very large.
 *
 * Scope: matches only bookings where the signed-in buyer is the primary
 * buyer, or listed as a co-buyer. Documents shown are those linked to the
 * buyer or to one of their bookings.
 */
import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

async function findMyBuyerRecords(ctx: QueryCtx): Promise<Doc<"buyers">[]> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.email) return [];
  const email = identity.email.toLowerCase();

  const candidates = await ctx.db
    .query("buyers")
    // eslint-disable-next-line @convex-dev/no-filter-in-query
    .filter((q) => q.eq(q.field("email"), identity.email))
    .take(500);

  return candidates.filter((b) => b.email?.toLowerCase() === email);
}

/** Returns the buyer record(s) matching the signed-in end user's email. */
export const getMyBuyerRecords = query({
  args: {},
  handler: async (ctx) => {
    return await findMyBuyerRecords(ctx);
  },
});

/** All bookings (as primary buyer or co-buyer) for the signed-in buyer, with unit/project info. */
export const getMyBookings = query({
  args: {},
  handler: async (ctx) => {
    const buyers = await findMyBuyerRecords(ctx);
    if (buyers.length === 0) return [];
    const buyerIds = new Set(buyers.map((b) => b._id));

    const seenBookingIds = new Set<string>();
    const results: {
      booking: Doc<"bookings">;
      unit: Doc<"units"> | null;
      projectName: string;
      isCoBuyer: boolean;
    }[] = [];

    for (const buyer of buyers) {
      const primaryBookings = await ctx.db
        .query("bookings")
        .withIndex("by_buyer", (q) => q.eq("buyerId", buyer._id))
        .collect();
      for (const booking of primaryBookings) {
        if (seenBookingIds.has(booking._id)) continue;
        seenBookingIds.add(booking._id);
        const unit = await ctx.db.get("units", booking.unitId);
        const project = unit ? await ctx.db.get("projects", unit.projectId) : null;
        results.push({ booking, unit, projectName: project?.name ?? "—", isCoBuyer: false });
      }

      // Co-buyer bookings: scan the owner's bookings for this buyer's owner scope.
      // Bounded to bookings created under the same developer as any matched buyer.
      const ownerBookings = await ctx.db
        .query("bookings")
        .withIndex("by_owner", (q) => q.eq("ownerId", buyer.ownerId))
        .collect();
      for (const booking of ownerBookings) {
        if (seenBookingIds.has(booking._id)) continue;
        if (!booking.coBuyerIds?.some((id) => buyerIds.has(id))) continue;
        seenBookingIds.add(booking._id);
        const unit = await ctx.db.get("units", booking.unitId);
        const project = unit ? await ctx.db.get("projects", unit.projectId) : null;
        results.push({ booking, unit, projectName: project?.name ?? "—", isCoBuyer: true });
      }
    }

    return results;
  },
});

async function requirePortalBooking(
  ctx: QueryCtx,
  bookingId: Doc<"bookings">["_id"],
): Promise<{ booking: Doc<"bookings">; buyer: Doc<"buyers"> }> {
  const buyers = await findMyBuyerRecords(ctx);
  if (buyers.length === 0) {
    throw new ConvexError({ code: "FORBIDDEN", message: "No buyer account found for your email" });
  }
  const buyerIds = new Set(buyers.map((b) => b._id));

  const booking = await ctx.db.get("bookings", bookingId);
  if (!booking) throw new ConvexError({ code: "NOT_FOUND", message: "Booking not found" });

  const isPrimary = buyerIds.has(booking.buyerId);
  const isCoBuyer = booking.coBuyerIds?.some((id) => buyerIds.has(id)) ?? false;
  if (!isPrimary && !isCoBuyer) {
    throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
  }

  const primaryBuyer = buyers.find((b) => b._id === booking.buyerId) ?? buyers[0];
  return { booking, buyer: primaryBuyer };
}

/** Full statement (unit, installments, receipts) for one of the signed-in buyer's bookings. */
export const getMyBookingStatement = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const { booking } = await requirePortalBooking(ctx, args.bookingId);

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

    const coBuyers = (
      await Promise.all((booking.coBuyerIds ?? []).map((id) => ctx.db.get("buyers", id)))
    ).filter((b): b is Doc<"buyers"> => b !== null);

    return {
      booking,
      buyer,
      coBuyers,
      unit: unit
        ? {
            ...unit,
            projectName: project?.name ?? "",
            projectRera: project?.reraNumber,
            projectCity: project?.city,
            projectAddress: project?.address,
          }
        : null,
      installments,
      receipts,
      totalReceived,
      outstanding,
    };
  },
});

/** Documents shared with the signed-in buyer: linked to the booking or the buyer. */
export const getMyBookingDocuments = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const { booking, buyer } = await requirePortalBooking(ctx, args.bookingId);

    const bookingDocs = await ctx.db
      .query("documents")
      .withIndex("by_linked", (q) => q.eq("linkedType", "booking").eq("linkedId", booking._id))
      .collect();

    const buyerDocs = await ctx.db
      .query("documents")
      .withIndex("by_linked", (q) => q.eq("linkedType", "buyer").eq("linkedId", buyer._id))
      .collect();

    const all = [...bookingDocs, ...buyerDocs].sort((a, b) =>
      b.uploadedAt.localeCompare(a.uploadedAt),
    );

    return await Promise.all(
      all.map(async (doc) => ({
        ...doc,
        url: await ctx.storage.getUrl(doc.storageId),
      })),
    );
  },
});
