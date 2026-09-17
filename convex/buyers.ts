import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { requireUser, effectiveOwnerId } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";

const buyerFields = {
  name: v.string(),
  phone: v.string(),
  email: v.optional(v.string()),
  pan: v.optional(v.string()),
  address: v.optional(v.string()),
  notes: v.optional(v.string()),
  gstin: v.optional(v.string()),
  state: v.optional(v.string()),
};

/** Non-paginated search/lookup — used by dialogs and global search that need the full match set. */
export const list = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    if (args.search && args.search.trim().length > 0) {
      return await ctx.db
        .query("buyers")
        .withSearchIndex("search_name", (q) =>
          q.search("name", args.search!).eq("ownerId", ownerId),
        )
        .take(50);
    }
    return await ctx.db
      .query("buyers")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("asc")
      .take(200);
  },
});

/** Paginated buyers list for the main Buyers page — scales to any number of buyers. */
export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    if (args.search && args.search.trim().length > 0) {
      return await ctx.db
        .query("buyers")
        .withSearchIndex("search_name", (q) =>
          q.search("name", args.search!).eq("ownerId", ownerId),
        )
        .paginate(args.paginationOpts);
    }
    return await ctx.db
      .query("buyers")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("asc")
      .paginate(args.paginationOpts);
  },
});

export const get = query({
  args: { buyerId: v.id("buyers") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const buyer = await ctx.db.get("buyers", args.buyerId);
    if (!buyer) throw new ConvexError({ code: "NOT_FOUND", message: "Buyer not found" });
    if (buyer.ownerId !== effectiveOwnerId(user))
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    return buyer;
  },
});

export const create = mutation({
  args: buyerFields,
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "buyers");
    return await ctx.db.insert("buyers", { ...args, ownerId: effectiveOwnerId(user) });
  },
});

export const update = mutation({
  args: { buyerId: v.id("buyers"), ...buyerFields },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "buyers");
    const ownerId = effectiveOwnerId(user);
    const { buyerId, ...fields } = args;
    const buyer = await ctx.db.get("buyers", buyerId);
    if (!buyer) throw new ConvexError({ code: "NOT_FOUND", message: "Buyer not found" });
    if (buyer.ownerId !== ownerId)
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    await ctx.db.patch("buyers", buyerId, fields);
    return buyerId;
  },
});

export const remove = mutation({
  args: { buyerId: v.id("buyers") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role && user.role !== "owner") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the account owner can delete buyers" });
    }
    const buyer = await ctx.db.get("buyers", args.buyerId);
    if (!buyer) throw new ConvexError({ code: "NOT_FOUND", message: "Buyer not found" });
    if (buyer.ownerId !== user._id)
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });

    // Block deletion if the buyer has any active booking
    const active = await ctx.db
      .query("bookings")
      .withIndex("by_buyer", (q) => q.eq("buyerId", args.buyerId))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    if (active) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "This buyer has an active booking and cannot be deleted",
      });
    }

    await ctx.db.delete("buyers", args.buyerId);
    return null;
  },
});
