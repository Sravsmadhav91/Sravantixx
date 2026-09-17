import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  projectStatusValidator,
  projectTypeValidator,
} from "./schema/realEstate.ts";
import { requireOwnedProject, requireUser, effectiveOwnerId } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";

export type ProjectSummary = {
  totalUnits: number;
  available: number;
  onHold: number;
  booked: number;
  sold: number;
  /** Sum of base price across every unit in the project. */
  inventoryValue: number;
  soldValue: number;
};

const projectFields = {
  name: v.string(),
  code: v.string(),
  city: v.string(),
  address: v.optional(v.string()),
  type: projectTypeValidator,
  status: projectStatusValidator,
  reraNumber: v.optional(v.string()),
  launchDate: v.optional(v.string()),
  possessionDate: v.optional(v.string()),
  constructionBudget: v.optional(v.number()),
  notes: v.optional(v.string()),
};

function emptySummary(): ProjectSummary {
  return {
    totalUnits: 0,
    available: 0,
    onHold: 0,
    booked: 0,
    sold: 0,
    inventoryValue: 0,
    soldValue: 0,
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .collect();

    // One owner's unit set is small enough to aggregate in a single pass.
    const units = await ctx.db
      .query("units")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();

    const summaries = new Map<Id<"projects">, ProjectSummary>();
    for (const unit of units) {
      const summary = summaries.get(unit.projectId) ?? emptySummary();
      summary.totalUnits += 1;
      summary.inventoryValue += unit.price;
      if (unit.status === "available") summary.available += 1;
      if (unit.status === "on_hold") summary.onHold += 1;
      if (unit.status === "booked") summary.booked += 1;
      if (unit.status === "sold") {
        summary.sold += 1;
        summary.soldValue += unit.price;
      }
      summaries.set(unit.projectId, summary);
    }

    return projects.map((project) => ({
      ...project,
      summary: summaries.get(project._id) ?? emptySummary(),
    }));
  },
});

export const getById = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return requireOwnedProject(ctx, args.projectId, effectiveOwnerId(user));
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const project = await requireOwnedProject(ctx, args.projectId, effectiveOwnerId(user));

    const units = await ctx.db
      .query("units")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    const summary = emptySummary();
    for (const unit of units) {
      summary.totalUnits += 1;
      summary.inventoryValue += unit.price;
      if (unit.status === "available") summary.available += 1;
      if (unit.status === "on_hold") summary.onHold += 1;
      if (unit.status === "booked") summary.booked += 1;
      if (unit.status === "sold") {
        summary.sold += 1;
        summary.soldValue += unit.price;
      }
    }

    return { ...project, summary };
  },
});

/** Search projects by name/code — used by global search. Scales via search index instead of a full scan. */
export const search = query({
  args: { search: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    if (args.search.trim().length === 0) return [];
    return await ctx.db
      .query("projects")
      .withSearchIndex("search_name", (q) =>
        q.search("name", args.search).eq("ownerId", ownerId),
      )
      .take(10);
  },
});

export const create = mutation({
  args: projectFields,
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "projects");
    const ownerId = effectiveOwnerId(user);
    const duplicate = await ctx.db
      .query("projects")
      .withIndex("by_owner_and_name", (q) =>
        q.eq("ownerId", ownerId).eq("name", args.name),
      )
      .first();
    if (duplicate) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "A project with this name already exists",
      });
    }
    return await ctx.db.insert("projects", { ...args, ownerId });
  },
});

export const update = mutation({
  args: { projectId: v.id("projects"), ...projectFields },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "projects");
    const { projectId, ...fields } = args;
    await requireOwnedProject(ctx, projectId, effectiveOwnerId(user));
    await ctx.db.patch("projects", projectId, fields);
    return projectId;
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    // Only owners can delete projects
    if (user.role && user.role !== "owner") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the account owner can delete projects" });
    }
    await requireOwnedProject(ctx, args.projectId, user._id);

    const blocking = await ctx.db
      .query("units")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const committed = blocking.filter(
      (unit) => unit.status === "booked" || unit.status === "sold",
    );
    if (committed.length > 0) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `This project has ${committed.length} booked or sold unit(s) and cannot be deleted`,
      });
    }

    for (const unit of blocking) {
      await ctx.db.delete("units", unit._id);
    }
    await ctx.db.delete("projects", args.projectId);
    return null;
  },
});
