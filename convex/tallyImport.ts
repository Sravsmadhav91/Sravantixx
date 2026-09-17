import { ConvexError, v } from "convex/values";
import { XMLParser } from "fast-xml-parser";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server.js";
import type { MutationCtx } from "./_generated/server.js";
import { effectiveOwnerId, requireOwner, requireUser } from "./lib/auth.ts";
import { api } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel";

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

export const getSettings = query({
  args: {},
  handler: async (ctx): Promise<Doc<"tallySettings"> | null> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    return await ctx.db
      .query("tallySettings")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .unique();
  },
});

export const saveGatewayUrl = mutation({
  args: { gatewayUrl: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireOwner(ctx);
    const ownerId = effectiveOwnerId(user);
    const existing = await ctx.db
      .query("tallySettings")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .unique();
    const gatewayUrl = args.gatewayUrl.trim().replace(/\/+$/, "");
    if (existing) {
      await ctx.db.patch("tallySettings", existing._id, { gatewayUrl });
    } else {
      await ctx.db.insert("tallySettings", { ownerId, gatewayUrl });
    }
  },
});

/** Generates (or rotates) the secret token the local bridge script uses to authenticate uploads. */
export const generateBridgeToken = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    const user = await requireOwner(ctx);
    const ownerId = effectiveOwnerId(user);
    const token = `tb_${crypto.randomUUID().replace(/-/g, "")}`;
    const existing = await ctx.db
      .query("tallySettings")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .unique();
    const patch = { bridgeToken: token, bridgeTokenCreatedAt: new Date().toISOString() };
    if (existing) {
      await ctx.db.patch("tallySettings", existing._id, patch);
    } else {
      await ctx.db.insert("tallySettings", { ownerId, ...patch });
    }
    return token;
  },
});

/** Revokes the bridge token so old copies of the bridge script can no longer upload. */
export const revokeBridgeToken = mutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const user = await requireOwner(ctx);
    const ownerId = effectiveOwnerId(user);
    const existing = await ctx.db
      .query("tallySettings")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .unique();
    if (existing) {
      await ctx.db.patch("tallySettings", existing._id, { bridgeToken: undefined });
    }
  },
});

export const recordTestResult = mutation({
  args: {
    gatewayUrl: v.string(),
    status: v.union(v.literal("success"), v.literal("failure")),
    companyName: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireOwner(ctx);
    const ownerId = effectiveOwnerId(user);
    const existing = await ctx.db
      .query("tallySettings")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .unique();
    const patch = {
      lastTestedAt: new Date().toISOString(),
      lastTestStatus: args.status,
      companyName: args.companyName,
      lastTestError: args.error,
    };
    if (existing) {
      await ctx.db.patch("tallySettings", existing._id, patch);
    } else {
      await ctx.db.insert("tallySettings", {
        ownerId,
        gatewayUrl: args.gatewayUrl.trim().replace(/\/+$/, ""),
        ...patch,
      });
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// TALLY XML GATEWAY
// ═══════════════════════════════════════════════════════════════════════════

const xmlParser = new XMLParser({ ignoreAttributes: false, trimValues: true });

/** POSTs a Tally XML request envelope and returns the parsed response. */
export async function tallyRequest(gatewayUrl: string, xmlBody: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: xmlBody,
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new ConvexError({
      code: "EXTERNAL_SERVICE_ERROR",
      message: `Could not reach Tally at ${gatewayUrl}. Make sure Tally is running, the gateway is enabled, and the address is reachable from the internet.`,
      cause: err instanceof Error ? err.message : String(err),
    });
  }
  if (!res.ok) {
    throw new ConvexError({
      code: "EXTERNAL_SERVICE_ERROR",
      message: `Tally responded with an error (HTTP ${res.status})`,
    });
  }
  const text = await res.text();
  if (!text || !text.includes("<ENVELOPE") ) {
    throw new ConvexError({
      code: "EXTERNAL_SERVICE_ERROR",
      message: "Tally did not return a valid response. Check the gateway URL.",
    });
  }
  try {
    return xmlParser.parse(text);
  } catch {
    throw new ConvexError({
      code: "EXTERNAL_SERVICE_ERROR",
      message: "Could not parse Tally's response.",
    });
  }
}

const LIST_OF_COMPANIES_XML = `<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Export</TALLYREQUEST>
  <TYPE>Collection</TYPE>
  <ID>List of Companies</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   </STATICVARIABLES>
   <TDL>
    <TDLMESSAGE>
     <COLLECTION NAME="List of Companies" ISMODIFY="No" ISINITIALIZE="Yes">
      <TYPE>Company</TYPE>
      <NATIVEMETHOD>NAME</NATIVEMETHOD>
     </COLLECTION>
    </TDLMESSAGE>
   </TDL>
  </DESC>
 </BODY>
</ENVELOPE>`;

/** Extracts company names from a "List of Companies" collection export response. */
function extractCompanyNames(parsed: unknown): string[] {
  const companyNodes = findAllTags(parsed, "COMPANY");
  const names: string[] = [];
  for (const node of companyNodes) {
    const name =
      (node["@_NAME"] as string | undefined) ??
      textOf(node.NAME) ??
      undefined;
    if (typeof name === "string" && name.trim()) names.push(name.trim());
  }
  return names;
}

export const testConnection = action({
  args: { gatewayUrl: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; companyName?: string; error?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Please sign in to continue" });
    }
    const gatewayUrl = args.gatewayUrl.trim().replace(/\/+$/, "");

    try {
      const parsed = await tallyRequest(gatewayUrl, LIST_OF_COMPANIES_XML);
      const companies = extractCompanyNames(parsed);
      const companyName = companies[0];
      await ctx.runMutation(api.tallyImport.recordTestResult, {
        gatewayUrl,
        status: "success",
        companyName,
      });
      return { success: true, companyName };
    } catch (err) {
      const message =
        err instanceof ConvexError ? (err.data as { message: string }).message : "Connection failed";
      await ctx.runMutation(api.tallyImport.recordTestResult, {
        gatewayUrl,
        status: "failure",
        error: message,
      });
      return { success: false, error: message };
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// LEDGERS → ACCOUNTS + VENDORS
// ═══════════════════════════════════════════════════════════════════════════

function ledgerCollectionXml(companyName: string): string {
  return `<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <EXPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Collection of Objects</REPORTNAME>
    <STATICVARIABLES>
     <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
     <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
    </STATICVARIABLES>
    <TDL>
     <TDLMESSAGE>
      <COLLECTION NAME="LedgerCollection" ISMODIFY="No">
       <TYPE>Ledger</TYPE>
       <FETCH>NAME,PARENT,OPENINGBALANCE,GSTIN,INCOMETAXNUMBER,LEDGERPHONE,EMAIL</FETCH>
      </COLLECTION>
     </TDLMESSAGE>
    </TDL>
   </REQUESTDESC>
  </EXPORTDATA>
 </BODY>
</ENVELOPE>`;
}

/** Escapes text for safe inclusion inside an XML element (company names can contain & etc.). */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Recursively finds every occurrence of a tag anywhere in a parsed XML tree. */
function findAllTags(obj: unknown, tagName: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const record = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (key === tagName) {
        if (Array.isArray(value)) {
          for (const v of value) if (typeof v === "object" && v !== null) results.push(v as Record<string, unknown>);
        } else if (typeof value === "object" && value !== null) {
          results.push(value as Record<string, unknown>);
        }
      } else {
        visit(value);
      }
    }
  };
  visit(obj);
  return results;
}

/** Reads a text value that fast-xml-parser may return as a string, number, or object with #text. */
function textOf(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("#text" in record) return textOf(record["#text"]);
  }
  return "";
}

export type TallyLedgerRow = {
  name: string;
  parent: string;
  openingBalance: number;
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
};

function extractLedgers(parsed: unknown): TallyLedgerRow[] {
  const nodes = findAllTags(parsed, "LEDGER");
  const rows: TallyLedgerRow[] = [];
  for (const node of nodes) {
    const name = textOf(node.NAME) || textOf((node as Record<string, unknown>)["@_NAME"]);
    if (!name.trim()) continue;
    const openingBalanceRaw = textOf(node.OPENINGBALANCE);
    rows.push({
      name: name.trim(),
      parent: textOf(node.PARENT).trim(),
      openingBalance: parseFloat(openingBalanceRaw.replace(/[^0-9.-]/g, "")) || 0,
      gstin: textOf(node.GSTIN).trim() || undefined,
      pan: textOf(node.INCOMETAXNUMBER).trim() || undefined,
      phone: textOf(node.LEDGERPHONE).trim() || undefined,
      email: textOf(node.EMAIL).trim() || undefined,
    });
  }
  return rows;
}

type MappedGroup = {
  type: "asset" | "liability" | "income" | "expense" | "equity";
  group:
    | "bank_and_cash"
    | "receivables"
    | "current_assets"
    | "fixed_assets"
    | "payables"
    | "current_liabilities"
    | "loans"
    | "sales_income"
    | "other_income"
    | "direct_expenses"
    | "indirect_expenses"
    | "finance_charges"
    | "capital"
    | "reserves";
  isVendor: boolean;
  unmapped: boolean;
};

/** Heuristic mapping from a Tally ledger PARENT group name to our chart-of-accounts taxonomy. */
export function mapTallyGroup(parent: string): MappedGroup {
  const p = parent.toLowerCase();
  const m = (type: MappedGroup["type"], group: MappedGroup["group"], isVendor = false): MappedGroup => ({
    type,
    group,
    isVendor,
    unmapped: false,
  });

  if (p.includes("sundry creditor")) return m("liability", "payables", true);
  if (p.includes("sundry debtor")) return m("asset", "receivables");
  if (p.includes("bank od") || p.includes("bank account") || p.includes("cash-in-hand") || p.includes("cash in hand"))
    return m("asset", "bank_and_cash");
  if (p.includes("loans (liability)") || p.includes("secured loan") || p.includes("unsecured loan"))
    return m("liability", "loans");
  if (p.includes("duties & taxes") || p.includes("duties and taxes") || p.includes("provisions"))
    return m("liability", "current_liabilities");
  if (p.includes("current liabilities")) return m("liability", "current_liabilities");
  if (p.includes("loans & advances") || p.includes("loans and advances") || p.includes("deposits (asset)"))
    return m("asset", "current_assets");
  if (p.includes("stock-in-hand") || p.includes("stock in hand") || p.includes("investments") || p.includes("current assets"))
    return m("asset", "current_assets");
  if (p.includes("fixed assets")) return m("asset", "fixed_assets");
  if (p.includes("capital account")) return m("equity", "capital");
  if (p.includes("reserves")) return m("equity", "reserves");
  if (p.includes("sales account")) return m("income", "sales_income");
  if (p.includes("direct income") || p.includes("indirect income")) return m("income", "other_income");
  if (p.includes("purchase account")) return m("expense", "direct_expenses");
  if (p.includes("direct expense")) return m("expense", "direct_expenses");
  if (p.includes("indirect expense") || p.includes("misc. expenses") || p.includes("miscellaneous expenses"))
    return m("expense", "indirect_expenses");

  // Unmapped — safe default bucket, flagged for manual review
  return { type: "expense", group: "indirect_expenses", isVendor: false, unmapped: true };
}

/** Finds the next unused account code within a type-specific reserved band (19xx/29xx/39xx/49xx/59xx) to avoid clashing with default seeded codes. */
function nextAccountCode(type: MappedGroup["type"], usedCodes: Set<string>): string {
  const bandStart: Record<MappedGroup["type"], number> = {
    asset: 1900,
    liability: 2900,
    income: 3900,
    expense: 4900,
    equity: 5900,
  };
  let code = bandStart[type];
  while (usedCodes.has(String(code))) code++;
  usedCodes.add(String(code));
  return String(code);
}

export type LedgerImportResult = {
  accountsCreated: number;
  vendorsCreated: number;
  skipped: number;
  unmapped: Array<{ name: string; parent: string }>;
};

async function runLedgerImport(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  rows: TallyLedgerRow[],
): Promise<LedgerImportResult> {
  const existingAccounts = await ctx.db
    .query("accounts")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  const existingVendors = await ctx.db
    .query("vendors")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();

  const accountNameSet = new Set(existingAccounts.map((a) => a.name.trim().toLowerCase()));
  const vendorNameSet = new Set(existingVendors.map((v) => v.name.trim().toLowerCase()));
  const usedCodes = new Set(existingAccounts.map((a) => a.code));

  let accountsCreated = 0;
  let vendorsCreated = 0;
  let skipped = 0;
  const unmapped: Array<{ name: string; parent: string }> = [];

  for (const row of rows) {
    const nameKey = row.name.trim().toLowerCase();
    const mapped = mapTallyGroup(row.parent);
    if (mapped.unmapped) unmapped.push({ name: row.name, parent: row.parent });

    if (mapped.isVendor) {
      if (vendorNameSet.has(nameKey)) {
        skipped++;
        continue;
      }
      await ctx.db.insert("vendors", {
        ownerId,
        name: row.name,
        category: "other",
        gstin: row.gstin,
        pan: row.pan,
        phone: row.phone,
        email: row.email,
        isActive: true,
        notes: row.parent ? `Imported from Tally — group: ${row.parent}` : "Imported from Tally",
      });
      vendorNameSet.add(nameKey);
      vendorsCreated++;
      continue;
    }

    if (accountNameSet.has(nameKey)) {
      skipped++;
      continue;
    }
    const code = nextAccountCode(mapped.type, usedCodes);
    await ctx.db.insert("accounts", {
      ownerId,
      code,
      name: row.name,
      type: mapped.type,
      group: mapped.group,
      openingBalance: row.openingBalance || undefined,
      openingBalanceDate: row.openingBalance ? new Date().toISOString().slice(0, 10) : undefined,
      isSystem: false,
      isActive: true,
      description: `Imported from Tally — group: ${row.parent || "Primary"}`,
    });
    accountNameSet.add(nameKey);
    accountsCreated++;
  }

  return { accountsCreated, vendorsCreated, skipped, unmapped };
}

export const applyLedgerImport = mutation({
  args: {
    rows: v.array(
      v.object({
        name: v.string(),
        parent: v.string(),
        openingBalance: v.number(),
        gstin: v.optional(v.string()),
        pan: v.optional(v.string()),
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<LedgerImportResult> => {
    const user = await requireOwner(ctx);
    const ownerId = effectiveOwnerId(user);
    return await runLedgerImport(ctx, ownerId, args.rows);
  },
});

/** Fetches the list of open companies from Tally and returns the first (current) company's name. */
async function getCurrentCompanyName(gatewayUrl: string): Promise<string> {
  const parsed = await tallyRequest(gatewayUrl, LIST_OF_COMPANIES_XML);
  const companies = extractCompanyNames(parsed);
  if (companies.length === 0) {
    throw new ConvexError({
      code: "EXTERNAL_SERVICE_ERROR",
      message: "No company is open in TallyPrime. Open your company in Tally and try again.",
    });
  }
  return companies[0];
}

export const importLedgers = action({
  args: {},
  handler: async (ctx): Promise<LedgerImportResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Please sign in to continue" });
    }
    const settings = await ctx.runQuery(api.tallyImport.getSettings, {});
    if (!settings?.gatewayUrl) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Set up the Tally gateway URL first" });
    }

    const companyName = await getCurrentCompanyName(settings.gatewayUrl);
    const parsed = await tallyRequest(settings.gatewayUrl, ledgerCollectionXml(companyName));
    const rows = extractLedgers(parsed);
    if (rows.length === 0) {
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: "No ledgers were returned by Tally. Ensure the company is open in TallyPrime.",
      });
    }

    return await ctx.runMutation(api.tallyImport.applyLedgerImport, { rows });
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// VOUCHERS → JOURNAL ENTRIES + PURCHASE INVOICES
// ═══════════════════════════════════════════════════════════════════════════

/** Converts a JS date (YYYY-MM-DD) to Tally's YYYYMMDD static-variable format. */
function toTallyDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

/** Converts Tally's YYYYMMDD date format to ISO YYYY-MM-DD. */
function fromTallyDate(tallyDate: string): string {
  const d = tallyDate.trim();
  if (d.length !== 8) return new Date().toISOString().slice(0, 10);
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function voucherCollectionXml(fromDate: string, toDate: string, companyName: string): string {
  return `<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <EXPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Collection of Objects</REPORTNAME>
    <STATICVARIABLES>
     <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
     <SVFROMDATE>${toTallyDate(fromDate)}</SVFROMDATE>
     <SVTODATE>${toTallyDate(toDate)}</SVTODATE>
     <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
    </STATICVARIABLES>
    <TDL>
     <TDLMESSAGE>
      <COLLECTION NAME="VoucherCollection" ISMODIFY="No">
       <TYPE>Voucher</TYPE>
       <FETCH>DATE,VOUCHERTYPENAME,VOUCHERNUMBER,PARTYLEDGERNAME,NARRATION,ALLLEDGERENTRIES.LIST</FETCH>
      </COLLECTION>
     </TDLMESSAGE>
    </TDL>
   </REQUESTDESC>
  </EXPORTDATA>
 </BODY>
</ENVELOPE>`;
}

export type TallyVoucherLedgerEntry = {
  ledgerName: string;
  amount: number; // Tally sign convention: negative = debit, positive = credit
};

export type TallyVoucherRow = {
  date: string; // ISO YYYY-MM-DD
  voucherType: string;
  voucherNumber: string;
  partyLedgerName: string;
  narration: string;
  entries: TallyVoucherLedgerEntry[];
};

function extractVouchers(parsed: unknown): TallyVoucherRow[] {
  const nodes = findAllTags(parsed, "VOUCHER");
  const rows: TallyVoucherRow[] = [];
  for (const node of nodes) {
    const dateRaw = textOf(node.DATE);
    if (!dateRaw.trim()) continue;

    const entriesRaw = (node as Record<string, unknown>)["ALLLEDGERENTRIES.LIST"];
    const entryNodes = Array.isArray(entriesRaw) ? entriesRaw : entriesRaw ? [entriesRaw] : [];
    const entries: TallyVoucherLedgerEntry[] = [];
    for (const e of entryNodes) {
      if (typeof e !== "object" || e === null) continue;
      const record = e as Record<string, unknown>;
      const ledgerName = textOf(record.LEDGERNAME).trim();
      const amountRaw = textOf(record.AMOUNT);
      const amount = parseFloat(amountRaw.replace(/[^0-9.-]/g, "")) || 0;
      if (!ledgerName) continue;
      entries.push({ ledgerName, amount });
    }
    if (entries.length === 0) continue;

    rows.push({
      date: fromTallyDate(dateRaw),
      voucherType: textOf(node.VOUCHERTYPENAME).trim(),
      voucherNumber: textOf(node.VOUCHERNUMBER).trim(),
      partyLedgerName: textOf(node.PARTYLEDGERNAME).trim(),
      narration: textOf(node.NARRATION).trim(),
      entries,
    });
  }
  return rows;
}

export type VoucherImportResult = {
  purchaseInvoicesCreated: number;
  journalEntriesCreated: number;
  skipped: number;
  skippedDetails: Array<{ voucherNumber: string; reason: string }>;
};

async function runVoucherBatch(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  rows: TallyVoucherRow[],
): Promise<VoucherImportResult> {
  const accounts = await ctx.db
    .query("accounts")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  const accountByName = new Map(accounts.map((a) => [a.name.trim().toLowerCase(), a]));

  const vendors = await ctx.db
    .query("vendors")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  const vendorByName = new Map(vendors.map((v) => [v.name.trim().toLowerCase(), v]));

  // Existing internal refs / entry numbers to dedupe re-runs
  const existingInvoiceRefs = new Set(
    (
      await ctx.db
        .query("purchaseInvoices")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .collect()
    ).map((i) => `${i.vendorId}|||${i.invoiceNumber.trim().toLowerCase()}`),
  );
  const existingEntryRefs = new Set(
    (
      await ctx.db
        .query("journalEntries")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .collect()
    )
      .filter((e) => e.source === "tally_import")
      .map((e) => e.sourceId ?? ""),
  );

  let purchaseInvoicesCreated = 0;
  let journalEntriesCreated = 0;
  let skipped = 0;
  const skippedDetails: Array<{ voucherNumber: string; reason: string }> = [];

  const getNextInvoiceRef = async (): Promise<string> => {
    const last = await ctx.db
      .query("purchaseInvoices")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .first();
    const year = new Date().getFullYear();
    if (!last) return `PI-${year}-001`;
    const match = last.internalRef.match(/PI-\d{4}-(\d+)$/);
    const seq = match ? parseInt(match[1], 10) + 1 : 1;
    return `PI-${year}-${String(seq).padStart(3, "0")}`;
  };
  const getNextEntryNumber = async (): Promise<string> => {
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
  };

  for (const row of rows) {
    const sourceId = `${row.voucherType}|||${row.voucherNumber}|||${row.date}`;
    const isPurchase = row.voucherType.toLowerCase().includes("purchase");

    if (isPurchase) {
      const vendorKey = row.partyLedgerName.trim().toLowerCase();
      const vendor = vendorByName.get(vendorKey);
      if (!vendor) {
        skipped++;
        skippedDetails.push({
          voucherNumber: row.voucherNumber || row.date,
          reason: `Vendor "${row.partyLedgerName}" not found — import ledgers first`,
        });
        continue;
      }
      const dedupeKey = `${vendor._id}|||${row.voucherNumber.trim().toLowerCase()}`;
      if (existingInvoiceRefs.has(dedupeKey)) {
        skipped++;
        continue;
      }

      const vendorEntry = row.entries.find((e) => e.ledgerName.trim().toLowerCase() === vendorKey);
      const lineEntries = row.entries.filter((e) => e.ledgerName.trim().toLowerCase() !== vendorKey);
      if (lineEntries.length === 0) {
        skipped++;
        skippedDetails.push({ voucherNumber: row.voucherNumber || row.date, reason: "No line items found" });
        continue;
      }

      const lines = lineEntries.map((e) => ({
        description: e.ledgerName,
        quantity: 1,
        rate: Math.abs(e.amount),
        amount: Math.abs(e.amount),
        accountId: accountByName.get(e.ledgerName.trim().toLowerCase())?._id,
      }));
      const subtotal = lines.reduce((s, l) => s + l.amount, 0);
      const total = vendorEntry ? Math.abs(vendorEntry.amount) : subtotal;
      const internalRef = await getNextInvoiceRef();

      const invoiceId = await ctx.db.insert("purchaseInvoices", {
        ownerId,
        vendorId: vendor._id,
        invoiceNumber: row.voucherNumber || internalRef,
        internalRef,
        date: row.date,
        status: "draft",
        subtotal,
        cgst: 0,
        sgst: 0,
        igst: 0,
        tds: 0,
        total,
        amountPaid: 0,
        narration: row.narration || "Imported from Tally",
      });
      for (const line of lines) {
        await ctx.db.insert("purchaseInvoiceLines", { ownerId, purchaseInvoiceId: invoiceId, ...line });
      }
      existingInvoiceRefs.add(dedupeKey);
      purchaseInvoicesCreated++;
      continue;
    }

    // Generic voucher → journal entry
    if (existingEntryRefs.has(sourceId)) {
      skipped++;
      continue;
    }

    const jeLines: Array<{ accountId: Doc<"accounts">["_id"]; side: "debit" | "credit"; amount: number; narration?: string }> = [];
    let unresolvedLedger: string | null = null;
    for (const e of row.entries) {
      const account = accountByName.get(e.ledgerName.trim().toLowerCase());
      if (!account) {
        unresolvedLedger = e.ledgerName;
        break;
      }
      if (Math.abs(e.amount) < 0.005) continue;
      jeLines.push({
        accountId: account._id,
        side: e.amount < 0 ? "debit" : "credit",
        amount: Math.abs(e.amount),
      });
    }
    if (unresolvedLedger) {
      skipped++;
      skippedDetails.push({
        voucherNumber: row.voucherNumber || row.date,
        reason: `Ledger "${unresolvedLedger}" not found — import ledgers first`,
      });
      continue;
    }
    if (jeLines.length < 2) {
      skipped++;
      skippedDetails.push({ voucherNumber: row.voucherNumber || row.date, reason: "Fewer than 2 usable lines" });
      continue;
    }

    const totalDebit = jeLines.filter((l) => l.side === "debit").reduce((s, l) => s + l.amount, 0);
    const totalCredit = jeLines.filter((l) => l.side === "credit").reduce((s, l) => s + l.amount, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      skipped++;
      skippedDetails.push({
        voucherNumber: row.voucherNumber || row.date,
        reason: `Unbalanced: Dr ${totalDebit.toFixed(2)} vs Cr ${totalCredit.toFixed(2)}`,
      });
      continue;
    }

    const entryNumber = await getNextEntryNumber();
    const jeId = await ctx.db.insert("journalEntries", {
      ownerId,
      entryNumber,
      date: row.date,
      narration: row.narration || `${row.voucherType} ${row.voucherNumber}`.trim() || "Imported from Tally",
      status: "posted",
      source: "tally_import",
      sourceId,
      reference: row.voucherNumber || undefined,
      totalAmount: totalDebit,
    });
    for (const line of jeLines) {
      await ctx.db.insert("journalLines", { ownerId, journalEntryId: jeId, ...line });
    }
    existingEntryRefs.add(sourceId);
    journalEntriesCreated++;
  }

  return { purchaseInvoicesCreated, journalEntriesCreated, skipped, skippedDetails };
}

/** Applies one batch of already-fetched voucher rows. Called repeatedly by the action to respect per-mutation write limits. */
export const applyVoucherBatch = mutation({
  args: {
    rows: v.array(
      v.object({
        date: v.string(),
        voucherType: v.string(),
        voucherNumber: v.string(),
        partyLedgerName: v.string(),
        narration: v.string(),
        entries: v.array(v.object({ ledgerName: v.string(), amount: v.number() })),
      }),
    ),
  },
  handler: async (ctx, args): Promise<VoucherImportResult> => {
    const user = await requireOwner(ctx);
    const ownerId = effectiveOwnerId(user);
    return await runVoucherBatch(ctx, ownerId, args.rows);
  },
});

export const importVouchers = action({
  args: { fromDate: v.string(), toDate: v.string() },
  handler: async (ctx, args): Promise<VoucherImportResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Please sign in to continue" });
    }
    const settings = await ctx.runQuery(api.tallyImport.getSettings, {});
    if (!settings?.gatewayUrl) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Set up the Tally gateway URL first" });
    }

    const companyName = await getCurrentCompanyName(settings.gatewayUrl);
    const parsed = await tallyRequest(settings.gatewayUrl, voucherCollectionXml(args.fromDate, args.toDate, companyName));
    const rows = extractVouchers(parsed);
    if (rows.length === 0) {
      return { purchaseInvoicesCreated: 0, journalEntriesCreated: 0, skipped: 0, skippedDetails: [] };
    }

    // Batch through mutations to stay well within the per-mutation write limit.
    const BATCH_SIZE = 100;
    const totals: VoucherImportResult = {
      purchaseInvoicesCreated: 0,
      journalEntriesCreated: 0,
      skipped: 0,
      skippedDetails: [],
    };
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const result = await ctx.runMutation(api.tallyImport.applyVoucherBatch, { rows: batch });
      totals.purchaseInvoicesCreated += result.purchaseInvoicesCreated;
      totals.journalEntriesCreated += result.journalEntriesCreated;
      totals.skipped += result.skipped;
      totals.skippedDetails.push(...result.skippedDetails);
    }
    return totals;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// LOCAL BRIDGE UPLOAD (token-authenticated, called from convex/http.ts)
// ═══════════════════════════════════════════════════════════════════════════

const ledgerRowValidator = v.object({
  name: v.string(),
  parent: v.string(),
  openingBalance: v.number(),
  gstin: v.optional(v.string()),
  pan: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
});

const voucherRowValidator = v.object({
  date: v.string(),
  voucherType: v.string(),
  voucherNumber: v.string(),
  partyLedgerName: v.string(),
  narration: v.string(),
  entries: v.array(v.object({ ledgerName: v.string(), amount: v.number() })),
});

/** Looks up the owner for a bridge token. Used by the HTTP action to authenticate uploads. */
export const getOwnerByBridgeToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<Id<"users"> | null> => {
    const settings = await ctx.db
      .query("tallySettings")
      .withIndex("by_bridge_token", (q) => q.eq("bridgeToken", args.token))
      .unique();
    return settings?.ownerId ?? null;
  },
});

export const recordBridgeUpload = internalMutation({
  args: { ownerId: v.id("users") },
  handler: async (ctx, args): Promise<void> => {
    const existing = await ctx.db
      .query("tallySettings")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .unique();
    if (existing) {
      await ctx.db.patch("tallySettings", existing._id, { bridgeLastUploadAt: new Date().toISOString() });
    }
  },
});

/** Applies a batch of ledgers uploaded by the local bridge script (token pre-verified by the HTTP action). */
export const applyLedgerImportForOwner = internalMutation({
  args: { ownerId: v.id("users"), rows: v.array(ledgerRowValidator) },
  handler: async (ctx, args): Promise<LedgerImportResult> => {
    return await runLedgerImport(ctx, args.ownerId, args.rows);
  },
});

/** Applies a batch of vouchers uploaded by the local bridge script (token pre-verified by the HTTP action). */
export const applyVoucherBatchForOwner = internalMutation({
  args: { ownerId: v.id("users"), rows: v.array(voucherRowValidator) },
  handler: async (ctx, args): Promise<VoucherImportResult> => {
    return await runVoucherBatch(ctx, args.ownerId, args.rows);
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// XML FILE IMPORT (user exports an XML file from Tally and uploads it here —
// no live connection to Tally needed at all)
// ═══════════════════════════════════════════════════════════════════════════

export const importLedgersFromXmlFile = action({
  args: { xml: v.string() },
  handler: async (ctx, args): Promise<LedgerImportResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Please sign in to continue" });
    }
    if (/<DSPVCH(DATE|LEDACCOUNT|TYPE)/i.test(args.xml)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          "This file was exported in Tally's \"report\" XML format, which doesn't include full ledger detail. Re-export using: List of Ledgers → Alt+E (Export) → Current → press C (Configure) → set \"File Format\" to \"XML (Data Interchange)\" → Export. Then upload that file.",
      });
    }
    let parsed: unknown;
    try {
      parsed = xmlParser.parse(args.xml);
    } catch {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Could not parse this file as XML" });
    }
    const rows = extractLedgers(parsed);
    if (rows.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "No ledgers were found in this file. Make sure you exported the Chart of Accounts / List of Ledgers as XML from Tally.",
      });
    }
    return await ctx.runMutation(api.tallyImport.applyLedgerImport, { rows });
  },
});

export const importVouchersFromXmlFile = action({
  args: { xml: v.string() },
  handler: async (ctx, args): Promise<VoucherImportResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Please sign in to continue" });
    }
    // TallyPrime's Day Book export offers two very different XML flavors. The default
    // "report" export uses flat DSPVCH* tags with only one side of each entry — not enough
    // to reconstruct a balanced journal entry. Detect it early and point the user to the
    // correct export option instead of failing with a generic "no vouchers found" error.
    if (/<DSPVCH(DATE|LEDACCOUNT|TYPE)/i.test(args.xml)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          "This file was exported in Tally's \"report\" XML format, which doesn't include full transaction detail. Re-export using: Day Book → Alt+E (Export) → Current → press C (Configure) → set \"File Format\" to \"XML (Data Interchange)\" → Export. Then upload that file.",
      });
    }
    let parsed: unknown;
    try {
      parsed = xmlParser.parse(args.xml);
    } catch {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Could not parse this file as XML" });
    }
    const rows = extractVouchers(parsed);
    if (rows.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "No vouchers were found in this file. Make sure you exported the Day Book as XML (Data Interchange) from Tally for the period you want to import.",
      });
    }

    const BATCH_SIZE = 100;
    const totals: VoucherImportResult = {
      purchaseInvoicesCreated: 0,
      journalEntriesCreated: 0,
      skipped: 0,
      skippedDetails: [],
    };
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const result = await ctx.runMutation(api.tallyImport.applyVoucherBatch, { rows: batch });
      totals.purchaseInvoicesCreated += result.purchaseInvoicesCreated;
      totals.journalEntriesCreated += result.journalEntriesCreated;
      totals.skipped += result.skipped;
      totals.skippedDetails.push(...result.skippedDetails);
    }
    return totals;
  },
});
