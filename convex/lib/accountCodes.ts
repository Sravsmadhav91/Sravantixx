import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type AccountTypeForCode = "asset" | "liability" | "income" | "expense" | "equity";

/** Reserved code bands per account type, kept clear of the default seeded chart of accounts. */
const BAND_START: Record<AccountTypeForCode, number> = {
  asset: 1900,
  liability: 2900,
  income: 3900,
  expense: 4900,
  equity: 5900,
};

/**
 * Finds the next unused account code within a type-specific reserved band
 * (19xx/29xx/39xx/49xx/59xx) so quick-created accounts never clash with
 * default seeded codes or ones a user picked manually.
 */
export async function nextAccountCode(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"users">,
  type: AccountTypeForCode,
): Promise<string> {
  const existing = await ctx.db
    .query("accounts")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  const usedCodes = new Set(existing.map((a) => a.code));
  let code = BAND_START[type];
  while (usedCodes.has(String(code))) code++;
  return String(code);
}
