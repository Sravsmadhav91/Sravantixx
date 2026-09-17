import { defineTable } from "convex/server";
import { v } from "convex/values";

export const activityTypeValidator = v.union(
  v.literal("note"),
  v.literal("call"),
  v.literal("meeting"),
  v.literal("email"),
  v.literal("status_change"),
  v.literal("booking_created"),
  v.literal("payment_received"),
  v.literal("document_sent"),
  v.literal("task_completed"),
);

export const linkedTypeValidator = v.union(
  v.literal("buyer"),
  v.literal("lead"),
  v.literal("booking"),
);

export const crmActivities = defineTable({
  ownerId: v.id("users"),
  linkedType: linkedTypeValidator,
  /** Stored as a string so it works for any entity Id type */
  linkedId: v.string(),
  activityType: activityTypeValidator,
  note: v.string(),
  /** Name of the user who created the activity (denormalized for display) */
  createdByName: v.optional(v.string()),
})
  .index("by_owner", ["ownerId"])
  .index("by_linked", ["linkedType", "linkedId"])
  .index("by_owner_and_linked", ["ownerId", "linkedType", "linkedId"]);

export const taskPriorityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

export const taskStatusValidator = v.union(
  v.literal("open"),
  v.literal("done"),
);

export const crmTasks = defineTable({
  ownerId: v.id("users"),
  linkedType: linkedTypeValidator,
  /** Stored as a string so it works for any entity Id type */
  linkedId: v.string(),
  /** Denormalized display name of the linked entity (buyer/lead name) */
  linkedName: v.optional(v.string()),
  title: v.string(),
  /** YYYY-MM-DD due date in user's local time */
  dueDate: v.string(),
  priority: taskPriorityValidator,
  status: taskStatusValidator,
  /** ISO timestamp when task was marked done */
  completedAt: v.optional(v.string()),
  notes: v.optional(v.string()),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_status", ["ownerId", "status"])
  .index("by_linked", ["linkedType", "linkedId"])
  .index("by_owner_due", ["ownerId", "dueDate"]);
