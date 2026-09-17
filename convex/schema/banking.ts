import { defineTable } from "convex/server";
import { v } from "convex/values";

export const bankStatements = defineTable({
  ownerId: v.id("users"),
  /** Link to the Bank Account in the chart of accounts */
  accountId: v.id("accounts"),
  accountName: v.string(),
  /** ISO date of first transaction in the file */
  fromDate: v.string(),
  /** ISO date of last transaction in the file */
  toDate: v.string(),
  openingBalance: v.optional(v.number()),
  closingBalance: v.optional(v.number()),
  /** pending | reconciled */
  status: v.union(v.literal("pending"), v.literal("reconciled")),
  /** Bank format detected during import */
  bankFormat: v.optional(v.string()),
  totalRows: v.number(),
  matchedRows: v.number(),
  postedRows: v.number(),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_account", ["ownerId", "accountId"])
  .index("by_owner_and_status", ["ownerId", "status"]);

export const bankTransactions = defineTable({
  ownerId: v.id("users"),
  statementId: v.id("bankStatements"),
  /** ISO date YYYY-MM-DD */
  date: v.string(),
  description: v.string(),
  reference: v.optional(v.string()),
  /** Positive = money out of bank account */
  debit: v.number(),
  /** Positive = money into bank account */
  credit: v.number(),
  /** Running balance from statement */
  balance: v.optional(v.number()),
  /** unmatched | matched | posted | ignored */
  status: v.union(
    v.literal("unmatched"),
    v.literal("matched"),
    v.literal("posted"),
    v.literal("ignored"),
  ),
  /** Linked journal entry if matched/posted */
  journalEntryId: v.optional(v.id("journalEntries")),
  /** Linked buyer account */
  buyerLinkId: v.optional(v.id("buyers")),
  /** Linked booking */
  bookingLinkId: v.optional(v.id("bookings")),
  /** Receipt created from this transaction */
  receiptId: v.optional(v.id("receipts")),
  /** Linked vendor, set when this debit was matched to a vendor payment */
  vendorLinkId: v.optional(v.id("vendors")),
  /** Purchase invoices this transaction paid down, with the amount applied to each (bounded — oldest-first allocation across a vendor's open bills) */
  vendorPaymentAllocations: v.optional(
    v.array(v.object({ invoiceId: v.id("purchaseInvoices"), amount: v.number() })),
  ),
  /** Linked labourer/group, set when this debit was matched to a labour payment */
  labourLinkId: v.optional(v.id("labourers")),
  /** Labour ledger entry created from this transaction, so unlinking can remove it */
  labourLedgerEntryId: v.optional(v.id("labourLedgerEntries")),
})
  .index("by_statement", ["statementId"])
  .index("by_owner", ["ownerId"])
  .index("by_owner_and_date", ["ownerId", "date"])
  .index("by_owner_and_status", ["ownerId", "status"]);
