import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  projects,
  units,
  buyers,
  bookings,
  paymentInstallments,
  receipts,
  constructionStages,
  boqItems,
  projectExpenses,
  leads,
} from "./schema/realEstate.ts";
import { accounts, journalEntries, journalLines, costCenters } from "./schema/accounting.ts";
import { vendors, purchaseInvoices, purchaseInvoiceLines, purchaseOrders, purchaseOrderLines } from "./schema/vendors.ts";
import { bankStatements, bankTransactions } from "./schema/banking.ts";
import { crmActivities, crmTasks } from "./schema/crm.ts";
import { documents } from "./schema/documents.ts";
import { tallySettings } from "./schema/tally.ts";
import { stockGodowns, stockItems, stockBalances, stockMovements } from "./schema/inventory.ts";
import { gstSettings } from "./schema/gst.ts";
import { employees, payrollRuns, payslips } from "./schema/payroll.ts";
import { tdsSettings, tdsDeductees, tdsDeductions, tdsChallans } from "./schema/tds.ts";
import { materialRequests, materialRequestLines, subcontracts, subcontractInvoices } from "./schema/procurement.ts";
import { labourers, labourLedgerEntries } from "./schema/labour.ts";
import { loans, loanInstallments } from "./schema/loans.ts";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    /**
     * "owner" = full access, including deletes.
     * "staff" = generic role, full read/write access to every module, no deletes.
    * "accountant" | "sales" | "site_engineer" | "site_supervisor" | "project_manager" = scoped roles, restricted to their module set (see convex/lib/rbac.ts), no deletes.
     * Defaults to "owner" if absent.
     */
    role: v.optional(
      v.union(
        v.literal("owner"),
        v.literal("staff"),
        v.literal("accountant"),
        v.literal("sales"),
        v.literal("site_engineer"),
        v.literal("site_supervisor"),
        v.literal("project_manager"),
      ),
    ),
    /** For staff users: the owner's user ID whose data they can access. */
    linkedOwnerId: v.optional(v.id("users")),
    /** Display name used as the sender name in outgoing emails */
    emailSenderName: v.optional(v.string()),
    /** Verified sender email address for outgoing emails */
    emailSenderAddress: v.optional(v.string()),
    /** Reply-to email address for outgoing emails */
    emailReplyTo: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  /** Pending and active team invitations. */
  teamMembers: defineTable({
    /** The owner who sent the invite. */
    ownerId: v.id("users"),
    /** Email address that was invited. */
    email: v.string(),
    /** Display name once the invite is accepted. */
    memberName: v.optional(v.string()),
    status: v.union(v.literal("invited"), v.literal("active")),
    invitedAt: v.string(),
    /**
     * The role this member has/will have. Defaults to "staff" (full read/write, no deletes)
     * when absent, preserving behavior for invites created before scoped roles existed.
     */
    role: v.optional(
      v.union(
        v.literal("staff"),
        v.literal("accountant"),
        v.literal("sales"),
        v.literal("site_engineer"),
        v.literal("site_supervisor"),
        v.literal("project_manager"),
      ),
    ),
  })
    .index("by_owner", ["ownerId"])
    .index("by_email", ["email"]),

  projects,
  units,
  buyers,
  bookings,
  paymentInstallments,
  receipts,
  constructionStages,
  boqItems,
  projectExpenses,
  leads,
  accounts,
  journalEntries,
  journalLines,
  costCenters,
  vendors,
  purchaseInvoices,
  purchaseInvoiceLines,
  purchaseOrders,
  purchaseOrderLines,
  bankStatements,
  bankTransactions,
  crmActivities,
  crmTasks,
  documents,
  tallySettings,
  stockGodowns,
  stockItems,
  stockBalances,
  stockMovements,
  gstSettings,
  employees,
  payrollRuns,
  payslips,
  tdsSettings,
  tdsDeductees,
  tdsDeductions,
  tdsChallans,
  materialRequests,
  materialRequestLines,
  subcontracts,
  subcontractInvoices,
  labourers,
  labourLedgerEntries,
  loans,
  loanInstallments,
});
