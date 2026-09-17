import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { effectiveOwnerId, requireOwnedProject, requireUser } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";
import { isValidPan } from "./lib/validators.ts";
import type { Doc, Id } from "./_generated/dataModel";

export type SubcontractWithRollup = Doc<"subcontracts"> & {
  vendorName: string;
  vendorPan: string | null;
  projectName: string;
  paidAmount: number;
  balance: number;
};

async function rollupSubcontract(
  ctx: Parameters<typeof requireUser>[0],
  subcontract: Doc<"subcontracts">,
): Promise<{ paidAmount: number; balance: number }> {
  const links = await ctx.db
    .query("subcontractInvoices")
    .withIndex("by_subcontract", (q) => q.eq("subcontractId", subcontract._id))
    .collect();

  let paidAmount = 0;
  for (const link of links) {
    const invoice = await ctx.db.get("purchaseInvoices", link.purchaseInvoiceId);
    if (invoice && invoice.status !== "cancelled") {
      paidAmount += invoice.amountPaid;
    }
  }
  return { paidAmount, balance: subcontract.contractValue - paidAmount };
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════

export const listSubcontracts = query({
  args: {
    projectId: v.optional(v.id("projects")),
    vendorId: v.optional(v.id("vendors")),
  },
  handler: async (ctx, args): Promise<SubcontractWithRollup[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    let contracts: Doc<"subcontracts">[];
    if (args.vendorId) {
      contracts = await ctx.db
        .query("subcontracts")
        .withIndex("by_owner_and_vendor", (q) => q.eq("ownerId", ownerId).eq("vendorId", args.vendorId!))
        .collect();
    } else if (args.projectId) {
      contracts = await ctx.db
        .query("subcontracts")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
        .collect();
    } else {
      contracts = await ctx.db
        .query("subcontracts")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .collect();
    }

    const vendorIds = [...new Set(contracts.map((c) => c.vendorId))];
    const vendorMap = new Map<string, { name: string; pan: string | null }>();
    for (const vid of vendorIds) {
      const v = await ctx.db.get("vendors", vid);
      if (v) vendorMap.set(vid, { name: v.name, pan: v.pan && isValidPan(v.pan) ? v.pan : null });
    }
    const projectIds = [...new Set(contracts.map((c) => c.projectId))];
    const projectMap = new Map<string, string>();
    for (const pid of projectIds) {
      const p = await ctx.db.get("projects", pid);
      if (p) projectMap.set(pid, p.name);
    }

    const results: SubcontractWithRollup[] = [];
    for (const c of contracts) {
      const { paidAmount, balance } = await rollupSubcontract(ctx, c);
      results.push({
        ...c,
        vendorName: vendorMap.get(c.vendorId)?.name ?? "Unknown",
        vendorPan: vendorMap.get(c.vendorId)?.pan ?? null,
        projectName: projectMap.get(c.projectId) ?? "Unknown",
        paidAmount,
        balance,
      });
    }
    return results.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const getSubcontract = query({
  args: { subcontractId: v.id("subcontracts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const contract = await ctx.db.get("subcontracts", args.subcontractId);
    if (!contract || contract.ownerId !== ownerId) return null;

    const [vendor, project, links, rollup] = await Promise.all([
      ctx.db.get("vendors", contract.vendorId),
      ctx.db.get("projects", contract.projectId),
      ctx.db
        .query("subcontractInvoices")
        .withIndex("by_subcontract", (q) => q.eq("subcontractId", args.subcontractId))
        .collect(),
      rollupSubcontract(ctx, contract),
    ]);

    const invoices = await Promise.all(
      links.map(async (l) => {
        const invoice = await ctx.db.get("purchaseInvoices", l.purchaseInvoiceId);
        return invoice ? { ...invoice, linkId: l._id } : null;
      }),
    );

    return {
      contract,
      vendor,
      project,
      invoices: invoices.filter(
        (i): i is Doc<"purchaseInvoices"> & { linkId: Id<"subcontractInvoices"> } => i !== null,
      ),
      ...rollup,
    };
  },
});

/** Purchase invoices for a vendor that are not yet linked to any subcontract — candidates to attach. */
export const listUnlinkedInvoicesForVendor = query({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const invoices = await ctx.db
      .query("purchaseInvoices")
      .withIndex("by_owner_and_vendor", (q) => q.eq("ownerId", ownerId).eq("vendorId", args.vendorId))
      .collect();

    const links = await ctx.db
      .query("subcontractInvoices")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    const linkedIds = new Set(links.map((l) => l.purchaseInvoiceId));

    return invoices.filter((i) => i.status !== "cancelled" && !linkedIds.has(i._id));
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const createSubcontract = mutation({
  args: {
    projectId: v.id("projects"),
    vendorId: v.id("vendors"),
    title: v.string(),
    contractValue: v.number(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"subcontracts">> => {
    const user = await requireModuleAccess(ctx, "subcontracts");
    const ownerId = effectiveOwnerId(user);
    await requireOwnedProject(ctx, args.projectId, ownerId);
    const vendor = await ctx.db.get("vendors", args.vendorId);
    if (!vendor || vendor.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Vendor not found" });
    }
    if (!vendor.pan || !isValidPan(vendor.pan)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `A valid PAN is required for the subcontractor before creating a contract. Add a PAN to "${vendor.name}" in Payables first.`,
      });
    }
    return ctx.db.insert("subcontracts", { ownerId, isActive: true, ...args });
  },
});

export const updateSubcontract = mutation({
  args: {
    subcontractId: v.id("subcontracts"),
    title: v.optional(v.string()),
    contractValue: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "subcontracts");
    const ownerId = effectiveOwnerId(user);
    const { subcontractId, ...patch } = args;
    const contract = await ctx.db.get("subcontracts", subcontractId);
    if (!contract || contract.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Subcontract not found" });
    }
    await ctx.db.patch("subcontracts", subcontractId, patch);
  },
});

export const deleteSubcontract = mutation({
  args: { subcontractId: v.id("subcontracts") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "subcontracts");
    const ownerId = effectiveOwnerId(user);
    const contract = await ctx.db.get("subcontracts", args.subcontractId);
    if (!contract || contract.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Subcontract not found" });
    }
    const links = await ctx.db
      .query("subcontractInvoices")
      .withIndex("by_subcontract", (q) => q.eq("subcontractId", args.subcontractId))
      .collect();
    for (const l of links) await ctx.db.delete("subcontractInvoices", l._id);
    await ctx.db.delete("subcontracts", args.subcontractId);
  },
});

export const linkInvoiceToSubcontract = mutation({
  args: {
    subcontractId: v.id("subcontracts"),
    purchaseInvoiceId: v.id("purchaseInvoices"),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "subcontracts");
    const ownerId = effectiveOwnerId(user);
    const contract = await ctx.db.get("subcontracts", args.subcontractId);
    if (!contract || contract.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Subcontract not found" });
    }
    const invoice = await ctx.db.get("purchaseInvoices", args.purchaseInvoiceId);
    if (!invoice || invoice.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Invoice not found" });
    }
    if (invoice.vendorId !== contract.vendorId) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Invoice vendor does not match the subcontract's vendor" });
    }
    const existing = await ctx.db
      .query("subcontractInvoices")
      .withIndex("by_invoice", (q) => q.eq("purchaseInvoiceId", args.purchaseInvoiceId))
      .first();
    if (existing) {
      throw new ConvexError({ code: "CONFLICT", message: "This invoice is already linked to a subcontract" });
    }
    await ctx.db.insert("subcontractInvoices", { ownerId, subcontractId: args.subcontractId, purchaseInvoiceId: args.purchaseInvoiceId });
  },
});

export const unlinkInvoiceFromSubcontract = mutation({
  args: { linkId: v.id("subcontractInvoices") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "subcontracts");
    const ownerId = effectiveOwnerId(user);
    const link = await ctx.db.get("subcontractInvoices", args.linkId);
    if (!link || link.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Link not found" });
    }
    await ctx.db.delete("subcontractInvoices", args.linkId);
  },
});
