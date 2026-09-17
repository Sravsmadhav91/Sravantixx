import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { effectiveOwnerId, requireOwner, requireUser } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function requireOwnedItem(
  ctx: QueryCtx | MutationCtx,
  itemId: Id<"stockItems">,
  ownerId: Id<"users">,
): Promise<Doc<"stockItems">> {
  const item = await ctx.db.get("stockItems", itemId);
  if (!item || item.ownerId !== ownerId) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Stock item not found" });
  }
  return item;
}

async function requireOwnedGodown(
  ctx: QueryCtx | MutationCtx,
  godownId: Id<"stockGodowns">,
  ownerId: Id<"users">,
): Promise<Doc<"stockGodowns">> {
  const godown = await ctx.db.get("stockGodowns", godownId);
  if (!godown || godown.ownerId !== ownerId) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Godown not found" });
  }
  return godown;
}

async function getBalance(
  ctx: QueryCtx | MutationCtx,
  stockItemId: Id<"stockItems">,
  godownId: Id<"stockGodowns">,
): Promise<Doc<"stockBalances"> | null> {
  return ctx.db
    .query("stockBalances")
    .withIndex("by_item_and_godown", (q) => q.eq("stockItemId", stockItemId).eq("godownId", godownId))
    .unique();
}

/** Applies a signed quantity/value delta to the item×godown balance, creating the row if needed. */
async function applyBalanceDelta(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  stockItemId: Id<"stockItems">,
  godownId: Id<"stockGodowns">,
  qtyDelta: number,
  valueDelta: number,
): Promise<void> {
  const balance = await getBalance(ctx, stockItemId, godownId);
  if (!balance) {
    await ctx.db.insert("stockBalances", {
      ownerId,
      stockItemId,
      godownId,
      quantity: qtyDelta,
      value: valueDelta,
    });
    return;
  }
  await ctx.db.patch("stockBalances", balance._id, {
    quantity: balance.quantity + qtyDelta,
    value: balance.value + valueDelta,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GODOWNS
// ═══════════════════════════════════════════════════════════════════════════

export const listGodowns = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    let godowns = await ctx.db
      .query("stockGodowns")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    if (args.activeOnly) godowns = godowns.filter((g) => g.isActive);
    return godowns.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createGodown = mutation({
  args: { name: v.string(), address: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Id<"stockGodowns">> => {
    const user = await requireModuleAccess(ctx, "inventory");
    return ctx.db.insert("stockGodowns", {
      ownerId: user._id,
      name: args.name,
      address: args.address,
      isActive: true,
    });
  },
});

export const updateGodown = mutation({
  args: {
    godownId: v.id("stockGodowns"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "inventory");
    const { godownId, ...updates } = args;
    await requireOwnedGodown(ctx, godownId, user._id);
    await ctx.db.patch("stockGodowns", godownId, updates);
  },
});

export const deleteGodown = mutation({
  args: { godownId: v.id("stockGodowns") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireOwner(ctx);
    await requireOwnedGodown(ctx, args.godownId, user._id);
    const movement = await ctx.db
      .query("stockMovements")
      .withIndex("by_godown", (q) => q.eq("godownId", args.godownId))
      .first();
    if (movement) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Cannot delete a godown with stock movements. Deactivate it instead.",
      });
    }
    await ctx.db.delete("stockGodowns", args.godownId);
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// STOCK ITEMS
// ═══════════════════════════════════════════════════════════════════════════

export const listItems = query({
  args: { activeOnly: v.optional(v.boolean()), search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    let items = await ctx.db
      .query("stockItems")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    if (args.activeOnly) items = items.filter((i) => i.isActive);
    if (args.search) {
      const q = args.search.toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
    }

    const balances = await ctx.db
      .query("stockBalances")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    const totalsByItem = new Map<string, { quantity: number; value: number }>();
    for (const b of balances) {
      const existing = totalsByItem.get(b.stockItemId) ?? { quantity: 0, value: 0 };
      existing.quantity += b.quantity;
      existing.value += b.value;
      totalsByItem.set(b.stockItemId, existing);
    }

    return items
      .map((i) => {
        const totals = totalsByItem.get(i._id) ?? { quantity: 0, value: 0 };
        return {
          ...i,
          totalQuantity: totals.quantity,
          totalValue: totals.value,
          isLowStock: i.reorderLevel != null && totals.quantity < i.reorderLevel,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createItem = mutation({
  args: {
    sku: v.string(),
    name: v.string(),
    unit: v.string(),
    category: v.optional(v.string()),
    reorderLevel: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"stockItems">> => {
    const user = await requireModuleAccess(ctx, "inventory");
    const ownerId = user._id;

    const existing = await ctx.db
      .query("stockItems")
      .withIndex("by_owner_and_sku", (q) => q.eq("ownerId", ownerId).eq("sku", args.sku))
      .unique();
    if (existing) {
      throw new ConvexError({ code: "CONFLICT", message: `SKU ${args.sku} already exists` });
    }

    return ctx.db.insert("stockItems", { ownerId, ...args, isActive: true });
  },
});

export const updateItem = mutation({
  args: {
    itemId: v.id("stockItems"),
    name: v.optional(v.string()),
    unit: v.optional(v.string()),
    category: v.optional(v.string()),
    reorderLevel: v.optional(v.number()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "inventory");
    const { itemId, ...updates } = args;
    await requireOwnedItem(ctx, itemId, user._id);
    await ctx.db.patch("stockItems", itemId, updates);
  },
});

export const deleteItem = mutation({
  args: { itemId: v.id("stockItems") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireOwner(ctx);
    await requireOwnedItem(ctx, args.itemId, user._id);
    const movement = await ctx.db
      .query("stockMovements")
      .withIndex("by_item_and_date", (q) => q.eq("stockItemId", args.itemId))
      .first();
    if (movement) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Cannot delete an item with stock movements. Deactivate it instead.",
      });
    }
    await ctx.db.delete("stockItems", args.itemId);
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// STOCK MOVEMENTS
// ═══════════════════════════════════════════════════════════════════════════

export const listMovements = query({
  args: { itemId: v.optional(v.id("stockItems")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    let movements: Doc<"stockMovements">[];
    if (args.itemId) {
      movements = await ctx.db
        .query("stockMovements")
        .withIndex("by_item_and_date", (q) => q.eq("stockItemId", args.itemId!))
        .order("desc")
        .take(args.limit ?? 200);
    } else {
      movements = await ctx.db
        .query("stockMovements")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .order("desc")
        .take(args.limit ?? 200);
    }
    movements = movements.filter((m) => m.ownerId === ownerId);

    const itemIds = [...new Set(movements.map((m) => m.stockItemId))];
    const godownIds = [...new Set([...movements.map((m) => m.godownId), ...movements.map((m) => m.linkedGodownId).filter((g): g is Id<"stockGodowns"> => !!g)])];
    const itemMap = new Map<string, Doc<"stockItems">>();
    for (const id of itemIds) {
      const item = await ctx.db.get("stockItems", id);
      if (item) itemMap.set(id, item);
    }
    const godownMap = new Map<string, Doc<"stockGodowns">>();
    for (const id of godownIds) {
      const godown = await ctx.db.get("stockGodowns", id);
      if (godown) godownMap.set(id, godown);
    }

    return movements.map((m) => ({
      ...m,
      itemName: itemMap.get(m.stockItemId)?.name ?? "Unknown",
      itemSku: itemMap.get(m.stockItemId)?.sku ?? "",
      itemUnit: itemMap.get(m.stockItemId)?.unit ?? "",
      godownName: godownMap.get(m.godownId)?.name ?? "Unknown",
      linkedGodownName: m.linkedGodownId ? godownMap.get(m.linkedGodownId)?.name : undefined,
    }));
  },
});

const movementCommonArgs = {
  itemId: v.id("stockItems"),
  godownId: v.id("stockGodowns"),
  date: v.string(),
  quantity: v.number(),
  notes: v.optional(v.string()),
};

export const recordOpeningStock = mutation({
  args: {
    ...movementCommonArgs,
    rate: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "inventory");
    const ownerId = user._id;
    await requireOwnedItem(ctx, args.itemId, ownerId);
    await requireOwnedGodown(ctx, args.godownId, ownerId);
    if (args.quantity <= 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Quantity must be positive" });
    }

    const existing = await getBalance(ctx, args.itemId, args.godownId);
    if (existing && existing.quantity !== 0) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "This item already has stock in this godown. Use an adjustment instead.",
      });
    }

    const amount = args.quantity * args.rate;
    await ctx.db.insert("stockMovements", {
      ownerId,
      stockItemId: args.itemId,
      godownId: args.godownId,
      type: "opening",
      date: args.date,
      quantity: args.quantity,
      rate: args.rate,
      amount,
      notes: args.notes,
    });
    await applyBalanceDelta(ctx, ownerId, args.itemId, args.godownId, args.quantity, amount);
  },
});

export const receiveStock = mutation({
  args: {
    ...movementCommonArgs,
    rate: v.number(),
    projectId: v.optional(v.id("projects")),
    purchaseInvoiceId: v.optional(v.id("purchaseInvoices")),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "inventory");
    const ownerId = effectiveOwnerId(user);
    await requireOwnedItem(ctx, args.itemId, ownerId);
    await requireOwnedGodown(ctx, args.godownId, ownerId);
    if (args.quantity <= 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Quantity must be positive" });
    }

    const amount = args.quantity * args.rate;
    await ctx.db.insert("stockMovements", {
      ownerId,
      stockItemId: args.itemId,
      godownId: args.godownId,
      type: "purchase_in",
      date: args.date,
      quantity: args.quantity,
      rate: args.rate,
      amount,
      projectId: args.projectId,
      purchaseInvoiceId: args.purchaseInvoiceId,
      notes: args.notes,
    });
    await applyBalanceDelta(ctx, ownerId, args.itemId, args.godownId, args.quantity, amount);
  },
});

export const issueStock = mutation({
  args: {
    ...movementCommonArgs,
    projectId: v.optional(v.id("projects")),
    constructionStageId: v.optional(v.id("constructionStages")),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "inventory");
    const ownerId = effectiveOwnerId(user);
    await requireOwnedItem(ctx, args.itemId, ownerId);
    await requireOwnedGodown(ctx, args.godownId, ownerId);
    if (args.quantity <= 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Quantity must be positive" });
    }

    const balance = await getBalance(ctx, args.itemId, args.godownId);
    if (!balance || balance.quantity < args.quantity) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Insufficient stock. Available: ${balance?.quantity ?? 0}`,
      });
    }

    // Moving-average cost: use the current average rate for this issue.
    const avgRate = balance.quantity > 0 ? balance.value / balance.quantity : 0;
    const amount = args.quantity * avgRate;

    await ctx.db.insert("stockMovements", {
      ownerId,
      stockItemId: args.itemId,
      godownId: args.godownId,
      type: "consumption_out",
      date: args.date,
      quantity: args.quantity,
      rate: avgRate,
      amount,
      projectId: args.projectId,
      constructionStageId: args.constructionStageId,
      notes: args.notes,
    });
    await applyBalanceDelta(ctx, ownerId, args.itemId, args.godownId, -args.quantity, -amount);
  },
});

export const adjustStock = mutation({
  args: {
    ...movementCommonArgs,
    direction: v.union(v.literal("in"), v.literal("out")),
    rate: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "inventory");
    const ownerId = user._id;
    await requireOwnedItem(ctx, args.itemId, ownerId);
    await requireOwnedGodown(ctx, args.godownId, ownerId);
    if (args.quantity <= 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Quantity must be positive" });
    }

    const balance = await getBalance(ctx, args.itemId, args.godownId);
    const avgRate = balance && balance.quantity > 0 ? balance.value / balance.quantity : 0;

    if (args.direction === "out") {
      if (!balance || balance.quantity < args.quantity) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: `Insufficient stock. Available: ${balance?.quantity ?? 0}`,
        });
      }
      const amount = args.quantity * avgRate;
      await ctx.db.insert("stockMovements", {
        ownerId,
        stockItemId: args.itemId,
        godownId: args.godownId,
        type: "adjustment_out",
        date: args.date,
        quantity: args.quantity,
        rate: avgRate,
        amount,
        notes: args.notes,
      });
      await applyBalanceDelta(ctx, ownerId, args.itemId, args.godownId, -args.quantity, -amount);
    } else {
      const rate = args.rate ?? avgRate;
      const amount = args.quantity * rate;
      await ctx.db.insert("stockMovements", {
        ownerId,
        stockItemId: args.itemId,
        godownId: args.godownId,
        type: "adjustment_in",
        date: args.date,
        quantity: args.quantity,
        rate,
        amount,
        notes: args.notes,
      });
      await applyBalanceDelta(ctx, ownerId, args.itemId, args.godownId, args.quantity, amount);
    }
  },
});

export const transferStock = mutation({
  args: {
    itemId: v.id("stockItems"),
    fromGodownId: v.id("stockGodowns"),
    toGodownId: v.id("stockGodowns"),
    date: v.string(),
    quantity: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "inventory");
    const ownerId = effectiveOwnerId(user);
    await requireOwnedItem(ctx, args.itemId, ownerId);
    await requireOwnedGodown(ctx, args.fromGodownId, ownerId);
    await requireOwnedGodown(ctx, args.toGodownId, ownerId);
    if (args.fromGodownId === args.toGodownId) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Source and destination godowns must differ" });
    }
    if (args.quantity <= 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Quantity must be positive" });
    }

    const fromBalance = await getBalance(ctx, args.itemId, args.fromGodownId);
    if (!fromBalance || fromBalance.quantity < args.quantity) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Insufficient stock. Available: ${fromBalance?.quantity ?? 0}`,
      });
    }

    const avgRate = fromBalance.quantity > 0 ? fromBalance.value / fromBalance.quantity : 0;
    const amount = args.quantity * avgRate;

    await ctx.db.insert("stockMovements", {
      ownerId,
      stockItemId: args.itemId,
      godownId: args.fromGodownId,
      type: "transfer_out",
      date: args.date,
      quantity: args.quantity,
      rate: avgRate,
      amount,
      linkedGodownId: args.toGodownId,
      notes: args.notes,
    });
    await ctx.db.insert("stockMovements", {
      ownerId,
      stockItemId: args.itemId,
      godownId: args.toGodownId,
      type: "transfer_in",
      date: args.date,
      quantity: args.quantity,
      rate: avgRate,
      amount,
      linkedGodownId: args.fromGodownId,
      notes: args.notes,
    });

    await applyBalanceDelta(ctx, ownerId, args.itemId, args.fromGodownId, -args.quantity, -amount);
    await applyBalanceDelta(ctx, ownerId, args.itemId, args.toGodownId, args.quantity, amount);
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// VALUATION REPORT
// ═══════════════════════════════════════════════════════════════════════════

export const getStockValuation = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    const [items, godowns, balances] = await Promise.all([
      ctx.db.query("stockItems").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("stockGodowns").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("stockBalances").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
    ]);

    const itemMap = new Map(items.map((i) => [i._id, i]));
    const godownMap = new Map(godowns.map((g) => [g._id, g]));

    const rows = balances
      .filter((b) => Math.abs(b.quantity) > 0.0001)
      .map((b) => {
        const item = itemMap.get(b.stockItemId);
        const godown = godownMap.get(b.godownId);
        return {
          stockItemId: b.stockItemId,
          itemName: item?.name ?? "Unknown",
          sku: item?.sku ?? "",
          unit: item?.unit ?? "",
          godownId: b.godownId,
          godownName: godown?.name ?? "Unknown",
          quantity: b.quantity,
          value: b.value,
          avgRate: b.quantity !== 0 ? b.value / b.quantity : 0,
        };
      })
      .sort((a, b) => a.itemName.localeCompare(b.itemName) || a.godownName.localeCompare(b.godownName));

    return {
      rows,
      totalValue: rows.reduce((s, r) => s + r.value, 0),
      itemCount: items.filter((i) => i.isActive).length,
      lowStockCount: items.filter((i) => {
        if (!i.isActive || i.reorderLevel == null) return false;
        const total = balances.filter((b) => b.stockItemId === i._id).reduce((s, b) => s + b.quantity, 0);
        return total < i.reorderLevel;
      }).length,
    };
  },
});
