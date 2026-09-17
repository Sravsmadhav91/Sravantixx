import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Stock movement types, Tally-style:
 * - opening: initial stock balance when an item/godown is first set up
 * - purchase_in: goods received against a purchase invoice
 * - consumption_out: material issued/consumed (e.g. for a construction stage)
 * - adjustment_in / adjustment_out: manual correction (damage, physical count, etc.)
 * - transfer_in / transfer_out: movement between godowns (always created as a pair)
 */
export const stockMovementTypeValidator = v.union(
  v.literal("opening"),
  v.literal("purchase_in"),
  v.literal("consumption_out"),
  v.literal("adjustment_in"),
  v.literal("adjustment_out"),
  v.literal("transfer_in"),
  v.literal("transfer_out"),
);

export const stockGodowns = defineTable({
  ownerId: v.id("users"),
  name: v.string(),
  address: v.optional(v.string()),
  isActive: v.boolean(),
})
  .index("by_owner", ["ownerId"]);

export const stockItems = defineTable({
  ownerId: v.id("users"),
  /** Short unique code, e.g. "CEM-OPC53" */
  sku: v.string(),
  name: v.string(),
  /** Unit of measure label, e.g. "Bags", "Kg", "Cum", "Sqft", "Nos" */
  unit: v.string(),
  category: v.optional(v.string()),
  /** Alert threshold — total quantity across godowns below this is "low stock" */
  reorderLevel: v.optional(v.number()),
  isActive: v.boolean(),
  notes: v.optional(v.string()),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_sku", ["ownerId", "sku"]);

/** Denormalized running balance per item per godown, kept in sync by every movement mutation. */
export const stockBalances = defineTable({
  ownerId: v.id("users"),
  stockItemId: v.id("stockItems"),
  godownId: v.id("stockGodowns"),
  quantity: v.number(),
  /** Total value at moving-average cost */
  value: v.number(),
})
  .index("by_item_and_godown", ["stockItemId", "godownId"])
  .index("by_owner", ["ownerId"]);

export const stockMovements = defineTable({
  ownerId: v.id("users"),
  stockItemId: v.id("stockItems"),
  godownId: v.id("stockGodowns"),
  type: stockMovementTypeValidator,
  /** ISO date (YYYY-MM-DD) */
  date: v.string(),
  quantity: v.number(),
  /** Rate per unit used for this movement (moving-average cost for "out" movements) */
  rate: v.number(),
  amount: v.number(),
  /** For a transfer pair, the other godown involved */
  linkedGodownId: v.optional(v.id("stockGodowns")),
  /** Optional traceability links */
  projectId: v.optional(v.id("projects")),
  constructionStageId: v.optional(v.id("constructionStages")),
  purchaseInvoiceId: v.optional(v.id("purchaseInvoices")),
  notes: v.optional(v.string()),
})
  .index("by_owner", ["ownerId"])
  .index("by_item_and_date", ["stockItemId", "date"])
  .index("by_godown", ["godownId"]);
