import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { requireUser, effectiveOwnerId } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";
import { leadStatusValidator, leadSourceValidator } from "./schema/realEstate.ts";

const leadFields = {
  name: v.string(),
  phone: v.string(),
  email: v.optional(v.string()),
  projectInterest: v.optional(v.string()),
  source: leadSourceValidator,
  budget: v.optional(v.number()),
  notes: v.optional(v.string()),
};

// ── Queries ───────────────────────────────────────────────────────────────────

export const list = query({
  args: {
    status: v.optional(leadStatusValidator),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    if (args.search && args.search.trim().length > 0) {
      return await ctx.db
        .query("leads")
        .withSearchIndex("search_name", (q) =>
          q.search("name", args.search!).eq("ownerId", ownerId),
        )
        .take(50);
    }
    if (args.status) {
      return await ctx.db
        .query("leads")
        .withIndex("by_owner_and_status", (q) =>
          q.eq("ownerId", ownerId).eq("status", args.status!),
        )
        .order("desc")
        .take(1000);
    }
    return await ctx.db
      .query("leads")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(1000);
  },
});

/** Paginated leads list for the Lead Pipeline page. */
export const listPaginated = query({
  args: {
    status: v.optional(leadStatusValidator),
    search: v.optional(v.string()),
    /** Filter to leads assigned to a specific user, e.g. "me" via the current user's id. */
    assignedToId: v.optional(v.id("users")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    if (args.search && args.search.trim().length > 0) {
      return await ctx.db
        .query("leads")
        .withSearchIndex("search_name", (q) =>
          q.search("name", args.search!).eq("ownerId", ownerId),
        )
        .paginate(args.paginationOpts);
    }
    if (args.assignedToId) {
      return await ctx.db
        .query("leads")
        .withIndex("by_owner_and_assigned", (q) =>
          q.eq("ownerId", ownerId).eq("assignedToId", args.assignedToId),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }
    if (args.status) {
      return await ctx.db
        .query("leads")
        .withIndex("by_owner_and_status", (q) =>
          q.eq("ownerId", ownerId).eq("status", args.status!),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }
    return await ctx.db
      .query("leads")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getOpenCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const openStatuses = ["new", "contacted", "site_visit", "negotiation"] as const;
    let total = 0;
    for (const status of openStatuses) {
      const rows = await ctx.db
        .query("leads")
        .withIndex("by_owner_and_status", (q) =>
          q.eq("ownerId", ownerId).eq("status", status),
        )
        .collect();
      total += rows.length;
    }
    return total;
  },
});

export const get = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const lead = await ctx.db.get("leads", args.leadId);
    if (!lead) throw new ConvexError({ code: "NOT_FOUND", message: "Lead not found" });
    if (lead.ownerId !== effectiveOwnerId(user))
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    return lead;
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const create = mutation({
  args: leadFields,
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "leads");
    return await ctx.db.insert("leads", {
      ...args,
      ownerId: effectiveOwnerId(user),
      status: "new",
      lastActivityAt: new Date().toISOString(),
    });
  },
});

export const update = mutation({
  args: { leadId: v.id("leads"), ...leadFields },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "leads");
    const { leadId, ...fields } = args;
    const lead = await ctx.db.get("leads", leadId);
    if (!lead) throw new ConvexError({ code: "NOT_FOUND", message: "Lead not found" });
    if (lead.ownerId !== effectiveOwnerId(user))
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    await ctx.db.patch("leads", leadId, { ...fields, lastActivityAt: new Date().toISOString() });
    return leadId;
  },
});

export const updateStatus = mutation({
  args: {
    leadId: v.id("leads"),
    status: leadStatusValidator,
    lostReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "leads");
    const lead = await ctx.db.get("leads", args.leadId);
    if (!lead) throw new ConvexError({ code: "NOT_FOUND", message: "Lead not found" });
    if (lead.ownerId !== effectiveOwnerId(user))
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    if (lead.convertedBuyerId)
      throw new ConvexError({ code: "CONFLICT", message: "Converted leads cannot be moved" });
    await ctx.db.patch("leads", args.leadId, {
      status: args.status,
      lostReason: args.lostReason,
      lastActivityAt: new Date().toISOString(),
    });
    return args.leadId;
  },
});

/** Convert a won lead into a buyer record and return the new buyerId. */
export const convertToBuyer = mutation({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args): Promise<{ buyerId: string }> => {
    const user = await requireModuleAccess(ctx, "leads");
    const ownerId = effectiveOwnerId(user);
    const lead = await ctx.db.get("leads", args.leadId);
    if (!lead) throw new ConvexError({ code: "NOT_FOUND", message: "Lead not found" });
    if (lead.ownerId !== ownerId)
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    if (lead.convertedBuyerId)
      throw new ConvexError({ code: "CONFLICT", message: "Lead already converted" });

    const buyerId = await ctx.db.insert("buyers", {
      ownerId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      notes: lead.notes,
    });

    await ctx.db.patch("leads", args.leadId, {
      status: "won",
      convertedBuyerId: buyerId,
      lastActivityAt: new Date().toISOString(),
    });

    return { buyerId };
  },
});

/** Assigns (or unassigns, when userId is omitted) a lead to a sales executive. */
export const assign = mutation({
  args: {
    leadId: v.id("leads"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "leads");
    const ownerId = effectiveOwnerId(user);
    const lead = await ctx.db.get("leads", args.leadId);
    if (!lead) throw new ConvexError({ code: "NOT_FOUND", message: "Lead not found" });
    if (lead.ownerId !== ownerId)
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });

    if (!args.userId) {
      await ctx.db.patch("leads", args.leadId, { assignedToId: undefined, assignedToName: undefined });
      return null;
    }

    const assignee = await ctx.db.get("users", args.userId);
    if (!assignee) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    // Assignee must be the owner themselves or a team member linked to the same owner
    const assigneeOwnerId = effectiveOwnerId(assignee);
    if (assigneeOwnerId !== ownerId) {
      throw new ConvexError({ code: "FORBIDDEN", message: "That user is not on your team" });
    }

    await ctx.db.patch("leads", args.leadId, {
      assignedToId: assignee._id,
      assignedToName: assignee.name ?? assignee.email ?? "Team member",
    });
    await ctx.db.insert("crmActivities", {
      ownerId,
      linkedType: "lead",
      linkedId: args.leadId,
      activityType: "note",
      note: `Assigned to ${assignee.name ?? assignee.email ?? "team member"}`,
      createdByName: user.name ?? user.email ?? "User",
    });
    return null;
  },
});

export const remove = mutation({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role && user.role !== "owner") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the account owner can delete leads" });
    }
    const lead = await ctx.db.get("leads", args.leadId);
    if (!lead) throw new ConvexError({ code: "NOT_FOUND", message: "Lead not found" });
    if (lead.ownerId !== user._id)
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    await ctx.db.delete("leads", args.leadId);
    return null;
  },
});

