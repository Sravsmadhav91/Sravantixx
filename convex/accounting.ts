import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { effectiveOwnerId, requireOwner, requireUser } from "./lib/auth.ts";
import { requireModuleAccess, canAccessModule } from "./lib/rbac.ts";
import { DEFAULT_ACCOUNTS } from "./lib/defaultAccounts.ts";
import { nextAccountCode } from "./lib/accountCodes.ts";
import { voucherTypeValidator } from "./schema/accounting.ts";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// ── Helpers ──────────────────────────────────────────────────────────────────

type VoucherType = NonNullable<Doc<"journalEntries">["voucherType"]>;

const VOUCHER_PREFIXES: Record<VoucherType, string> = {
  sales: "SAL",
  purchase: "PUR",
  payment: "PMT",
  receipt: "RCT",
  contra: "CON",
  debit_note: "DR",
  credit_note: "CR",
};

/** Generates the next sequential number for manual journal entries or a voucher type, resetting each calendar year. */
async function getNextEntryNumber(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  voucherType?: VoucherType,
): Promise<string> {
  const prefix = voucherType ? VOUCHER_PREFIXES[voucherType] : "JE";
  const last = await ctx.db
    .query("journalEntries")
    .withIndex("by_owner_and_voucher_type", (q) => q.eq("ownerId", ownerId).eq("voucherType", voucherType))
    .order("desc")
    .first();

  const year = new Date().getFullYear();
  if (!last) return `${prefix}-${year}-001`;

  const match = last.entryNumber.match(new RegExp(`^${prefix}-(\\d{4})-(\\d+)$`));
  if (!match) return `${prefix}-${year}-001`;
  const seq = match[1] === String(year) ? parseInt(match[2], 10) + 1 : 1;
  return `${prefix}-${year}-${String(seq).padStart(3, "0")}`;
}

const voucherLineValidator = v.object({
  accountId: v.id("accounts"),
  side: v.union(v.literal("debit"), v.literal("credit")),
  amount: v.number(),
  narration: v.optional(v.string()),
  projectId: v.optional(v.id("projects")),
  costCenterId: v.optional(v.id("costCenters")),
});

/**
 * Validates and inserts a balanced double-entry journal entry (shared by manual
 * journal entries and Tally-style vouchers). Returns the new entry's id.
 */
async function insertBalancedEntry(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  args: {
    date: string;
    narration: string;
    reference?: string;
    lines: Array<{
      accountId: Id<"accounts">;
      side: "debit" | "credit";
      amount: number;
      narration?: string;
      projectId?: Id<"projects">;
      costCenterId?: Id<"costCenters">;
    }>;
    post?: boolean;
    source: string;
    voucherType?: VoucherType;
    primaryAccountId?: Id<"accounts">;
  },
): Promise<Id<"journalEntries">> {
  if (args.lines.length < 2) {
    throw new ConvexError({ code: "BAD_REQUEST", message: "An entry must have at least 2 lines" });
  }

  const totalDebit = args.lines.filter((l) => l.side === "debit").reduce((s, l) => s + l.amount, 0);
  const totalCredit = args.lines.filter((l) => l.side === "credit").reduce((s, l) => s + l.amount, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `Entry does not balance. Debits: ₹${totalDebit.toFixed(2)}, Credits: ₹${totalCredit.toFixed(2)}`,
    });
  }
  if (totalDebit <= 0) {
    throw new ConvexError({ code: "BAD_REQUEST", message: "Entry amount must be greater than zero" });
  }

  for (const line of args.lines) {
    const account = await ctx.db.get("accounts", line.accountId);
    if (!account || account.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Account not found" });
    }
    if (!account.isActive) {
      throw new ConvexError({ code: "BAD_REQUEST", message: `Account "${account.name}" is inactive` });
    }
  }

  const entryNumber = await getNextEntryNumber(ctx, ownerId, args.voucherType);
  const entryId = await ctx.db.insert("journalEntries", {
    ownerId,
    entryNumber,
    date: args.date,
    narration: args.narration,
    reference: args.reference,
    status: args.post === false ? "draft" : "posted",
    source: args.source,
    totalAmount: totalDebit,
    voucherType: args.voucherType,
    primaryAccountId: args.primaryAccountId,
  });

  for (const line of args.lines) {
    await ctx.db.insert("journalLines", {
      ownerId,
      journalEntryId: entryId,
      accountId: line.accountId,
      side: line.side,
      amount: line.amount,
      narration: line.narration,
      projectId: line.projectId,
      costCenterId: line.costCenterId,
    });
  }

  return entryId;
}

// ── Seed default chart of accounts ───────────────────────────────────────────

export const seedDefaultAccounts = mutation({
  args: {},
  handler: async (ctx): Promise<{ seeded: number }> => {
    const user = await requireOwner(ctx);
    const ownerId = user._id;

    // Check if already seeded
    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .first();
    if (existing) return { seeded: 0 };

    let seeded = 0;
    for (const acct of DEFAULT_ACCOUNTS) {
      await ctx.db.insert("accounts", { ...acct, ownerId });
      seeded++;
    }
    return { seeded };
  },
});

// ── Chart of Accounts ─────────────────────────────────────────────────────────

export const listAccounts = query({
  args: {
    type: v.optional(v.union(
      v.literal("asset"),
      v.literal("liability"),
      v.literal("income"),
      v.literal("expense"),
      v.literal("equity"),
    )),
    group: v.optional(v.string()),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    let accounts;
    if (args.type) {
      accounts = await ctx.db
        .query("accounts")
        .withIndex("by_owner_and_type", (q) =>
          q.eq("ownerId", ownerId).eq("type", args.type!),
        )
        .collect();
    } else {
      accounts = await ctx.db
        .query("accounts")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .collect();
    }

    if (args.group) {
      accounts = accounts.filter((a) => a.group === args.group);
    }
    if (args.activeOnly) {
      accounts = accounts.filter((a) => a.isActive);
    }
    return accounts.sort((a, b) => a.code.localeCompare(b.code));
  },
});

export const getAccount = query({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const account = await ctx.db.get("accounts", args.accountId);
    if (!account || account.ownerId !== ownerId) return null;
    return account;
  },
});

export const createAccount = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("asset"),
      v.literal("liability"),
      v.literal("income"),
      v.literal("expense"),
      v.literal("equity"),
    ),
    group: v.union(
      v.literal("bank_and_cash"),
      v.literal("receivables"),
      v.literal("current_assets"),
      v.literal("fixed_assets"),
      v.literal("payables"),
      v.literal("current_liabilities"),
      v.literal("loans"),
      v.literal("sales_income"),
      v.literal("other_income"),
      v.literal("direct_expenses"),
      v.literal("indirect_expenses"),
      v.literal("finance_charges"),
      v.literal("capital"),
      v.literal("reserves"),
    ),
    openingBalance: v.optional(v.number()),
    openingBalanceDate: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "accounting");
    const ownerId = effectiveOwnerId(user);

    // Check code uniqueness
    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_owner_and_code", (q) =>
        q.eq("ownerId", ownerId).eq("code", args.code),
      )
      .unique();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Account code ${args.code} already exists`,
      });
    }

    return ctx.db.insert("accounts", {
      ownerId,
      ...args,
      isSystem: false,
      isActive: true,
    });
  },
});

/**
 * Creates a new account with an auto-generated code, callable from anywhere
 * that needs to spin up a missing account inline (e.g. the bank reconciliation
 * contra-account picker) without navigating to the Chart of Accounts page.
 * Accessible to any module that can post to the ledger, not just "accounting".
 */
export const quickCreateAccount = mutation({
  args: {
    name: v.string(),
    type: v.union(
      v.literal("asset"),
      v.literal("liability"),
      v.literal("income"),
      v.literal("expense"),
      v.literal("equity"),
    ),
    group: v.union(
      v.literal("bank_and_cash"),
      v.literal("receivables"),
      v.literal("current_assets"),
      v.literal("fixed_assets"),
      v.literal("payables"),
      v.literal("current_liabilities"),
      v.literal("loans"),
      v.literal("sales_income"),
      v.literal("other_income"),
      v.literal("direct_expenses"),
      v.literal("indirect_expenses"),
      v.literal("finance_charges"),
      v.literal("capital"),
      v.literal("reserves"),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!canAccessModule(user.role, "accounting") && !canAccessModule(user.role, "banking")) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You don't have access to create accounts. Contact your account owner.",
      });
    }
    const ownerId = effectiveOwnerId(user);

    const name = args.name.trim();
    if (!name) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Account name is required" });
    }

    const code = await nextAccountCode(ctx, ownerId, args.type);
    const accountId = await ctx.db.insert("accounts", {
      ownerId,
      code,
      name,
      type: args.type,
      group: args.group,
      isSystem: false,
      isActive: true,
    });
    return { accountId, code, name };
  },
});

export const updateAccount = mutation({
  args: {
    accountId: v.id("accounts"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    openingBalance: v.optional(v.number()),
    openingBalanceDate: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "accounting");
    const ownerId = effectiveOwnerId(user);
    const { accountId, ...updates } = args;

    const account = await ctx.db.get("accounts", accountId);
    if (!account || account.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Account not found" });
    }

    await ctx.db.patch("accounts", accountId, updates);
  },
});

export const deleteAccount = mutation({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    const user = await requireOwner(ctx);
    const ownerId = user._id;

    const account = await ctx.db.get("accounts", args.accountId);
    if (!account || account.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Account not found" });
    }
    if (account.isSystem) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "System accounts cannot be deleted",
      });
    }

    // Check if account has any journal lines
    const line = await ctx.db
      .query("journalLines")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .first();
    if (line) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Cannot delete an account that has transactions. Deactivate it instead.",
      });
    }

    await ctx.db.delete("accounts", args.accountId);
  },
});

// ── Journal Entries ───────────────────────────────────────────────────────────

export const listJournalEntries = query({
  args: {
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("posted"),
      v.literal("cancelled"),
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    let entries = await ctx.db
      .query("journalEntries")
      .withIndex("by_owner_and_date", (q) => {
        const q2 = q.eq("ownerId", ownerId);
        if (args.fromDate) return q2.gte("date", args.fromDate);
        return q2;
      })
      .order("desc")
      .take(args.limit ?? 200);

    if (args.toDate) {
      entries = entries.filter((e) => e.date <= args.toDate!);
    }
    if (args.status) {
      entries = entries.filter((e) => e.status === args.status);
    }
    return entries;
  },
});

export const getJournalEntry = query({
  args: { entryId: v.id("journalEntries") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    const entry = await ctx.db.get("journalEntries", args.entryId);
    if (!entry || entry.ownerId !== ownerId) return null;

    const lines = await ctx.db
      .query("journalLines")
      .withIndex("by_entry", (q) => q.eq("journalEntryId", args.entryId))
      .collect();

    const linesWithAccounts = await Promise.all(
      lines.map(async (line) => ({
        line,
        account: await ctx.db.get("accounts", line.accountId),
      })),
    );

    return { entry, lines: linesWithAccounts };
  },
});

export const createJournalEntry = mutation({
  args: {
    date: v.string(),
    narration: v.string(),
    reference: v.optional(v.string()),
    lines: v.array(voucherLineValidator),
    /** Post immediately (true) or save as draft (false) */
    post: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"journalEntries">> => {
    const user = await requireModuleAccess(ctx, "accounting");
    return insertBalancedEntry(ctx, effectiveOwnerId(user), { ...args, source: "manual" });
  },
});

export const postJournalEntry = mutation({
  args: { entryId: v.id("journalEntries") },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "accounting");
    const ownerId = effectiveOwnerId(user);
    const entry = await ctx.db.get("journalEntries", args.entryId);
    if (!entry || entry.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Entry not found" });
    }
    if (entry.status !== "draft") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Only draft entries can be posted" });
    }
    await ctx.db.patch("journalEntries", args.entryId, { status: "posted" });
  },
});

export const cancelJournalEntry = mutation({
  args: { entryId: v.id("journalEntries") },
  handler: async (ctx, args) => {
    const user = await requireOwner(ctx);
    const ownerId = user._id;
    const entry = await ctx.db.get("journalEntries", args.entryId);
    if (!entry || entry.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Entry not found" });
    }
    if (entry.status === "cancelled") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Entry already cancelled" });
    }
    await ctx.db.patch("journalEntries", args.entryId, { status: "cancelled" });
  },
});

// ── Vouchers (Tally-style: Sales, Purchase, Payment, Receipt, Contra, Debit/Credit Note) ──

/**
 * Creates a Tally-style voucher. A voucher is a journal entry with a `voucherType`
 * and a `primaryAccountId` (the party / bank / cash account) so voucher registers
 * can list and filter by type quickly.
 */
export const createVoucher = mutation({
  args: {
    voucherType: voucherTypeValidator,
    date: v.string(),
    narration: v.string(),
    reference: v.optional(v.string()),
    /** The main party/bank/cash account this voucher is against, shown in the voucher register */
    primaryAccountId: v.id("accounts"),
    lines: v.array(voucherLineValidator),
    post: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"journalEntries">> => {
    const user = await requireModuleAccess(ctx, "accounting");
    return insertBalancedEntry(ctx, effectiveOwnerId(user), {
      ...args,
      source: "voucher",
    });
  },
});

export const listVouchers = query({
  args: {
    voucherType: v.optional(voucherTypeValidator),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<
    Array<Doc<"journalEntries"> & { primaryAccountName?: string }>
  > => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    let entries: Doc<"journalEntries">[];
    if (args.voucherType) {
      entries = await ctx.db
        .query("journalEntries")
        .withIndex("by_owner_and_voucher_type", (q) =>
          q.eq("ownerId", ownerId).eq("voucherType", args.voucherType),
        )
        .order("desc")
        .take(args.limit ?? 200);
    } else {
      entries = await ctx.db
        .query("journalEntries")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .order("desc")
        .collect();
      entries = entries.filter((e) => e.voucherType !== undefined);
    }

    if (args.fromDate) entries = entries.filter((e) => e.date >= args.fromDate!);
    if (args.toDate) entries = entries.filter((e) => e.date <= args.toDate!);

    const accountIds = [...new Set(entries.map((e) => e.primaryAccountId).filter((id) => id !== undefined))];
    const accounts = await Promise.all(accountIds.map((id) => ctx.db.get("accounts", id!)));
    const accountMap = new Map(accounts.filter((a) => a !== null).map((a) => [a!._id, a!.name]));

    return entries
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((e) => ({ ...e, primaryAccountName: e.primaryAccountId ? accountMap.get(e.primaryAccountId) : undefined }));
  },
});

// ── Account Ledger ────────────────────────────────────────────────────────────

export const getAccountLedger = query({
  args: {
    accountId: v.id("accounts"),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    const account = await ctx.db.get("accounts", args.accountId);
    if (!account || account.ownerId !== ownerId) return null;

    // Fetch all lines for this account
    const lines = await ctx.db
      .query("journalLines")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();

    // Fetch associated posted entries
    const entryIds = [...new Set(lines.map((l) => l.journalEntryId))];
    const entries = await Promise.all(entryIds.map((id) => ctx.db.get("journalEntries", id)));
    const entryMap = new Map(
      entries
        .filter((e) => e !== null && e.status === "posted")
        .map((e) => [e!._id, e!]),
    );

    // Filter lines to posted entries and date range
    const filteredLines = lines
      .filter((l) => {
        const entry = entryMap.get(l.journalEntryId);
        if (!entry) return false;
        if (args.fromDate && entry.date < args.fromDate) return false;
        if (args.toDate && entry.date > args.toDate) return false;
        return true;
      })
      .sort((a, b) => {
        const ea = entryMap.get(a.journalEntryId);
        const eb = entryMap.get(b.journalEntryId);
        return (ea?.date ?? "").localeCompare(eb?.date ?? "");
      });

    // Calculate running balance
    // For asset/expense: debit increases balance; for liability/income/equity: credit increases
    const normalSide: "debit" | "credit" =
      account.type === "asset" || account.type === "expense" ? "debit" : "credit";

    let runningBalance = account.openingBalance ?? 0;
    const rows = filteredLines.map((line) => {
      const entry = entryMap.get(line.journalEntryId)!;
      const signed =
        line.side === normalSide ? line.amount : -line.amount;
      runningBalance += signed;
      return {
        date: entry.date,
        entryNumber: entry.entryNumber,
        narration: line.narration ?? entry.narration,
        reference: entry.reference,
        debit: line.side === "debit" ? line.amount : 0,
        credit: line.side === "credit" ? line.amount : 0,
        balance: runningBalance,
      };
    });

    return {
      account,
      openingBalance: account.openingBalance ?? 0,
      normalSide,
      rows,
      closingBalance: runningBalance,
    };
  },
});

// ── Day Book ──────────────────────────────────────────────────────────────────

export const getDayBook = query({
  args: {
    fromDate: v.string(),
    toDate: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    const entries = await ctx.db
      .query("journalEntries")
      .withIndex("by_owner_and_date", (q) =>
        q.eq("ownerId", ownerId).gte("date", args.fromDate),
      )
      .order("asc")
      .collect();

    const filtered = entries.filter(
      (e) => e.date <= args.toDate && e.status === "posted",
    );

    // Fetch lines for each entry
    const result = await Promise.all(
      filtered.map(async (entry) => {
        const lines = await ctx.db
          .query("journalLines")
          .withIndex("by_entry", (q) => q.eq("journalEntryId", entry._id))
          .collect();

        const linesWithAccounts = await Promise.all(
          lines.map(async (line) => ({
            ...line,
            accountName:
              (await ctx.db.get("accounts", line.accountId))?.name ?? "—",
            accountCode:
              (await ctx.db.get("accounts", line.accountId))?.code ?? "—",
          })),
        );

        return { ...entry, lines: linesWithAccounts };
      }),
    );

    return result;
  },
});

// ── Account balance summary (for dashboard widget) ────────────────────────────

export const getAccountBalances = query({
  args: { type: v.optional(v.union(
    v.literal("asset"),
    v.literal("liability"),
    v.literal("income"),
    v.literal("expense"),
    v.literal("equity"),
  )) },
  handler: async (ctx, args): Promise<Array<{
    accountId: Id<"accounts">;
    code: string;
    name: string;
    type: string;
    group: string;
    balance: number;
  }>> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    let accts = await ctx.db
      .query("accounts")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();

    if (args.type) accts = accts.filter((a) => a.type === args.type);
    accts = accts.filter((a) => a.isActive);

    const results = await Promise.all(
      accts.map(async (account) => {
        const lines = await ctx.db
          .query("journalLines")
          .withIndex("by_account", (q) => q.eq("accountId", account._id))
          .collect();

        // Only count posted entries
        const entryIds = [...new Set(lines.map((l) => l.journalEntryId))];
        const entries = await Promise.all(
          entryIds.map((id) => ctx.db.get("journalEntries", id)),
        );
        const postedIds = new Set(
          entries.filter((e) => e?.status === "posted").map((e) => e!._id),
        );

        const normalSide: "debit" | "credit" =
          account.type === "asset" || account.type === "expense" ? "debit" : "credit";

        let balance = account.openingBalance ?? 0;
        for (const line of lines) {
          if (!postedIds.has(line.journalEntryId)) continue;
          balance += line.side === normalSide ? line.amount : -line.amount;
        }

        return {
          accountId: account._id,
          code: account.code,
          name: account.name,
          type: account.type,
          group: account.group,
          balance,
        };
      }),
    );

    return results.sort((a, b) => a.code.localeCompare(b.code));
  },
});

// ── Cost Centers ──────────────────────────────────────────────────────────────

export const listCostCenters = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    let centers = await ctx.db
      .query("costCenters")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    if (args.activeOnly) centers = centers.filter((c) => c.isActive);
    return centers.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createCostCenter = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "accounting");
    const ownerId = effectiveOwnerId(user);

    const existing = await ctx.db
      .query("costCenters")
      .withIndex("by_owner_and_code", (q) => q.eq("ownerId", ownerId).eq("code", args.code))
      .unique();
    if (existing) {
      throw new ConvexError({ code: "CONFLICT", message: `Cost center code ${args.code} already exists` });
    }

    return ctx.db.insert("costCenters", {
      ownerId,
      code: args.code,
      name: args.name,
      description: args.description,
      isActive: true,
    });
  },
});

export const updateCostCenter = mutation({
  args: {
    costCenterId: v.id("costCenters"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "accounting");
    const ownerId = effectiveOwnerId(user);
    const { costCenterId, ...updates } = args;

    const center = await ctx.db.get("costCenters", costCenterId);
    if (!center || center.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Cost center not found" });
    }
    await ctx.db.patch("costCenters", costCenterId, updates);
  },
});

export const deleteCostCenter = mutation({
  args: { costCenterId: v.id("costCenters") },
  handler: async (ctx, args) => {
    const user = await requireOwner(ctx);
    const ownerId = user._id;

    const center = await ctx.db.get("costCenters", args.costCenterId);
    if (!center || center.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Cost center not found" });
    }

    const line = await ctx.db
      .query("journalLines")
      .withIndex("by_cost_center", (q) => q.eq("costCenterId", args.costCenterId))
      .first();
    if (line) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Cannot delete a cost center with transactions. Deactivate it instead.",
      });
    }

    await ctx.db.delete("costCenters", args.costCenterId);
  },
});
