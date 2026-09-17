import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Per-owner GST registration profile, used to populate GSTR-1/3B headers. */
export const gstSettings = defineTable({
  ownerId: v.id("users"),
  gstin: v.optional(v.string()),
  legalName: v.optional(v.string()),
  tradeName: v.optional(v.string()),
  stateName: v.optional(v.string()),
  /** 2-digit GST state code, e.g. "29" for Karnataka */
  stateCode: v.optional(v.string()),
}).index("by_owner", ["ownerId"]);
