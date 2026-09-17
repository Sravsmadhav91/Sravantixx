import { defineTable } from "convex/server";
import { v } from "convex/values";

export const docTypeValidator = v.union(
  v.literal("sale_agreement"),
  v.literal("possession_letter"),
  v.literal("noc"),
  v.literal("demand_notice"),
  v.literal("receipt"),
  v.literal("identity"),
  v.literal("other"),
);

export const docLinkedTypeValidator = v.union(
  v.literal("buyer"),
  v.literal("booking"),
  v.literal("project"),
);

export const documents = defineTable({
  ownerId: v.id("users"),
  linkedType: docLinkedTypeValidator,
  /** ID of the linked entity stored as string (works for any Doc type) */
  linkedId: v.string(),
  /** Denormalized display name of the linked entity for search/list */
  linkedName: v.optional(v.string()),
  storageId: v.id("_storage"),
  fileName: v.string(),
  /** MIME type at upload time */
  contentType: v.optional(v.string()),
  /** File size in bytes */
  size: v.optional(v.number()),
  docType: docTypeValidator,
  /** User-editable label (defaults to fileName) */
  label: v.optional(v.string()),
  notes: v.optional(v.string()),
  uploadedAt: v.string(),
})
  .index("by_owner", ["ownerId"])
  .index("by_linked", ["linkedType", "linkedId"])
  .index("by_owner_and_linked", ["ownerId", "linkedType", "linkedId"])
  .searchIndex("search_label", {
    searchField: "label",
    filterFields: ["ownerId"],
  });
