import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { requireUser } from "./lib/auth.ts";
import { activityTypeValidator, linkedTypeValidator, taskPriorityValidator } from "./schema/crm.ts";

// ── Activities ────────────────────────────────────────────────────────────────

export const listActivities = query({
  args: {
    linkedType: linkedTypeValidator,
    linkedId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("crmActivities")
      .withIndex("by_linked", (q) =>
        q.eq("linkedType", args.linkedType).eq("linkedId", args.linkedId),
      )
      .order("desc")
      .take(100);
  },
});

export const addActivity = mutation({
  args: {
    linkedType: linkedTypeValidator,
    linkedId: v.string(),
    activityType: activityTypeValidator,
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await ctx.db.insert("crmActivities", {
      ownerId: user._id,
      linkedType: args.linkedType,
      linkedId: args.linkedId,
      activityType: args.activityType,
      note: args.note.trim(),
      createdByName: user.name ?? user.email ?? "User",
    });
  },
});

export const deleteActivity = mutation({
  args: { activityId: v.id("crmActivities") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const activity = await ctx.db.get("crmActivities", args.activityId);
    if (!activity) throw new ConvexError({ message: "Activity not found", code: "NOT_FOUND" });
    if (activity.ownerId !== user._id) {
      throw new ConvexError({ message: "Not authorised", code: "FORBIDDEN" });
    }
    await ctx.db.delete("crmActivities", args.activityId);
  },
});

// ── Tasks ────────────────────────────────────────────────────────────────────

export const listAllTasks = query({
  args: {
    status: v.optional(v.union(v.literal("open"), v.literal("done"))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const q = args.status
      ? ctx.db
          .query("crmTasks")
          .withIndex("by_owner_and_status", (q) =>
            q.eq("ownerId", user._id).eq("status", args.status!),
          )
      : ctx.db.query("crmTasks").withIndex("by_owner", (q) => q.eq("ownerId", user._id));
    return await q.collect();
  },
});

export const listTasksForEntity = query({
  args: {
    linkedType: linkedTypeValidator,
    linkedId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("crmTasks")
      .withIndex("by_linked", (q) =>
        q.eq("linkedType", args.linkedType).eq("linkedId", args.linkedId),
      )
      .order("asc")
      .collect();
  },
});

export const createTask = mutation({
  args: {
    linkedType: linkedTypeValidator,
    linkedId: v.string(),
    linkedName: v.optional(v.string()),
    title: v.string(),
    dueDate: v.string(),
    priority: taskPriorityValidator,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const taskId = await ctx.db.insert("crmTasks", {
      ownerId: user._id,
      linkedType: args.linkedType,
      linkedId: args.linkedId,
      linkedName: args.linkedName,
      title: args.title.trim(),
      dueDate: args.dueDate,
      priority: args.priority,
      status: "open",
      notes: args.notes?.trim(),
    });
    return taskId;
  },
});

export const completeTask = mutation({
  args: { taskId: v.id("crmTasks") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const task = await ctx.db.get("crmTasks", args.taskId);
    if (!task) throw new ConvexError({ message: "Task not found", code: "NOT_FOUND" });
    if (task.ownerId !== user._id) {
      throw new ConvexError({ message: "Not authorised", code: "FORBIDDEN" });
    }
    await ctx.db.patch("crmTasks", args.taskId, {
      status: "done",
      completedAt: new Date().toISOString(),
    });
    // Log activity on the linked entity
    await ctx.db.insert("crmActivities", {
      ownerId: user._id,
      linkedType: task.linkedType,
      linkedId: task.linkedId,
      activityType: "task_completed",
      note: `Task completed: ${task.title}`,
      createdByName: user.name ?? user.email ?? "User",
    });
  },
});

export const reopenTask = mutation({
  args: { taskId: v.id("crmTasks") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const task = await ctx.db.get("crmTasks", args.taskId);
    if (!task) throw new ConvexError({ message: "Task not found", code: "NOT_FOUND" });
    if (task.ownerId !== user._id) {
      throw new ConvexError({ message: "Not authorised", code: "FORBIDDEN" });
    }
    await ctx.db.patch("crmTasks", args.taskId, { status: "open", completedAt: undefined });
  },
});

export const deleteTask = mutation({
  args: { taskId: v.id("crmTasks") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const task = await ctx.db.get("crmTasks", args.taskId);
    if (!task) throw new ConvexError({ message: "Task not found", code: "NOT_FOUND" });
    if (task.ownerId !== user._id) {
      throw new ConvexError({ message: "Not authorised", code: "FORBIDDEN" });
    }
    await ctx.db.delete("crmTasks", args.taskId);
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("crmTasks"),
    title: v.string(),
    dueDate: v.string(),
    priority: taskPriorityValidator,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const task = await ctx.db.get("crmTasks", args.taskId);
    if (!task) throw new ConvexError({ message: "Task not found", code: "NOT_FOUND" });
    if (task.ownerId !== user._id) {
      throw new ConvexError({ message: "Not authorised", code: "FORBIDDEN" });
    }
    await ctx.db.patch("crmTasks", args.taskId, {
      title: args.title.trim(),
      dueDate: args.dueDate,
      priority: args.priority,
      notes: args.notes?.trim(),
    });
  },
});
