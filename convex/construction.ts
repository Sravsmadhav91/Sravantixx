import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, requireOwnedProject, effectiveOwnerId } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";
import type { Doc } from "./_generated/dataModel";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function requireOwnedStage(
  ctx: Parameters<typeof requireUser>[0],
  stageId: Doc<"constructionStages">["_id"],
  userId: Doc<"users">["_id"],
) {
  const stage = await ctx.db.get("constructionStages", stageId);
  if (!stage) throw new ConvexError({ message: "Stage not found", code: "NOT_FOUND" });
  if (stage.ownerId !== userId)
    throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
  return stage;
}

async function requireOwnedExpense(
  ctx: Parameters<typeof requireUser>[0],
  expenseId: Doc<"projectExpenses">["_id"],
  userId: Doc<"users">["_id"],
) {
  const expense = await ctx.db.get("projectExpenses", expenseId);
  if (!expense) throw new ConvexError({ message: "Expense not found", code: "NOT_FOUND" });
  if (expense.ownerId !== userId)
    throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
  return expense;
}

// ── Construction stages ───────────────────────────────────────────────────────

export const listStages = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<Doc<"constructionStages">[]> => {
    const user = await requireUser(ctx);
    await requireOwnedProject(ctx, args.projectId, effectiveOwnerId(user));
    return ctx.db
      .query("constructionStages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()
      .then((rows) => rows.sort((a, b) => a.order - b.order));
  },
});

export const addStage = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    order: v.number(),
    percentComplete: v.number(),
    startDate: v.optional(v.string()),
    targetDate: v.optional(v.string()),
    completedDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "construction");
    await requireOwnedProject(ctx, args.projectId, effectiveOwnerId(user));
    return ctx.db.insert("constructionStages", {
      ownerId: effectiveOwnerId(user),
      projectId: args.projectId,
      name: args.name,
      order: args.order,
      percentComplete: Math.min(100, Math.max(0, args.percentComplete)),
      startDate: args.startDate,
      targetDate: args.targetDate,
      completedDate: args.completedDate,
      notes: args.notes,
    });
  },
});

export const updateStage = mutation({
  args: {
    stageId: v.id("constructionStages"),
    name: v.optional(v.string()),
    order: v.optional(v.number()),
    percentComplete: v.optional(v.number()),
    startDate: v.optional(v.string()),
    targetDate: v.optional(v.string()),
    completedDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "construction");
    const { stageId, ...rest } = args;
    const existingStage = await requireOwnedStage(ctx, stageId, user._id);
    const patch: Partial<Doc<"constructionStages">> = {};
    if (rest.name !== undefined) patch.name = rest.name;
    if (rest.order !== undefined) patch.order = rest.order;
    if (rest.percentComplete !== undefined)
      patch.percentComplete = Math.min(100, Math.max(0, rest.percentComplete));
    if (rest.startDate !== undefined) patch.startDate = rest.startDate;
    if (rest.targetDate !== undefined) patch.targetDate = rest.targetDate;
    if (rest.completedDate !== undefined) patch.completedDate = rest.completedDate;
    if (rest.notes !== undefined) patch.notes = rest.notes;
    await ctx.db.patch("constructionStages", stageId, patch);

    // Stage-linked payment trigger: when a stage crosses into 100% completion,
    // auto-raise a demand for every pending installment linked to it.
    const justCompleted =
      existingStage.percentComplete < 100 && (patch.percentComplete ?? existingStage.percentComplete) >= 100;
    if (justCompleted) {
      const linkedInstallments = await ctx.db
        .query("paymentInstallments")
        .withIndex("by_trigger_stage", (q) => q.eq("triggerStageId", stageId))
        .collect();
      const now = new Date().toISOString();
      for (const inst of linkedInstallments) {
        if (inst.status === "pending") {
          await ctx.db.patch("paymentInstallments", inst._id, {
            status: "demanded",
            demandedAt: now,
            autoTriggeredAt: now,
          });
        }
      }
    }
  },
});

export const removeStage = mutation({
  args: { stageId: v.id("constructionStages") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role && user.role !== "owner") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the account owner can delete stages" });
    }
    await requireOwnedStage(ctx, args.stageId, user._id);
    await ctx.db.delete("constructionStages", args.stageId);
  },
});

// ── Expenses ──────────────────────────────────────────────────────────────────

export const listExpenses = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<Doc<"projectExpenses">[]> => {
    const user = await requireUser(ctx);
    await requireOwnedProject(ctx, args.projectId, effectiveOwnerId(user));
    const rows = await ctx.db
      .query("projectExpenses")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return rows.sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  },
});

export const addExpense = mutation({
  args: {
    projectId: v.id("projects"),
    category: v.union(
      v.literal("material"),
      v.literal("labour"),
      v.literal("approvals"),
      v.literal("legal"),
      v.literal("marketing"),
      v.literal("other"),
    ),
    description: v.string(),
    vendor: v.optional(v.string()),
    amount: v.number(),
    expenseDate: v.string(),
    notes: v.optional(v.string()),
    stageId: v.optional(v.id("constructionStages")),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "construction");
    await requireOwnedProject(ctx, args.projectId, effectiveOwnerId(user));
    return ctx.db.insert("projectExpenses", { ownerId: effectiveOwnerId(user), ...args });
  },
});

export const updateExpense = mutation({
  args: {
    expenseId: v.id("projectExpenses"),
    category: v.optional(
      v.union(
        v.literal("material"),
        v.literal("labour"),
        v.literal("approvals"),
        v.literal("legal"),
        v.literal("marketing"),
        v.literal("other"),
      ),
    ),
    description: v.optional(v.string()),
    vendor: v.optional(v.string()),
    amount: v.optional(v.number()),
    expenseDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    stageId: v.optional(v.id("constructionStages")),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "construction");
    const { expenseId, ...rest } = args;
    await requireOwnedExpense(ctx, expenseId, user._id);
    await ctx.db.patch("projectExpenses", expenseId, rest);
  },
});

export const removeExpense = mutation({
  args: { expenseId: v.id("projectExpenses") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role && user.role !== "owner") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the account owner can delete expenses" });
    }
    await requireOwnedExpense(ctx, args.expenseId, user._id);
    await ctx.db.delete("projectExpenses", args.expenseId);
  },
});

// ── Summary (budget vs actual) ─────────────────────────────────────────────

export type ConstructionSummary = {
  totalExpenses: number;
  byCategory: Record<string, number>;
  overallProgress: number;
  stageCount: number;
};

export const getConstructionSummary = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<ConstructionSummary> => {
    const user = await requireUser(ctx);
    await requireOwnedProject(ctx, args.projectId, effectiveOwnerId(user));

    const [stages, expenses] = await Promise.all([
      ctx.db
        .query("constructionStages")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db
        .query("projectExpenses")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
    ]);

    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    }

    const overallProgress =
      stages.length === 0
        ? 0
        : Math.round(
            stages.reduce((s, st) => s + st.percentComplete, 0) / stages.length,
          );

    return { totalExpenses, byCategory, overallProgress, stageCount: stages.length };
  },
});

// ── Bill of Quantities (BOQ) ────────────────────────────────────────────────

async function requireOwnedBoqItem(
  ctx: Parameters<typeof requireUser>[0],
  itemId: Doc<"boqItems">["_id"],
  userId: Doc<"users">["_id"],
) {
  const item = await ctx.db.get("boqItems", itemId);
  if (!item) throw new ConvexError({ message: "BOQ item not found", code: "NOT_FOUND" });
  if (item.ownerId !== userId) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
  return item;
}

export const listBoqItems = query({
  args: { stageId: v.id("constructionStages") },
  handler: async (ctx, args): Promise<Doc<"boqItems">[]> => {
    const user = await requireUser(ctx);
    await requireOwnedStage(ctx, args.stageId, effectiveOwnerId(user));
    const rows = await ctx.db
      .query("boqItems")
      .withIndex("by_stage", (q) => q.eq("stageId", args.stageId))
      .collect();
    return rows.sort((a, b) => a.order - b.order);
  },
});

export const addBoqItem = mutation({
  args: {
    stageId: v.id("constructionStages"),
    order: v.number(),
    description: v.string(),
    unit: v.string(),
    quantity: v.number(),
    rate: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "construction");
    const ownerId = effectiveOwnerId(user);
    const stage = await requireOwnedStage(ctx, args.stageId, ownerId);
    return ctx.db.insert("boqItems", {
      ownerId,
      projectId: stage.projectId,
      stageId: args.stageId,
      order: args.order,
      description: args.description,
      unit: args.unit,
      quantity: args.quantity,
      rate: args.rate,
      amount: args.quantity * args.rate,
      notes: args.notes,
    });
  },
});

export const updateBoqItem = mutation({
  args: {
    itemId: v.id("boqItems"),
    order: v.optional(v.number()),
    description: v.optional(v.string()),
    unit: v.optional(v.string()),
    quantity: v.optional(v.number()),
    rate: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "construction");
    const { itemId, ...rest } = args;
    const existing = await requireOwnedBoqItem(ctx, itemId, user._id);
    const quantity = rest.quantity ?? existing.quantity;
    const rate = rest.rate ?? existing.rate;
    await ctx.db.patch("boqItems", itemId, { ...rest, amount: quantity * rate });
  },
});

export const removeBoqItem = mutation({
  args: { itemId: v.id("boqItems") },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "construction");
    await requireOwnedBoqItem(ctx, args.itemId, user._id);
    await ctx.db.delete("boqItems", args.itemId);
  },
});

/** Estimate (BOQ total) vs actual (linked expenses) for every stage in a project. */
export type StageEstimateVsActual = {
  stageId: Doc<"constructionStages">["_id"];
  stageName: string;
  estimated: number;
  actual: number;
  variance: number;
};

export const getStageEstimateVsActual = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<StageEstimateVsActual[]> => {
    const user = await requireUser(ctx);
    await requireOwnedProject(ctx, args.projectId, effectiveOwnerId(user));

    const stages = await ctx.db
      .query("constructionStages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const results: StageEstimateVsActual[] = [];
    for (const stage of stages.sort((a, b) => a.order - b.order)) {
      const [boqItems, expenses] = await Promise.all([
        ctx.db
          .query("boqItems")
          .withIndex("by_stage", (q) => q.eq("stageId", stage._id))
          .collect(),
        ctx.db
          .query("projectExpenses")
          .withIndex("by_stage", (q) => q.eq("stageId", stage._id))
          .collect(),
      ]);
      const estimated = boqItems.reduce((s, i) => s + i.amount, 0);
      const actual = expenses.reduce((s, e) => s + e.amount, 0);
      results.push({
        stageId: stage._id,
        stageName: stage.name,
        estimated,
        actual,
        variance: estimated - actual,
      });
    }
    return results;
  },
});
