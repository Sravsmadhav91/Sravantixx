import { defineTable } from "convex/server";
import { v } from "convex/values";

export const projectTypeValidator = v.union(
  v.literal("apartment"),
  v.literal("plotted"),
  v.literal("villa"),
  v.literal("commercial"),
);

export const projectStatusValidator = v.union(
  v.literal("planning"),
  v.literal("under_construction"),
  v.literal("ready"),
  v.literal("completed"),
);

export const unitStatusValidator = v.union(
  v.literal("available"),
  v.literal("on_hold"),
  v.literal("booked"),
  v.literal("sold"),
);

export const installmentStatusValidator = v.union(
  v.literal("pending"),
  v.literal("demanded"),
  v.literal("paid"),
);

export const paymentModeValidator = v.union(
  v.literal("cheque"),
  v.literal("neft"),
  v.literal("rtgs"),
  v.literal("upi"),
  v.literal("cash"),
);

export const paymentInstallments = defineTable({
  ownerId: v.id("users"),
  bookingId: v.id("bookings"),
  /** Label like "On Booking", "On Slab 1", "On Possession" */
  milestone: v.string(),
  dueDate: v.optional(v.string()),
  amount: v.number(),
  status: installmentStatusValidator,
  demandedAt: v.optional(v.string()),
  /** ISO timestamp of last "reminded" action — for follow-up tracking */
  remindedAt: v.optional(v.string()),
  /** ISO timestamp when a demand-notice email was last sent for this installment */
  emailedAt: v.optional(v.string()),
  notes: v.optional(v.string()),
  /** When set, this installment is auto-demanded once the linked construction stage hits 100%. */
  triggerStageId: v.optional(v.id("constructionStages")),
  /** ISO timestamp when the stage-trigger automatically raised the demand. */
  autoTriggeredAt: v.optional(v.string()),
})
  .index("by_booking", ["bookingId"])
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_status", ["ownerId", "status"])
  .index("by_trigger_stage", ["triggerStageId"]);

export const receipts = defineTable({
  ownerId: v.id("users"),
  bookingId: v.id("bookings"),
  installmentId: v.optional(v.id("paymentInstallments")),
  amount: v.number(),
  paymentDate: v.string(),
  paymentMode: paymentModeValidator,
  referenceNumber: v.optional(v.string()),
  notes: v.optional(v.string()),
  /**
   * GST split of `amount`, computed at receipt time from the booking's own
   * gstPercent (amount is GST-inclusive). Absent/zero when the booking has
   * no GST rate set.
   */
  gstBaseAmount: v.optional(v.number()),
  gstAmount: v.optional(v.number()),
})
  .index("by_booking", ["bookingId"])
  .index("by_owner", ["ownerId"])
  .index("by_installment", ["installmentId"]);

export const bookingStatusValidator = v.union(
  v.literal("active"),
  v.literal("cancelled"),
);

/**
 * Approval workflow status for a booking.
 * Bookings created by owners are auto-approved. Bookings created by staff
 * start as "pending_approval" until the owner approves or rejects them.
 * Absent (older bookings) is treated as "approved" by the frontend/backend.
 */
export const bookingApprovalStatusValidator = v.union(
  v.literal("pending_approval"),
  v.literal("approved"),
  v.literal("rejected"),
);

export const buyers = defineTable({
  ownerId: v.id("users"),
  name: v.string(),
  phone: v.string(),
  email: v.optional(v.string()),
  pan: v.optional(v.string()),
  address: v.optional(v.string()),
  notes: v.optional(v.string()),
  /** GSTIN for registered business buyers — classifies GSTR-1 rows as B2B vs B2C */
  gstin: v.optional(v.string()),
  /** State name for place-of-supply (intra vs inter-state GST split). Defaults to company's state if absent. */
  state: v.optional(v.string()),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_name", ["ownerId", "name"])
  .searchIndex("search_name", { searchField: "name", filterFields: ["ownerId"] });

export const bookings = defineTable({
  ownerId: v.id("users"),
  unitId: v.id("units"),
  buyerId: v.id("buyers"),
  /** ISO 8601 UTC timestamp of booking date. */
  bookingDate: v.string(),
  /** Final agreed selling price (may differ from unit base price). */
  agreementValue: v.number(),
  /** Amount paid at booking. */
  bookingAmount: v.number(),
  status: bookingStatusValidator,
  /** ISO 8601 UTC timestamp when the booking was cancelled, if applicable. */
  cancelledAt: v.optional(v.string()),
  cancellationReason: v.optional(v.string()),
  notes: v.optional(v.string()),
  // ── Additional charges ──────────────────────────────────────────────────
  /** GST rate as a percentage (e.g. 5 for 5%). Applied on agreementValue. */
  gstPercent: v.optional(v.number()),
  /** Computed / stored GST amount in INR. */
  gstAmount: v.optional(v.number()),
  /** One-time car parking charge in INR. */
  carParkingCharges: v.optional(v.number()),
  /** 1-year maintenance fund corpus in INR. */
  maintenanceFund: v.optional(v.number()),
  /** Corpus fund per sq ft rate used for auto-calculation (e.g. 25). */
  corpusFundRatePerSqft: v.optional(v.number()),
  /** Corpus fund total in INR. */
  corpusFund: v.optional(v.number()),
  /** Additional co-buyers / joint purchasers on this booking. */
  coBuyerIds: v.optional(v.array(v.id("buyers"))),
  // ── Approval workflow ────────────────────────────────────────────────────
  /** Absent = approved (legacy/owner-created bookings). Staff-created bookings start pending_approval. */
  approvalStatus: v.optional(bookingApprovalStatusValidator),
  /** User ID of whoever submitted this booking for approval. */
  submittedBy: v.optional(v.id("users")),
  submittedAt: v.optional(v.string()),
  /** User ID of the owner who approved/rejected. */
  reviewedBy: v.optional(v.id("users")),
  reviewedAt: v.optional(v.string()),
  rejectionReason: v.optional(v.string()),
  // ── GST / sale registration ─────────────────────────────────────────────
  /**
   * Date (YYYY-MM-DD) the sale deed was registered with the sub-registrar.
   * Before this date, payments collected are reported as "Advances Received"
   * (GSTR-1 Table 11A). From this date onward, the sale is reported as a
   * regular outward supply (B2B / B2C).
   */
  registrationDate: v.optional(v.string()),
})
  .index("by_owner", ["ownerId"])
  .index("by_unit", ["unitId"])
  .index("by_buyer", ["buyerId"])
  .index("by_owner_and_status", ["ownerId", "status"])
  .index("by_owner_and_approval_status", ["ownerId", "approvalStatus"]);

export const expenseCategoryValidator = v.union(
  v.literal("material"),
  v.literal("labour"),
  v.literal("approvals"),
  v.literal("legal"),
  v.literal("marketing"),
  v.literal("other"),
);

export const constructionStages = defineTable({
  ownerId: v.id("users"),
  projectId: v.id("projects"),
  name: v.string(),
  /** Display order within the project */
  order: v.number(),
  /** 0–100 */
  percentComplete: v.number(),
  /** Planned/actual start date for this stage — for the project schedule view. */
  startDate: v.optional(v.string()),
  targetDate: v.optional(v.string()),
  completedDate: v.optional(v.string()),
  notes: v.optional(v.string()),
})
  .index("by_project", ["projectId"])
  .index("by_owner", ["ownerId"]);

/** Bill of Quantities line item, scoped to a single construction stage. */
export const boqItems = defineTable({
  ownerId: v.id("users"),
  projectId: v.id("projects"),
  stageId: v.id("constructionStages"),
  /** Display order within the stage */
  order: v.number(),
  description: v.string(),
  /** Unit of measure label, e.g. "Bags", "Cum", "Sqft", "Nos" */
  unit: v.string(),
  quantity: v.number(),
  rate: v.number(),
  /** quantity * rate, stored for fast list rendering */
  amount: v.number(),
  notes: v.optional(v.string()),
})
  .index("by_stage", ["stageId"])
  .index("by_project", ["projectId"])
  .index("by_owner", ["ownerId"]);

export const projectExpenses = defineTable({
  ownerId: v.id("users"),
  projectId: v.id("projects"),
  category: expenseCategoryValidator,
  description: v.string(),
  vendor: v.optional(v.string()),
  amount: v.number(),
  expenseDate: v.string(),
  notes: v.optional(v.string()),
  /** Optional link to the construction stage this actual cost applies to — for BOQ estimate-vs-actual comparison. */
  stageId: v.optional(v.id("constructionStages")),
})
  .index("by_project", ["projectId"])
  .index("by_owner", ["ownerId"])
  .index("by_project_and_category", ["projectId", "category"])
  .index("by_stage", ["stageId"]);

export const leadStatusValidator = v.union(
  v.literal("new"),
  v.literal("contacted"),
  v.literal("site_visit"),
  v.literal("negotiation"),
  v.literal("won"),
  v.literal("lost"),
);

export const leadSourceValidator = v.union(
  v.literal("walk_in"),
  v.literal("referral"),
  v.literal("advertisement"),
  v.literal("website"),
  v.literal("social_media"),
  v.literal("other"),
);

export const leads = defineTable({
  ownerId: v.id("users"),
  name: v.string(),
  phone: v.string(),
  email: v.optional(v.string()),
  /** Project(s) they are interested in — store as free text for flexibility */
  projectInterest: v.optional(v.string()),
  source: leadSourceValidator,
  status: leadStatusValidator,
  budget: v.optional(v.number()),
  notes: v.optional(v.string()),
  lostReason: v.optional(v.string()),
  /** Set when the lead is converted to a buyer */
  convertedBuyerId: v.optional(v.id("buyers")),
  /** ISO 8601 timestamp of last status change */
  lastActivityAt: v.string(),
  /** Sales executive this lead is assigned to (owner or staff user id) */
  assignedToId: v.optional(v.id("users")),
  /** Denormalized display name of the assignee, for fast list rendering */
  assignedToName: v.optional(v.string()),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_status", ["ownerId", "status"])
  .index("by_owner_and_assigned", ["ownerId", "assignedToId"])
  .searchIndex("search_name", { searchField: "name", filterFields: ["ownerId"] });

export const projects = defineTable({
  ownerId: v.id("users"),
  name: v.string(),
  code: v.string(),
  city: v.string(),
  address: v.optional(v.string()),
  type: projectTypeValidator,
  status: projectStatusValidator,
  reraNumber: v.optional(v.string()),
  // ISO 8601 UTC timestamps
  launchDate: v.optional(v.string()),
  possessionDate: v.optional(v.string()),
  /** Total approved construction budget (INR) */
  constructionBudget: v.optional(v.number()),
  notes: v.optional(v.string()),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_name", ["ownerId", "name"])
  .searchIndex("search_name", { searchField: "name", filterFields: ["ownerId"] });

export const units = defineTable({
  ownerId: v.id("users"),
  projectId: v.id("projects"),
  /** Flat or plot number, e.g. "A-1203" or "P-14". */
  number: v.string(),
  /** Block, wing or tower label. */
  block: v.optional(v.string()),
  floor: v.optional(v.number()),
  /** Configuration label like "2 BHK" or "Corner plot". */
  configuration: v.optional(v.string()),
  /** Super Built-Up Area (SBA) in sq ft — includes common areas. Used for pricing. */
  superBuiltUpAreaSqft: v.number(),
  /** Built-Up Area in sq ft (optional — for reference). */
  areaSqft: v.optional(v.number()),
  /** Carpet Area (CA) in sq ft — usable floor area inside the walls. */
  carpetAreaSqft: v.optional(v.number()),
  /** Balcony area in sq ft. */
  balconyAreaSqft: v.optional(v.number()),
  /** Undivided Share (UDS) of land in sq ft or percentage string. */
  undividedShare: v.optional(v.string()),
  ratePerSqft: v.number(),
  /** Base price; usually area x rate but editable. */
  price: v.number(),
  status: unitStatusValidator,
  facing: v.optional(v.string()),
  notes: v.optional(v.string()),
})
  .index("by_owner", ["ownerId"])
  .index("by_project", ["projectId"])
  .index("by_project_and_status", ["projectId", "status"])
  .index("by_owner_and_status", ["ownerId", "status"]);
