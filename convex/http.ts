import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server.js";
import { internal } from "./_generated/api.js";

const http = httpRouter();

/** JSON body shape uploaded by the local Tally bridge script. */
type BridgeUploadBody = {
  ledgers?: Array<{
    name: string;
    parent: string;
    openingBalance: number;
    gstin?: string;
    pan?: string;
    phone?: string;
    email?: string;
  }>;
  vouchers?: Array<{
    date: string;
    voucherType: string;
    voucherNumber: string;
    partyLedgerName: string;
    narration: string;
    entries: Array<{ ledgerName: string; amount: number }>;
  }>;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Receives ledgers/vouchers pushed by the local Tally bridge script (run on the
 * same machine as TallyPrime). Authenticated via a per-owner bridge token instead
 * of a signed-in session, since the script has no browser/OIDC session.
 */
http.route({
  path: "/tally-bridge/upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = request.headers.get("x-tally-bridge-token");
    if (!token) {
      return jsonResponse({ error: "Missing X-Tally-Bridge-Token header" }, 401);
    }

    const ownerId = await ctx.runQuery(internal.tallyImport.getOwnerByBridgeToken, { token });
    if (!ownerId) {
      return jsonResponse({ error: "Invalid or revoked bridge token" }, 401);
    }

    let body: BridgeUploadBody;
    try {
      body = (await request.json()) as BridgeUploadBody;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const ledgers = body.ledgers ?? [];
    const vouchers = body.vouchers ?? [];
    if (ledgers.length === 0 && vouchers.length === 0) {
      return jsonResponse({ error: "Provide at least one of 'ledgers' or 'vouchers'" }, 400);
    }

    let ledgerResult = { accountsCreated: 0, vendorsCreated: 0, skipped: 0, unmapped: [] as Array<{ name: string; parent: string }> };
    if (ledgers.length > 0) {
      ledgerResult = await ctx.runMutation(internal.tallyImport.applyLedgerImportForOwner, {
        ownerId,
        rows: ledgers,
      });
    }

    // Batch vouchers to respect the per-mutation write limit.
    const BATCH_SIZE = 100;
    const voucherResult = {
      purchaseInvoicesCreated: 0,
      journalEntriesCreated: 0,
      skipped: 0,
      skippedDetails: [] as Array<{ voucherNumber: string; reason: string }>,
    };
    for (let i = 0; i < vouchers.length; i += BATCH_SIZE) {
      const batch = vouchers.slice(i, i + BATCH_SIZE);
      const result = await ctx.runMutation(internal.tallyImport.applyVoucherBatchForOwner, {
        ownerId,
        rows: batch,
      });
      voucherResult.purchaseInvoicesCreated += result.purchaseInvoicesCreated;
      voucherResult.journalEntriesCreated += result.journalEntriesCreated;
      voucherResult.skipped += result.skipped;
      voucherResult.skippedDetails.push(...result.skippedDetails);
    }

    await ctx.runMutation(internal.tallyImport.recordBridgeUpload, { ownerId });

    return jsonResponse({ success: true, ledgers: ledgerResult, vouchers: voucherResult });
  }),
});

export default http;
