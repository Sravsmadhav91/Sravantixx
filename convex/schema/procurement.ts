import { defineTable } from "convex/server";
import { v } from "convex/values";

export const materialRequestStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("ordered"),
);

/** A request raised by a Site Engineer for materials needed on a project, before a Purchase Order exists. */
export const materialRequests = defineTable({
  ownerId: v.id("users"),
  projectId: v.id("projects"),
  /** Auto-generated: MR-2025-001 */
  requestNumber: v.string(),
  requestedById: v.id("users"),
  requestDate: v.string(),
  neededByDate: v.optional(v.string()),
  status: materialRequestStatusValidator,
  notes: v.optional(v.string()),
  reviewedById: v.optional(v.id("users")),
  reviewedAt: v.optional(v.string()),
  rejectionReason: v.optional(v.string()),
  /** Set once approved and converted into a purchase order. */
  linkedPurchaseOrderId: v.optional(v.id("purchaseOrders")),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_status", ["ownerId", "status"])
  .index("by_project", ["projectId"]);

export const materialRequestLines = defineTable({
  ownerId: v.id("users"),
  materialRequestId: v.id("materialRequests"),
  /** Optional link to an existing stock item master for consistent naming/units. */
  stockItemId: v.optional(v.id("stockItems")),
  description: v.string(),
  unit: v.string(),
  quantity: v.number(),
  /** Optional estimated unit rate, carried into a purchase order conversion. */
  rate: v.optional(v.number()),
  /** GST percentage quoted for this material line. */
  gstRate: v.optional(v.number()),
  /** Derived quantity multiplied by rate, stored for quotation traceability. */
  amount: v.optional(v.number()),
  notes: v.optional(v.string()),
})
  .index("by_request", ["materialRequestId"])
  .index("by_owner", ["ownerId"]);

/**
 * A subcontract: the total agreed value of work awarded to a vendor for a project.
 * Payments against it are tracked via linked purchase invoices — this table only
 * stores the contract terms, and derived paid/balance figures are computed at query time.
 */
export const subcontracts = defineTable({
  ownerId: v.id("users"),
  projectId: v.id("projects"),
  vendorId: v.id("vendors"),
  title: v.string(),
  contractValue: v.number(),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
  notes: v.optional(v.string()),
  isActive: v.boolean(),
})
  .index("by_owner", ["ownerId"])
  .index("by_project", ["projectId"])
  .index("by_vendor", ["vendorId"])
  .index("by_owner_and_vendor", ["ownerId", "vendorId"]);

/**
 * Links a purchase invoice (existing AP document) to a subcontract, so
 * "paid so far" for the contract can be rolled up from real payments.
 */
export const subcontractInvoices = defineTable({
  ownerId: v.id("users"),
  subcontractId: v.id("subcontracts"),
  purchaseInvoiceId: v.id("purchaseInvoices"),
})
  .index("by_subcontract", ["subcontractId"])
  .index("by_invoice", ["purchaseInvoiceId"])
  .index("by_owner", ["ownerId"]);
