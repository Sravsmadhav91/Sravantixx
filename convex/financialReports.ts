import { v } from "convex/values";
import { query } from "./_generated/server.js";
import { effectiveOwnerId, requireUser } from "./lib/auth.ts";
import type { Id, Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

// ── Types ─────────────────────────────────────────────────────────────────────

type AccountRow = {
  accountId: Id<"accounts">;
  code: string;
  name: string;
  type: "asset" | "liability" | "income" | "expense" | "equity";
  group: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  balance: number;
};

type PLGroup = {
  group: string;
  accounts: AccountRow[];
  subtotal: number;
};

type BSSection = {
  type: string;
  groups: { group: string; accounts: AccountRow[]; subtotal: number }[];
  total: number;
};

// ── Shared helper: build account balance map ──────────────────────────────────

async function buildAccountBalances(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  fromDate: string | undefined,
  toDate: string | undefined,
  accountType?: "asset" | "liability" | "income" | "expense" | "equity",
): Promise<AccountRow[]> {
  let accounts: Doc<"accounts">[] = await ctx.db
    .query("accounts")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();

  if (accountType) accounts = accounts.filter((a) => a.type === accountType);
  accounts = accounts.filter((a) => a.isActive);

  const results: AccountRow[] = [];

  for (const account of accounts) {
    const lines = await ctx.db
      .query("journalLines")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .collect();

    if (lines.length === 0 && !account.openingBalance) continue;

    // Fetch associated entries (only posted)
    const entryIds = [...new Set(lines.map((l) => l.journalEntryId))];
    const entries = await Promise.all(entryIds.map((id) => ctx.db.get("journalEntries", id)));
    const postedEntryMap = new Map<Id<"journalEntries">, Doc<"journalEntries">>(
      entries
        .filter((e): e is Doc<"journalEntries"> => e !== null && e.status === "posted")
        .map((e) => [e._id, e]),
    );

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      const entry = postedEntryMap.get(line.journalEntryId);
      if (!entry) continue;
      if (fromDate && entry.date < fromDate) continue;
      if (toDate && entry.date > toDate) continue;

      if (line.side === "debit") totalDebit += line.amount;
      else totalCredit += line.amount;
    }

    const normalSide: "debit" | "credit" =
      account.type === "asset" || account.type === "expense" ? "debit" : "credit";

    const openingBalance = account.openingBalance ?? 0;
    const netMovement = totalDebit - totalCredit;
    const balance =
      normalSide === "debit"
        ? openingBalance + netMovement
        : openingBalance - netMovement;

    // Skip zero-everything accounts
    if (totalDebit === 0 && totalCredit === 0 && openingBalance === 0) continue;

    results.push({
      accountId: account._id,
      code: account.code,
      name: account.name,
      type: account.type,
      group: account.group,
      openingBalance,
      totalDebit,
      totalCredit,
      balance,
    });
  }

  return results.sort((a, b) => a.code.localeCompare(b.code));
}

// ── Trial Balance ─────────────────────────────────────────────────────────────

export const getTrialBalance = query({
  args: {
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    rows: AccountRow[];
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
    fromDate?: string;
    toDate?: string;
  }> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    const rows = await buildAccountBalances(ctx, ownerId, args.fromDate, args.toDate);

    const totalDebit = rows.reduce((s, r) => s + r.totalDebit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.totalCredit, 0);

    return {
      rows,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 1,
      fromDate: args.fromDate,
      toDate: args.toDate,
    };
  },
});

// ── Profit & Loss ─────────────────────────────────────────────────────────────

export const getProfitAndLoss = query({
  args: {
    fromDate: v.string(),
    toDate: v.string(),
  },
  handler: async (ctx, args): Promise<{
    incomeGroups: PLGroup[];
    expenseGroups: PLGroup[];
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    fromDate: string;
    toDate: string;
  }> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    const incomeRows = await buildAccountBalances(ctx, ownerId, args.fromDate, args.toDate, "income");
    const expenseRows = await buildAccountBalances(ctx, ownerId, args.fromDate, args.toDate, "expense");

    const groupRows = (rows: AccountRow[]): PLGroup[] => {
      const map = new Map<string, AccountRow[]>();
      for (const row of rows) {
        if (!map.has(row.group)) map.set(row.group, []);
        map.get(row.group)!.push(row);
      }
      return [...map.entries()].map(([group, accounts]) => ({
        group,
        accounts,
        subtotal: accounts.reduce((s, a) => s + Math.abs(a.balance), 0),
      }));
    };

    const incomeGroups = groupRows(incomeRows);
    const expenseGroups = groupRows(expenseRows);

    const totalIncome = incomeGroups.reduce((s, g) => s + g.subtotal, 0);
    const totalExpenses = expenseGroups.reduce((s, g) => s + g.subtotal, 0);

    return {
      incomeGroups,
      expenseGroups,
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      fromDate: args.fromDate,
      toDate: args.toDate,
    };
  },
});

// ── Cash Flow Statement ────────────────────────────────────────────────────────

/** Which cash-flow activity a given account group's movements belong to. */
const ACTIVITY_BY_GROUP: Record<string, "operating" | "investing" | "financing"> = {
  receivables: "operating",
  payables: "operating",
  current_assets: "operating",
  current_liabilities: "operating",
  sales_income: "operating",
  other_income: "operating",
  direct_expenses: "operating",
  indirect_expenses: "operating",
  finance_charges: "operating",
  fixed_assets: "investing",
  loans: "financing",
  capital: "financing",
  reserves: "financing",
};

type CashFlowGroupItem = { group: string; amount: number };
type CashFlowSection = { groups: CashFlowGroupItem[]; subtotal: number };

/** Returns the ISO date one calendar day before the given ISO date. */
function dayBefore(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export const getCashFlowStatement = query({
  args: {
    fromDate: v.string(),
    toDate: v.string(),
  },
  handler: async (ctx, args): Promise<{
    operating: CashFlowSection;
    investing: CashFlowSection;
    financing: CashFlowSection;
    netCashFlow: number;
    openingCashBalance: number;
    closingCashBalance: number;
    fromDate: string;
    toDate: string;
  }> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    // Cash and bank accounts define what counts as "cash" for this statement.
    const cashAccounts = (
      await ctx.db
        .query("accounts")
        .withIndex("by_owner_and_group", (q) => q.eq("ownerId", ownerId).eq("group", "bank_and_cash"))
        .collect()
    ).filter((a) => a.isActive);
    const cashAccountIds = new Set<Id<"accounts">>(cashAccounts.map((a) => a._id));

    // Opening / closing cash positions (reuses the same balance logic as the balance sheet).
    const [openingRows, closingRows] = await Promise.all([
      buildAccountBalances(ctx, ownerId, undefined, dayBefore(args.fromDate), "asset"),
      buildAccountBalances(ctx, ownerId, undefined, args.toDate, "asset"),
    ]);
    const openingCashBalance = openingRows
      .filter((r) => r.group === "bank_and_cash")
      .reduce((s, r) => s + r.balance, 0);
    const closingCashBalance = closingRows
      .filter((r) => r.group === "bank_and_cash")
      .reduce((s, r) => s + r.balance, 0);

    if (cashAccountIds.size === 0) {
      const empty = { groups: [], subtotal: 0 };
      return {
        operating: empty,
        investing: empty,
        financing: empty,
        netCashFlow: 0,
        openingCashBalance,
        closingCashBalance,
        fromDate: args.fromDate,
        toDate: args.toDate,
      };
    }

    // Find every posted entry within the period that moved a cash/bank account, and
    // the net cash movement on that entry.
    const netCashByEntry = new Map<Id<"journalEntries">, number>();
    for (const accountId of cashAccountIds) {
      const lines = await ctx.db
        .query("journalLines")
        .withIndex("by_account", (q) => q.eq("accountId", accountId))
        .collect();
      for (const line of lines) {
        const entry = await ctx.db.get("journalEntries", line.journalEntryId);
        if (!entry || entry.status !== "posted") continue;
        if (entry.date < args.fromDate || entry.date > args.toDate) continue;
        const delta = line.side === "debit" ? line.amount : -line.amount;
        netCashByEntry.set(line.journalEntryId, (netCashByEntry.get(line.journalEntryId) ?? 0) + delta);
      }
    }

    // Classify each entry's net cash movement by the dominant non-cash counter-account's group.
    const accountGroupCache = new Map<Id<"accounts">, string>();
    const getGroup = async (accountId: Id<"accounts">): Promise<string> => {
      const cached = accountGroupCache.get(accountId);
      if (cached) return cached;
      const account = await ctx.db.get("accounts", accountId);
      const group = account?.group ?? "current_assets";
      accountGroupCache.set(accountId, group);
      return group;
    };

    const amountByActivityAndGroup: Record<"operating" | "investing" | "financing", Map<string, number>> = {
      operating: new Map(),
      investing: new Map(),
      financing: new Map(),
    };

    for (const [entryId, netCashChange] of netCashByEntry) {
      if (Math.abs(netCashChange) < 0.01) continue; // pure cash-to-cash contra, no external effect

      const allLines = await ctx.db
        .query("journalLines")
        .withIndex("by_entry", (q) => q.eq("journalEntryId", entryId))
        .collect();
      const counterLines = allLines.filter((l) => !cashAccountIds.has(l.accountId));
      if (counterLines.length === 0) continue;

      const amountByGroup = new Map<string, number>();
      for (const line of counterLines) {
        const group = await getGroup(line.accountId);
        amountByGroup.set(group, (amountByGroup.get(group) ?? 0) + line.amount);
      }

      // Dominant group = the counter-account group with the largest absolute value on this entry.
      let dominantGroup = "current_assets";
      let maxAmount = -1;
      for (const [group, amount] of amountByGroup) {
        if (amount > maxAmount) {
          maxAmount = amount;
          dominantGroup = group;
        }
      }

      const activity = ACTIVITY_BY_GROUP[dominantGroup] ?? "operating";
      const bucket = amountByActivityAndGroup[activity];
      bucket.set(dominantGroup, (bucket.get(dominantGroup) ?? 0) + netCashChange);
    }

    const toSection = (map: Map<string, number>): CashFlowSection => {
      const groups = [...map.entries()]
        .map(([group, amount]) => ({ group, amount }))
        .sort((a, b) => b.amount - a.amount);
      return { groups, subtotal: groups.reduce((s, g) => s + g.amount, 0) };
    };

    const operating = toSection(amountByActivityAndGroup.operating);
    const investing = toSection(amountByActivityAndGroup.investing);
    const financing = toSection(amountByActivityAndGroup.financing);

    return {
      operating,
      investing,
      financing,
      netCashFlow: operating.subtotal + investing.subtotal + financing.subtotal,
      openingCashBalance,
      closingCashBalance,
      fromDate: args.fromDate,
      toDate: args.toDate,
    };
  },
});

// ── Cost Center P&L ────────────────────────────────────────────────────────────

type CostCenterRow = {
  costCenterId: Id<"costCenters"> | null;
  code: string;
  name: string;
  income: number;
  expense: number;
  net: number;
};

export const getCostCenterReport = query({
  args: {
    fromDate: v.string(),
    toDate: v.string(),
  },
  handler: async (ctx, args): Promise<{
    rows: CostCenterRow[];
    totalIncome: number;
    totalExpense: number;
    fromDate: string;
    toDate: string;
  }> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    const centers = await ctx.db
      .query("costCenters")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    const centerMap = new Map(centers.map((c) => [c._id, c]));

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    const incomeExpenseAccountIds = new Set(
      accounts.filter((a) => a.type === "income" || a.type === "expense").map((a) => a._id),
    );
    const accountTypeMap = new Map(accounts.map((a) => [a._id, a.type]));

    // Aggregate per cost center (null = untagged) by scanning journal lines tagged
    // with a cost center, plus a pass for untagged income/expense lines.
    const totals = new Map<string, { income: number; expense: number }>();
    const bump = (key: string, type: "income" | "expense", amount: number) => {
      const cur = totals.get(key) ?? { income: 0, expense: 0 };
      if (type === "income") cur.income += amount;
      else cur.expense += amount;
      totals.set(key, cur);
    };

    for (const account of accounts) {
      if (account.type !== "income" && account.type !== "expense") continue;
      const lines = await ctx.db
        .query("journalLines")
        .withIndex("by_account", (q) => q.eq("accountId", account._id))
        .collect();

      for (const line of lines) {
        const entry = await ctx.db.get("journalEntries", line.journalEntryId);
        if (!entry || entry.status !== "posted") continue;
        if (entry.date < args.fromDate || entry.date > args.toDate) continue;
        if (!incomeExpenseAccountIds.has(line.accountId)) continue;

        const type = accountTypeMap.get(line.accountId);
        if (!type || (type !== "income" && type !== "expense")) continue;

        // Normal side: income = credit increases, expense = debit increases
        const normalSide: "debit" | "credit" = type === "expense" ? "debit" : "credit";
        const signedAmount = line.side === normalSide ? line.amount : -line.amount;

        const key = line.costCenterId ?? "unassigned";
        bump(key, type, signedAmount);
      }
    }

    const rows: CostCenterRow[] = [...totals.entries()].map(([key, t]) => {
      if (key === "unassigned") {
        return { costCenterId: null, code: "—", name: "Unassigned", income: t.income, expense: t.expense, net: t.income - t.expense };
      }
      const center = centerMap.get(key as Id<"costCenters">);
      return {
        costCenterId: key as Id<"costCenters">,
        code: center?.code ?? "—",
        name: center?.name ?? "Unknown",
        income: t.income,
        expense: t.expense,
        net: t.income - t.expense,
      };
    });

    rows.sort((a, b) => (a.code === "—" ? 1 : b.code === "—" ? -1 : a.code.localeCompare(b.code)));

    return {
      rows,
      totalIncome: rows.reduce((s, r) => s + r.income, 0),
      totalExpense: rows.reduce((s, r) => s + r.expense, 0),
      fromDate: args.fromDate,
      toDate: args.toDate,
    };
  },
});

// ── Balance Sheet ─────────────────────────────────────────────────────────────

export const getBalanceSheet = query({
  args: {
    asOfDate: v.string(),
  },
  handler: async (ctx, args): Promise<{
    assets: BSSection;
    liabilities: BSSection;
    equity: BSSection;
    retainedEarnings: number;
    totalAssets: number;
    totalLiabilitiesAndEquity: number;
    isBalanced: boolean;
    asOfDate: string;
  }> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    const [assetRows, liabilityRows, equityRows, incomeRows, expenseRows] = await Promise.all([
      buildAccountBalances(ctx, ownerId, undefined, args.asOfDate, "asset"),
      buildAccountBalances(ctx, ownerId, undefined, args.asOfDate, "liability"),
      buildAccountBalances(ctx, ownerId, undefined, args.asOfDate, "equity"),
      buildAccountBalances(ctx, ownerId, undefined, args.asOfDate, "income"),
      buildAccountBalances(ctx, ownerId, undefined, args.asOfDate, "expense"),
    ]);

    const groupBy = (rows: AccountRow[]) => {
      const map = new Map<string, AccountRow[]>();
      for (const row of rows) {
        if (!map.has(row.group)) map.set(row.group, []);
        map.get(row.group)!.push(row);
      }
      return [...map.entries()].map(([group, accounts]) => ({
        group,
        accounts,
        subtotal: accounts.reduce((s, a) => s + Math.abs(a.balance), 0),
      }));
    };

    const toSection = (type: string, rows: AccountRow[]): BSSection => {
      const groups = groupBy(rows);
      return { type, groups, total: groups.reduce((s, g) => s + g.subtotal, 0) };
    };

    const assets = toSection("asset", assetRows);
    const liabilities = toSection("liability", liabilityRows);
    const equity = toSection("equity", equityRows);

    const totalIncome = incomeRows.reduce((s, a) => s + Math.abs(a.balance), 0);
    const totalExpenses = expenseRows.reduce((s, a) => s + Math.abs(a.balance), 0);
    const retainedEarnings = totalIncome - totalExpenses;

    const totalAssets = assets.total;
    const totalLiabilitiesAndEquity = liabilities.total + equity.total + retainedEarnings;

    return {
      assets,
      liabilities,
      equity,
      retainedEarnings,
      totalAssets,
      totalLiabilitiesAndEquity,
      isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1,
      asOfDate: args.asOfDate,
    };
  },
});
