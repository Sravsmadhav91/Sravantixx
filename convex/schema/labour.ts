import { defineTable } from "convex/server";
import { v } from "convex/values";

export const labourEntryTypeValidator = v.union(
  v.literal("work"),
  v.literal("advance"),
  v.literal("payment"),
);

/** An individual labourer or a named labour group (e.g. "Masonry Team A"). */
export const labourers = defineTable({
  ownerId: v.id("users"),
  name: v.string(),
  /** "individual" or "group" — groups represent a gang of workers paid as one unit. */
  type: v.union(v.literal("individual"), v.literal("group")),
  /** Number of workers in the group. Always 1 for individuals. */
  memberCount: v.number(),
  phone: v.optional(v.string()),
  /** Trade/skill label, e.g. "Mason", "Electrician", "Unskilled" */
  skill: v.optional(v.string()),
  /**
   * PAN of the individual, or the group leader/representative for a group.
   * Mandatory for all new/edited labourers; optional here only so existing
   * pre-PAN-requirement records remain valid until they're next edited.
   */
  pan: v.optional(v.string()),
  /** Optional default project this labourer/group is currently working on. */
  projectId: v.optional(v.id("projects")),
  isActive: v.boolean(),
  notes: v.optional(v.string()),
  /**
   * Ledger account (liability > payables) representing amounts owed to this
   * labourer/group, so bank reconciliation and other accounting views can
   * post/select it directly. Auto-created for every labourer; optional here
   * only so pre-existing records remain valid until backfilled.
   */
  accountId: v.optional(v.id("accounts")),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_active", ["ownerId", "isActive"])
  .index("by_project", ["projectId"]);

/**
 * Simple ledger entry against a labourer/group: work done (amount owed),
 * an advance given, or a payment made. Running balance is computed at query time
 * as sum(work) - sum(advance) - sum(payment) — a positive balance means money still owed to them.
 */
export const labourLedgerEntries = defineTable({
  ownerId: v.id("users"),
  labourerId: v.id("labourers"),
  projectId: v.optional(v.id("projects")),
  type: labourEntryTypeValidator,
  date: v.string(),
  amount: v.number(),
  description: v.optional(v.string()),
  /**
   * The bank/cash account an advance or payment was paid from ("work" entries
   * don't have one — they post against the Labour Charges expense account).
   */
  sourceAccountId: v.optional(v.id("accounts")),
  /** Journal entry posted for this ledger entry, so it can be reversed on delete. */
  journalEntryId: v.optional(v.id("journalEntries")),
  /** Automatic TDS withheld when this entry is a payment. */
  tdsSection: v.optional(v.string()),
  tdsRate: v.optional(v.number()),
  tdsAmount: v.optional(v.number()),
})
  .index("by_labourer", ["labourerId"])
  .index("by_owner", ["ownerId"])
  .index("by_project", ["projectId"]);
