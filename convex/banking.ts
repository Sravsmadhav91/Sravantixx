import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { effectiveOwnerId, requireOwner, requireUser } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";
import { splitGstInclusive } from "./lib/gst.ts";
import { matchVendorInNarration, suggestExpenseAccountCode } from "./lib/vendorMatch.ts";
import { findAccountByCode } from "./vendors.ts";
import { createLabourerAccount, getOrCreateLabourerDeductee, getTdsPayableAccountId, tdsQuarterForDate } from "./labour.ts";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// ── Helpers ────────────────────────────────────────────────────────────────

async function getNextEntryNumber(
  ctx: MutationCtx,
  ownerId: Id<"users">,
): Promise<string> {
  const last = await ctx.db
    .query("journalEntries")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .first();
  const year = new Date().getFullYear();
  if (!last) return `JE-${year}-001`;
  const match = last.entryNumber.match(/JE-\d{4}-(\d+)$/);
  const seq = match ? parseInt(match[1], 10) + 1 : 1;
  return `JE-${year}-${String(seq).padStart(3, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// BANK STATEMENTS
// ═══════════════════════════════════════════════════════════════════════════

export const listBankStatements = query({
  args: { accountId: v.optional(v.id("accounts")) },
  handler: async (ctx, args): Promise<Doc<"bankStatements">[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    let stmts: Doc<"bankStatements">[];
    if (args.accountId) {
      stmts = await ctx.db
        .query("bankStatements")
        .withIndex("by_owner_and_account", (q) =>
          q.eq("ownerId", ownerId).eq("accountId", args.accountId!),
        )
        .order("desc")
        .collect();
    } else {
      stmts = await ctx.db
        .query("bankStatements")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .order("desc")
        .collect();
    }
    return stmts;
  },
});

export const getBankStatement = query({
  args: { statementId: v.id("bankStatements") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const stmt = await ctx.db.get("bankStatements", args.statementId);
    if (!stmt || stmt.ownerId !== ownerId) return null;
    const transactions = await ctx.db
      .query("bankTransactions")
      .withIndex("by_statement", (q) => q.eq("statementId", args.statementId))
      .order("asc")
      .collect();
    return { statement: stmt, transactions };
  },
});

// ── Import parsed transactions ─────────────────────────────────────────────

type ImportedTx = {
  date: string;
  description: string;
  reference?: string;
  debit: number;
  credit: number;
  balance?: number;
};

export type ImportBankStatementResult = {
  statementId: Id<"bankStatements">;
  imported: number;
  skippedDuplicates: number;
};

export const importBankStatement = mutation({
  args: {
    accountId: v.id("accounts"),
    accountName: v.string(),
    fromDate: v.string(),
    toDate: v.string(),
    openingBalance: v.optional(v.number()),
    closingBalance: v.optional(v.number()),
    bankFormat: v.optional(v.string()),
    transactions: v.array(
      v.object({
        date: v.string(),
        description: v.string(),
        reference: v.optional(v.string()),
        debit: v.number(),
        credit: v.number(),
        balance: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<ImportBankStatementResult> => {
    const user = await requireModuleAccess(ctx, "banking");
    const ownerId = effectiveOwnerId(user);

    const account = await ctx.db.get("accounts", args.accountId);
    if (!account || account.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Account not found" });
    }

    // Build a set of existing-transaction keys for this account so re-uploading
    // the same file (or a month already imported in an earlier upload) doesn't
    // create duplicate transactions.
    const existingStatements = await ctx.db
      .query("bankStatements")
      .withIndex("by_owner_and_account", (q) =>
        q.eq("ownerId", ownerId).eq("accountId", args.accountId),
      )
      .collect();
    const dedupeKey = (t: ImportedTx) =>
      `${t.date}|||${t.description.trim().toLowerCase()}|||${t.debit}|||${t.credit}`;
    const existingKeys = new Set<string>();
    for (const stmt of existingStatements) {
      const txs = await ctx.db
        .query("bankTransactions")
        .withIndex("by_statement", (q) => q.eq("statementId", stmt._id))
        .collect();
      for (const t of txs) existingKeys.add(dedupeKey(t));
    }

    const toImport: ImportedTx[] = [];
    const seenInBatch = new Set<string>();
    let skippedDuplicates = 0;
    for (const t of args.transactions) {
      const key = dedupeKey(t);
      if (existingKeys.has(key) || seenInBatch.has(key)) {
        skippedDuplicates++;
        continue;
      }
      seenInBatch.add(key);
      toImport.push(t);
    }

    if (toImport.length === 0) {
      throw new ConvexError({
        code: "CONFLICT",
        message:
          skippedDuplicates > 0
            ? `All ${skippedDuplicates} transactions already exist for this account — nothing new to import.`
            : "No transactions to import",
      });
    }

    const statementId = await ctx.db.insert("bankStatements", {
      ownerId,
      accountId: args.accountId,
      accountName: args.accountName,
      fromDate: args.fromDate,
      toDate: args.toDate,
      openingBalance: args.openingBalance,
      closingBalance: args.closingBalance,
      bankFormat: args.bankFormat,
      status: "pending",
      totalRows: toImport.length,
      matchedRows: 0,
      postedRows: 0,
    });

    for (const tx of toImport) {
      await ctx.db.insert("bankTransactions", {
        ownerId,
        statementId,
        date: tx.date,
        description: tx.description,
        reference: tx.reference,
        debit: tx.debit,
        credit: tx.credit,
        balance: tx.balance,
        status: "unmatched",
      });
    }

    return { statementId, imported: toImport.length, skippedDuplicates };
  },
});

// ── Auto-match against existing journal entries ────────────────────────────

export const autoMatchStatement = mutation({
  args: { statementId: v.id("bankStatements") },
  handler: async (ctx, args): Promise<{ matched: number }> => {
    const user = await requireModuleAccess(ctx, "banking");
    const ownerId = effectiveOwnerId(user);

    const stmt = await ctx.db.get("bankStatements", args.statementId);
    if (!stmt || stmt.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Statement not found" });
    }

    const txns = await ctx.db
      .query("bankTransactions")
      .withIndex("by_statement", (q) => q.eq("statementId", args.statementId))
      .collect();

    const unmatched = txns.filter((t) => t.status === "unmatched");
    let matchCount = 0;

    for (const tx of unmatched) {
      const txAmount = tx.credit > 0 ? tx.credit : tx.debit;

      // Look for journal lines on the statement's account within ±3 days that match the amount
      const txDate = new Date(tx.date);
      const minDate = new Date(txDate);
      minDate.setDate(minDate.getDate() - 3);
      const maxDate = new Date(txDate);
      maxDate.setDate(maxDate.getDate() + 3);

      const minStr = minDate.toISOString().slice(0, 10);
      const maxStr = maxDate.toISOString().slice(0, 10);

      // Get journal entries in date range for this account
      const entries = await ctx.db
        .query("journalEntries")
        .withIndex("by_owner_and_date", (q) =>
          q.eq("ownerId", ownerId).gte("date", minStr),
        )
        .filter((q) => q.lte(q.field("date"), maxStr))
        .filter((q) => q.eq(q.field("status"), "posted"))
        .collect();

      let matchedJeId: Id<"journalEntries"> | null = null;

      for (const entry of entries) {
        const lines = await ctx.db
          .query("journalLines")
          .withIndex("by_entry", (q) => q.eq("journalEntryId", entry._id))
          .collect();

        const matchingLine = lines.find(
          (l) =>
            l.accountId === stmt.accountId &&
            Math.abs(l.amount - txAmount) < 0.01 &&
            // credit tx → debit on bank account, debit tx → credit on bank account
            (tx.credit > 0 ? l.side === "debit" : l.side === "credit"),
        );

        if (matchingLine) {
          // Make sure this JE isn't already matched to another tx
          const alreadyUsed = txns.find(
            (t) => t.journalEntryId === entry._id && t._id !== tx._id,
          );
          if (!alreadyUsed) {
            matchedJeId = entry._id;
            break;
          }
        }
      }

      if (matchedJeId) {
        await ctx.db.patch("bankTransactions", tx._id, {
          status: "matched",
          journalEntryId: matchedJeId,
        });
        matchCount++;
      }
    }

    // Update statement counts
    const allTxns = await ctx.db
      .query("bankTransactions")
      .withIndex("by_statement", (q) => q.eq("statementId", args.statementId))
      .collect();
    await ctx.db.patch("bankStatements", args.statementId, {
      matchedRows: allTxns.filter((t) => t.status === "matched").length,
      postedRows: allTxns.filter((t) => t.status === "posted").length,
    });

    return { matched: matchCount };
  },
});

// ── Post unmatched transaction to ledger ──────────────────────────────────

export const postBankTransaction = mutation({
  args: {
    transactionId: v.id("bankTransactions"),
    /** Contra account for the journal entry */
    contraAccountId: v.id("accounts"),
    narration: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"journalEntries">> => {
    const user = await requireModuleAccess(ctx, "banking");
    const ownerId = effectiveOwnerId(user);

    const tx = await ctx.db.get("bankTransactions", args.transactionId);
    if (!tx || tx.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Transaction not found" });
    }
    if (tx.status === "posted" || tx.status === "matched") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Transaction already reconciled" });
    }

    const stmt = await ctx.db.get("bankStatements", tx.statementId);
    if (!stmt) throw new ConvexError({ code: "NOT_FOUND", message: "Statement not found" });

    const amount = tx.credit > 0 ? tx.credit : tx.debit;
    const entryNumber = await getNextEntryNumber(ctx, ownerId);
    const narration = args.narration ?? tx.description;

    // Credit tx (money in): Dr Bank Account, Cr Contra
    // Debit tx (money out): Dr Contra, Cr Bank Account
    const bankSide = tx.credit > 0 ? "debit" : "credit";
    const contraSide = tx.credit > 0 ? "credit" : "debit";

    const jeId = await ctx.db.insert("journalEntries", {
      ownerId,
      entryNumber,
      date: tx.date,
      narration,
      status: "posted",
      source: "bank_import",
      sourceId: tx._id,
      reference: tx.reference,
      totalAmount: amount,
    });

    await ctx.db.insert("journalLines", {
      ownerId,
      journalEntryId: jeId,
      accountId: stmt.accountId,
      side: bankSide,
      amount,
      narration: tx.description,
    });
    await ctx.db.insert("journalLines", {
      ownerId,
      journalEntryId: jeId,
      accountId: args.contraAccountId,
      side: contraSide,
      amount,
      narration: tx.description,
    });

    await ctx.db.patch("bankTransactions", tx._id, {
      status: "posted",
      journalEntryId: jeId,
    });

    // Refresh statement counts
    const allTxns = await ctx.db
      .query("bankTransactions")
      .withIndex("by_statement", (q) => q.eq("statementId", tx.statementId))
      .collect();
    await ctx.db.patch("bankStatements", tx.statementId, {
      matchedRows: allTxns.filter((t) => t.status === "matched").length,
      postedRows: allTxns.filter((t) => t.status === "posted").length,
    });

    return jeId;
  },
});

// ── Ignore a transaction ──────────────────────────────────────────────────

export const ignoreBankTransaction = mutation({
  args: { transactionId: v.id("bankTransactions") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "banking");
    const ownerId = effectiveOwnerId(user);
    const tx = await ctx.db.get("bankTransactions", args.transactionId);
    if (!tx || tx.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Transaction not found" });
    }
    await ctx.db.patch("bankTransactions", tx._id, { status: "ignored" });
  },
});

// ── Unmatch / re-open ─────────────────────────────────────────────────────

export const unmatchBankTransaction = mutation({
  args: { transactionId: v.id("bankTransactions") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "banking");
    const ownerId = effectiveOwnerId(user);
    const tx = await ctx.db.get("bankTransactions", args.transactionId);
    if (!tx || tx.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Transaction not found" });
    }
    await ctx.db.patch("bankTransactions", tx._id, {
      status: "unmatched",
      journalEntryId: undefined,
    });
  },
});

// ── Mark statement as reconciled ─────────────────────────────────────────

export const reconcileStatement = mutation({
  args: { statementId: v.id("bankStatements") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "banking");
    const ownerId = effectiveOwnerId(user);
    const stmt = await ctx.db.get("bankStatements", args.statementId);
    if (!stmt || stmt.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Statement not found" });
    }
    await ctx.db.patch("bankStatements", args.statementId, { status: "reconciled" });
  },
});

// ── Link buyer to transaction ──────────────────────────────────────────────

/**
 * Link a bank transaction (credit) to a buyer booking and optionally create
 * a receipt for a specific installment. Marks the transaction as "matched".
 */
export const linkBuyerToTransaction = mutation({
  args: {
    transactionId: v.id("bankTransactions"),
    buyerId: v.id("buyers"),
    bookingId: v.id("bookings"),
    installmentId: v.optional(v.id("paymentInstallments")),
    /** Override amount — defaults to transaction credit amount */
    amount: v.optional(v.number()),
    paymentMode: v.union(
      v.literal("cheque"), v.literal("neft"), v.literal("rtgs"),
      v.literal("upi"), v.literal("cash"),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "banking");
    const ownerId = effectiveOwnerId(user);

    const tx = await ctx.db.get("bankTransactions", args.transactionId);
    if (!tx || tx.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Transaction not found" });
    }
    const booking = await ctx.db.get("bookings", args.bookingId);
    if (!booking || booking.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Booking not found" });
    }
    const buyer = await ctx.db.get("buyers", args.buyerId);
    if (!buyer || buyer.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Buyer not found" });
    }

    const amount = args.amount ?? tx.credit;
    const split = splitGstInclusive(amount, booking.gstPercent);

    // Create a receipt
    const receiptId = await ctx.db.insert("receipts", {
      ownerId,
      bookingId: args.bookingId,
      installmentId: args.installmentId,
      amount,
      paymentDate: tx.date,
      paymentMode: args.paymentMode,
      referenceNumber: tx.reference ?? tx.description.slice(0, 50),
      notes: args.notes,
      gstBaseAmount: split.baseAmount,
      gstAmount: split.gstAmount,
    });

    // If an installment was linked, mark it as paid
    if (args.installmentId) {
      const inst = await ctx.db.get("paymentInstallments", args.installmentId);
      if (inst && inst.bookingId === args.bookingId) {
        await ctx.db.patch("paymentInstallments", args.installmentId, { status: "paid" });
      }
    }

    // Update the bank transaction
    await ctx.db.patch("bankTransactions", args.transactionId, {
      status: "matched",
      buyerLinkId: args.buyerId,
      bookingLinkId: args.bookingId,
      receiptId,
    });

    // Update statement matched count
    const stmt = await ctx.db.get("bankStatements", tx.statementId);
    if (stmt) {
      await ctx.db.patch("bankStatements", tx.statementId, {
        matchedRows: stmt.matchedRows + 1,
      });
    }
  },
});

/** Remove buyer link from a transaction (set back to unmatched). */
export const unlinkBuyerFromTransaction = mutation({
  args: { transactionId: v.id("bankTransactions") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "banking");
    const ownerId = effectiveOwnerId(user);

    const tx = await ctx.db.get("bankTransactions", args.transactionId);
    if (!tx || tx.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Transaction not found" });
    }

    // Delete the linked receipt if it exists
    if (tx.receiptId) {
      const receipt = await ctx.db.get("receipts", tx.receiptId);
      if (receipt) {
        // Unmark installment paid if it was set by this link
        if (receipt.installmentId) {
          const inst = await ctx.db.get("paymentInstallments", receipt.installmentId);
          if (inst) {
            await ctx.db.patch("paymentInstallments", receipt.installmentId, { status: "pending" });
          }
        }
        await ctx.db.delete("receipts", tx.receiptId);
      }
    }

    await ctx.db.patch("bankTransactions", args.transactionId, {
      status: "unmatched",
      buyerLinkId: undefined,
      bookingLinkId: undefined,
      receiptId: undefined,
    });

    // Update statement matched count
    const stmt = await ctx.db.get("bankStatements", tx.statementId);
    if (stmt && stmt.matchedRows > 0) {
      await ctx.db.patch("bankStatements", tx.statementId, {
        matchedRows: stmt.matchedRows - 1,
      });
    }
  },
});

/** Search buyers for the link dialog. */
export const searchBuyersForLink = query({
  args: { search: v.string() },
  handler: async (ctx, args): Promise<{
    _id: import("./_generated/dataModel").Id<"buyers">;
    name: string;
    phone: string;
    email?: string;
  }[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    if (!args.search.trim()) {
      return await ctx.db
        .query("buyers")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .take(20);
    }
    return await ctx.db
      .query("buyers")
      .withSearchIndex("search_name", (q) =>
        q.search("name", args.search).eq("ownerId", ownerId),
      )
      .take(20);
  },
});

/** Get bookings for a buyer (to pick which booking to link). */
export const getBookingsForBuyer = query({
  args: { buyerId: v.id("buyers") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_buyer", (q) => q.eq("buyerId", args.buyerId))
      .collect();
    // Enrich with unit info
    return await Promise.all(
      bookings
        .filter((b) => b.ownerId === ownerId && b.status !== "cancelled")
        .map(async (b) => {
          const unit = await ctx.db.get("units", b.unitId);
          const project = unit ? await ctx.db.get("projects", unit.projectId) : null;
          return {
            ...b,
            unitNumber: unit?.number ?? "—",
            projectName: project?.name ?? "—",
          };
        }),
    );
  },
});

// ── Installments for a booking (used by link-buyer dialog) ───────────────

export const getInstallmentsForBooking = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const booking = await ctx.db.get("bookings", args.bookingId);
    if (!booking || booking.ownerId !== ownerId) return [];
    return await ctx.db
      .query("paymentInstallments")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .collect();
  },
});

// ── Delete statement ──────────────────────────────────────────────────────

export const deleteBankStatement = mutation({
  args: { statementId: v.id("bankStatements") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireOwner(ctx);
    const ownerId = effectiveOwnerId(user);
    const stmt = await ctx.db.get("bankStatements", args.statementId);
    if (!stmt || stmt.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Statement not found" });
    }
    // Delete all transactions
    const txns = await ctx.db
      .query("bankTransactions")
      .withIndex("by_statement", (q) => q.eq("statementId", args.statementId))
      .collect();
    for (const tx of txns) await ctx.db.delete("bankTransactions", tx._id);
    await ctx.db.delete("bankStatements", args.statementId);
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// VENDOR PAYMENT AUTO-MATCH (debit lines only)
// ═══════════════════════════════════════════════════════════════════════════

export type VendorMatchSuggestion = {
  transactionId: Id<"bankTransactions">;
  vendorId: Id<"vendors">;
  vendorName: string;
  /** Vendor's open (unpaid/partially paid) invoices, oldest first, with amounts to allocate against this payment */
  allocations: { invoiceId: Id<"purchaseInvoices">; invoiceRef: string; outstanding: number; amountToApply: number }[];
  /** True when the transaction amount does not exactly cover the suggested allocation total (still shown for review) */
  amountMismatch: boolean;
};

export type ExpenseSuggestion = {
  transactionId: Id<"bankTransactions">;
  accountId: Id<"accounts">;
  accountName: string;
};

/**
 * Suggests vendor-payment matches and fallback expense categories for every
 * unmatched debit line in a statement. Read-only — nothing is recorded until
 * the user confirms via recordVendorPaymentFromBankTx or postBankTransaction.
 */
export const suggestVendorMatchesForStatement = query({
  args: { statementId: v.id("bankStatements") },
  handler: async (ctx, args): Promise<{
    vendorMatches: VendorMatchSuggestion[];
    expenseSuggestions: ExpenseSuggestion[];
  }> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    const stmt = await ctx.db.get("bankStatements", args.statementId);
    if (!stmt || stmt.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Statement not found" });
    }

    const txns = await ctx.db
      .query("bankTransactions")
      .withIndex("by_statement", (q) => q.eq("statementId", args.statementId))
      .collect();
    const debitTxns = txns.filter((t) => t.status === "unmatched" && t.debit > 0);
    if (debitTxns.length === 0) return { vendorMatches: [], expenseSuggestions: [] };

    const vendors = await ctx.db
      .query("vendors")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    const vendorCandidates = vendors.map((v) => ({ id: v._id, name: v.name }));

    // Cache each vendor's open invoices (oldest-first) so multiple transactions
    // for the same vendor don't re-query.
    const openInvoicesByVendor = new Map<Id<"vendors">, Doc<"purchaseInvoices">[]>();
    async function getOpenInvoices(vendorId: Id<"vendors">): Promise<Doc<"purchaseInvoices">[]> {
      const cached = openInvoicesByVendor.get(vendorId);
      if (cached) return cached;
      const invoices = await ctx.db
        .query("purchaseInvoices")
        .withIndex("by_owner_and_vendor", (q) => q.eq("ownerId", ownerId).eq("vendorId", vendorId))
        .collect();
      const open = invoices
        .filter((i) => (i.status === "approved" || i.status === "paid") && i.total - i.amountPaid > 0.01)
        .sort((a, b) => a.date.localeCompare(b.date));
      openInvoicesByVendor.set(vendorId, open);
      return open;
    }

    const vendorMatches: VendorMatchSuggestion[] = [];
    const expenseSuggestions: ExpenseSuggestion[] = [];
    const accountCache = new Map<string, Id<"accounts"> | null>();

    for (const tx of debitTxns) {
      const match = matchVendorInNarration(tx.description, vendorCandidates);
      if (match) {
        const openInvoices = await getOpenInvoices(match.id as Id<"vendors">);
        if (openInvoices.length > 0) {
          // Allocate the payment across open invoices, oldest first.
          let remaining = tx.debit;
          const allocations: VendorMatchSuggestion["allocations"] = [];
          for (const inv of openInvoices) {
            if (remaining <= 0.01) break;
            const outstanding = inv.total - inv.amountPaid;
            const amountToApply = Math.min(outstanding, remaining);
            allocations.push({
              invoiceId: inv._id,
              invoiceRef: inv.internalRef,
              outstanding,
              amountToApply,
            });
            remaining -= amountToApply;
          }
          vendorMatches.push({
            transactionId: tx._id,
            vendorId: match.id as Id<"vendors">,
            vendorName: match.name,
            allocations,
            amountMismatch: remaining > 0.01,
          });
          continue;
        }
      }

      // No vendor match (or vendor has no open bills) — suggest an expense category.
      const code = suggestExpenseAccountCode(tx.description);
      if (code) {
        let accountId = accountCache.get(code);
        if (accountId === undefined) {
          accountId = await findAccountByCode(ctx, ownerId, code);
          accountCache.set(code, accountId);
        }
        if (accountId) {
          const account = await ctx.db.get("accounts", accountId);
          if (account) {
            expenseSuggestions.push({ transactionId: tx._id, accountId, accountName: account.name });
          }
        }
      }
    }

    return { vendorMatches, expenseSuggestions };
  },
});

/**
 * Records a vendor payment from a matched bank debit line: pays down the
 * given purchase invoices (oldest-first allocations, as reviewed by the
 * user) via the same accounting entries as vendors.recordPayment, then
 * marks the bank transaction as matched with the vendor link.
 */
export const recordVendorPaymentFromBankTx = mutation({
  args: {
    transactionId: v.id("bankTransactions"),
    vendorId: v.id("vendors"),
    allocations: v.array(v.object({ invoiceId: v.id("purchaseInvoices"), amount: v.number() })),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "banking");
    const ownerId = effectiveOwnerId(user);

    const tx = await ctx.db.get("bankTransactions", args.transactionId);
    if (!tx || tx.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Transaction not found" });
    }
    if (tx.status !== "unmatched") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Transaction already reconciled" });
    }
    if (tx.debit <= 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Only debit (money-out) transactions can be matched to a vendor payment" });
    }
    if (args.allocations.length === 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Select at least one invoice to apply this payment to" });
    }

    const vendor = await ctx.db.get("vendors", args.vendorId);
    if (!vendor || vendor.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Vendor not found" });
    }

    const totalAllocated = args.allocations.reduce((s, a) => s + a.amount, 0);
    if (totalAllocated > tx.debit + 0.01) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Allocated amount exceeds the transaction amount" });
    }

    const vendorPayableId = await findAccountByCode(ctx, ownerId, "2001");
    if (!vendorPayableId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Vendor Payables account (2001) not found" });
    }

    const stmt = await ctx.db.get("bankStatements", tx.statementId);
    if (!stmt) throw new ConvexError({ code: "NOT_FOUND", message: "Statement not found" });

    for (const alloc of args.allocations) {
      const invoice = await ctx.db.get("purchaseInvoices", alloc.invoiceId);
      if (!invoice || invoice.ownerId !== ownerId || invoice.vendorId !== args.vendorId) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Invoice not found for this vendor" });
      }
      if (invoice.status === "draft" || invoice.status === "cancelled") {
        throw new ConvexError({ code: "BAD_REQUEST", message: `Invoice ${invoice.internalRef} must be approved before recording payment` });
      }
      const outstanding = invoice.total - invoice.amountPaid;
      if (alloc.amount > outstanding + 0.01) {
        throw new ConvexError({ code: "BAD_REQUEST", message: `Payment for ${invoice.internalRef} (${alloc.amount}) exceeds outstanding (${outstanding})` });
      }

      const entryNumber = await getNextEntryNumber(ctx, ownerId);
      const jeId = await ctx.db.insert("journalEntries", {
        ownerId,
        entryNumber,
        date: tx.date,
        narration: `Bank payment for ${invoice.internalRef} — ${vendor.name}`,
        status: "posted",
        source: "bank_import",
        sourceId: tx._id,
        reference: tx.reference,
        totalAmount: alloc.amount,
      });

      // Debit Vendor Payable (reduces liability), Credit Bank
      await ctx.db.insert("journalLines", { ownerId, journalEntryId: jeId, accountId: vendorPayableId, side: "debit", amount: alloc.amount });
      await ctx.db.insert("journalLines", { ownerId, journalEntryId: jeId, accountId: stmt.accountId, side: "credit", amount: alloc.amount });

      const newAmountPaid = invoice.amountPaid + alloc.amount;
      const newStatus = newAmountPaid >= invoice.total - 0.01 ? "paid" : "approved";
      await ctx.db.patch("purchaseInvoices", alloc.invoiceId, {
        amountPaid: newAmountPaid,
        status: newStatus as "approved" | "paid",
      });
    }

    await ctx.db.patch("bankTransactions", args.transactionId, {
      status: "matched",
      vendorLinkId: args.vendorId,
      vendorPaymentAllocations: args.allocations,
    });

    const allTxns = await ctx.db
      .query("bankTransactions")
      .withIndex("by_statement", (q) => q.eq("statementId", tx.statementId))
      .collect();
    await ctx.db.patch("bankStatements", tx.statementId, {
      matchedRows: allTxns.filter((t) => t.status === "matched").length,
      postedRows: allTxns.filter((t) => t.status === "posted").length,
    });
  },
});

/** Removes a vendor-payment link from a transaction, reversing the journal entries and un-applying the payments. */
export const unlinkVendorPaymentFromTransaction = mutation({
  args: { transactionId: v.id("bankTransactions") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "banking");
    const ownerId = effectiveOwnerId(user);

    const tx = await ctx.db.get("bankTransactions", args.transactionId);
    if (!tx || tx.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Transaction not found" });
    }
    if (!tx.vendorLinkId || !tx.vendorPaymentAllocations) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Transaction is not linked to a vendor payment" });
    }

    // Reverse each allocation: cancel its journal entry and roll back amountPaid/status.
    // Narrow the scan to entries on the transaction's date (bank-payment entries are
    // always posted with the transaction's date), then match sourceId in memory —
    // sourceId is unbounded so it isn't indexed.
    const entriesOnDate = await ctx.db
      .query("journalEntries")
      .withIndex("by_owner_and_date", (q) => q.eq("ownerId", ownerId).eq("date", tx.date))
      .collect();
    const entries = entriesOnDate.filter((e) => e.sourceId === tx._id);
    for (const entry of entries) {
      if (entry.source === "bank_import" && entry.status !== "cancelled") {
        await ctx.db.patch("journalEntries", entry._id, { status: "cancelled" });
      }
    }

    for (const alloc of tx.vendorPaymentAllocations) {
      const invoice = await ctx.db.get("purchaseInvoices", alloc.invoiceId);
      if (!invoice) continue;
      const newAmountPaid = Math.max(0, invoice.amountPaid - alloc.amount);
      await ctx.db.patch("purchaseInvoices", alloc.invoiceId, {
        amountPaid: newAmountPaid,
        status: "approved",
      });
    }

    await ctx.db.patch("bankTransactions", args.transactionId, {
      status: "unmatched",
      vendorLinkId: undefined,
      vendorPaymentAllocations: undefined,
    });

    const stmt = await ctx.db.get("bankStatements", tx.statementId);
    if (stmt && stmt.matchedRows > 0) {
      await ctx.db.patch("bankStatements", tx.statementId, { matchedRows: stmt.matchedRows - 1 });
    }
  },
});

// ── Labour payment linking ────────────────────────────────────────────────

/**
 * Records a payment to a labourer/group from a matched bank debit line:
 * adds a "payment" entry to that labourer's ledger (paid from the statement's
 * bank account) and marks the bank transaction as matched with the labour link.
 */
export const recordLabourPaymentFromBankTx = mutation({
  args: {
    transactionId: v.id("bankTransactions"),
    labourerId: v.id("labourers"),
    /** Override amount — defaults to the transaction's debit amount */
    amount: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "banking");
    const ownerId = effectiveOwnerId(user);

    const tx = await ctx.db.get("bankTransactions", args.transactionId);
    if (!tx || tx.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Transaction not found" });
    }
    if (tx.status !== "unmatched") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Transaction already reconciled" });
    }
    if (tx.debit <= 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Only debit (money-out) transactions can be matched to a labour payment" });
    }

    const labourer = await ctx.db.get("labourers", args.labourerId);
    if (!labourer || labourer.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Labourer not found" });
    }

    const stmt = await ctx.db.get("bankStatements", tx.statementId);
    if (!stmt) throw new ConvexError({ code: "NOT_FOUND", message: "Statement not found" });

    let accountId = labourer.accountId;
    if (!accountId) {
      accountId = await createLabourerAccount(ctx, ownerId, labourer.name);
      await ctx.db.patch("labourers", args.labourerId, { accountId });
    }

    const amount = args.amount ?? tx.debit;
    const tdsRate = 1;
    const tdsAmount = Math.round(amount * (tdsRate / 100));
    const bankAmount = amount - tdsAmount;
    const tdsPayableAccountId = await getTdsPayableAccountId(ctx, ownerId);
    const entryNumber = await getNextEntryNumber(ctx, ownerId);
    const narration = args.description ?? `Bank payment — ${labourer.name}`;

    const jeId = await ctx.db.insert("journalEntries", {
      ownerId,
      entryNumber,
      date: tx.date,
      narration,
      status: "posted",
      source: "bank_import",
      sourceId: tx._id,
      reference: tx.reference,
      totalAmount: amount,
    });
    // Debit Labour Payable (gross), Credit Bank (net), and credit TDS Payable.
    await ctx.db.insert("journalLines", { ownerId, journalEntryId: jeId, accountId, side: "debit", amount, narration });
    await ctx.db.insert("journalLines", { ownerId, journalEntryId: jeId, accountId: stmt.accountId, side: "credit", amount: bankAmount, narration });
    await ctx.db.insert("journalLines", { ownerId, journalEntryId: jeId, accountId: tdsPayableAccountId, side: "credit", amount: tdsAmount, narration: "TDS Payable — 194C" });

    const labourLedgerEntryId = await ctx.db.insert("labourLedgerEntries", {
      ownerId,
      labourerId: args.labourerId,
      projectId: labourer.projectId,
      type: "payment",
      date: tx.date,
      amount,
      description: narration,
      sourceAccountId: stmt.accountId,
      journalEntryId: jeId,
      tdsSection: "194C",
      tdsRate,
      tdsAmount,
    });

    const deducteeId = await getOrCreateLabourerDeductee(ctx, ownerId, labourer);
    await ctx.db.insert("tdsDeductions", {
      ownerId,
      deducteeId,
      section: "194C",
      returnType: "26Q",
      date: tx.date,
      quarter: tdsQuarterForDate(tx.date),
      grossAmount: amount,
      rate: tdsRate,
      tdsAmount,
      sourceType: "labour_payment",
      sourceId: labourLedgerEntryId,
      certificateIssued: false,
      notes: `Automatic TDS from labour payment — ${labourer.name}`,
    });

    await ctx.db.patch("bankTransactions", args.transactionId, {
      status: "matched",
      labourLinkId: args.labourerId,
      labourLedgerEntryId,
    });

    const allTxns = await ctx.db
      .query("bankTransactions")
      .withIndex("by_statement", (q) => q.eq("statementId", tx.statementId))
      .collect();
    await ctx.db.patch("bankStatements", tx.statementId, {
      matchedRows: allTxns.filter((t) => t.status === "matched").length,
      postedRows: allTxns.filter((t) => t.status === "posted").length,
    });
  },
});

/** Removes a labour-payment link from a transaction, reversing the journal entry and ledger entry. */
export const unlinkLabourPaymentFromTransaction = mutation({
  args: { transactionId: v.id("bankTransactions") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "banking");
    const ownerId = effectiveOwnerId(user);

    const tx = await ctx.db.get("bankTransactions", args.transactionId);
    if (!tx || tx.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Transaction not found" });
    }
    if (!tx.labourLinkId) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Transaction is not linked to a labour payment" });
    }

    if (tx.labourLedgerEntryId) {
      const entry = await ctx.db.get("labourLedgerEntries", tx.labourLedgerEntryId);
      if (entry?.journalEntryId) {
        await ctx.db.patch("journalEntries", entry.journalEntryId, { status: "cancelled" });
      }
      await ctx.db.delete("labourLedgerEntries", tx.labourLedgerEntryId);
    }

    await ctx.db.patch("bankTransactions", args.transactionId, {
      status: "unmatched",
      labourLinkId: undefined,
      labourLedgerEntryId: undefined,
    });

    const stmt = await ctx.db.get("bankStatements", tx.statementId);
    if (stmt && stmt.matchedRows > 0) {
      await ctx.db.patch("bankStatements", tx.statementId, { matchedRows: stmt.matchedRows - 1 });
    }
  },
});
