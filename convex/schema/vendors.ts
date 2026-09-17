import { defineTable } from "convex/server";
import { v } from "convex/values";

export const purchaseInvoiceStatusValidator = v.union(
  v.literal("draft"),
  v.literal("approved"),
  v.literal("paid"),
  v.literal("cancelled"),
);

export const purchaseOrderStatusValidator = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("partially_received"),
  v.literal("received"),
  v.literal("cancelled"),
);

export const purchaseOrders = defineTable({
  ownerId: v.id("users"),
  vendorId: v.id("vendors"),
  /** Auto-generated: PO-2025-001 */
  poNumber: v.string(),
  date: v.string(),
  expectedDeliveryDate: v.optional(v.string()),
  status: purchaseOrderStatusValidator,
  /** Optional project link */
  projectId: v.optional(v.id("projects")),
  subtotal: v.number(),
  cgst: v.number(),
  sgst: v.number(),
  igst: v.number(),
  /** Grand total = subtotal + cgst + sgst + igst */
  total: v.number(),
  narration: v.optional(v.string()),
  /** Set when converted to a purchase invoice */
  linkedInvoiceId: v.optional(v.id("purchaseInvoices")),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_vendor", ["ownerId", "vendorId"])
  .index("by_owner_and_date", ["ownerId", "date"])
  .index("by_owner_and_status", ["ownerId", "status"]);

export const purchaseOrderLines = defineTable({
  ownerId: v.id("users"),
  purchaseOrderId: v.id("purchaseOrders"),
  description: v.string(),
  accountId: v.optional(v.id("accounts")),
  quantity: v.number(),
  unit: v.optional(v.string()),
  rate: v.number(),
  amount: v.number(),
  gstRate: v.optional(v.number()),
})
  .index("by_po", ["purchaseOrderId"])
  .index("by_owner", ["ownerId"]);

export const vendors = defineTable({
  ownerId: v.id("users"),
  name: v.string(),
  /** GSTIN like 29AAAAA0000A1Z5 */
  gstin: v.optional(v.string()),
  pan: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  address: v.optional(v.string()),
  city: v.optional(v.string()),
  state: v.optional(v.string()),
  pincode: v.optional(v.string()),
  /** Bank account number */
  bankAccount: v.optional(v.string()),
  bankIfsc: v.optional(v.string()),
  bankName: v.optional(v.string()),
  /** Category: contractor, material_supplier, consultant, utility, other */
  category: v.string(),
  isActive: v.boolean(),
  notes: v.optional(v.string()),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_name", ["ownerId", "name"])
  .index("by_owner_and_gstin", ["ownerId", "gstin"]);

export const purchaseInvoices = defineTable({
  ownerId: v.id("users"),
  vendorId: v.id("vendors"),
  /** Invoice number assigned by the vendor */
  invoiceNumber: v.string(),
  /** Our internal reference like "PI-2025-001" */
  internalRef: v.string(),
  date: v.string(),
  dueDate: v.optional(v.string()),
  status: purchaseInvoiceStatusValidator,
  /** Optional project link for cost tracking */
  projectId: v.optional(v.id("projects")),
  /** Subtotal before tax */
  subtotal: v.number(),
  /** CGST amount */
  cgst: v.number(),
  /** SGST amount */
  sgst: v.number(),
  /** IGST amount */
  igst: v.number(),
  /** TDS deducted */
  tds: v.number(),
  /** Grand total = subtotal + cgst + sgst + igst - tds */
  total: v.number(),
  /** Amount already paid */
  amountPaid: v.number(),
  narration: v.optional(v.string()),
  /** Link to the journal entry created on approval */
  journalEntryId: v.optional(v.id("journalEntries")),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_vendor", ["ownerId", "vendorId"])
  .index("by_owner_and_date", ["ownerId", "date"])
  .index("by_owner_and_status", ["ownerId", "status"]);

export const purchaseInvoiceLines = defineTable({
  ownerId: v.id("users"),
  purchaseInvoiceId: v.id("purchaseInvoices"),
  description: v.string(),
  /** Optional account to debit (defaults to relevant expense account) */
  accountId: v.optional(v.id("accounts")),
  quantity: v.number(),
  unit: v.optional(v.string()),
  rate: v.number(),
  amount: v.number(),
  /** GST rate percentage e.g. 18 */
  gstRate: v.optional(v.number()),
})
  .index("by_invoice", ["purchaseInvoiceId"])
  .index("by_owner", ["ownerId"]);
