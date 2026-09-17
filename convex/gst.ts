import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { effectiveOwnerId, requireOwner, requireUser } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";
import type { Doc, Id } from "./_generated/dataModel";

// ── GST Settings ────────────────────────────────────────────────────────────

export const getGstSettings = query({
  args: {},
  handler: async (ctx): Promise<Doc<"gstSettings"> | null> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    return await ctx.db
      .query("gstSettings")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .first();
  },
});

export const saveGstSettings = mutation({
  args: {
    gstin: v.optional(v.string()),
    legalName: v.optional(v.string()),
    tradeName: v.optional(v.string()),
    stateName: v.optional(v.string()),
    stateCode: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireModuleAccess(ctx, "gst");
    const existing = await ctx.db
      .query("gstSettings")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .first();
    if (existing) {
      await ctx.db.patch("gstSettings", existing._id, args);
    } else {
      await ctx.db.insert("gstSettings", { ownerId: user._id, ...args });
    }
  },
});

// ── Shared helpers ──────────────────────────────────────────────────────────

/** B2C large-invoice threshold per GST rules (₹2.5 lakh place-of-supply invoices need state-wise reporting). */
const B2C_LARGE_THRESHOLD = 250000;

function isIntraState(companyStateCode: string | undefined, buyerState: string | undefined, buyerStateCode: string | undefined): boolean {
  if (!companyStateCode || !buyerStateCode) return true; // default to intra-state (CGST+SGST) when unknown
  return companyStateCode === buyerStateCode;
  // buyerState is unused directly but kept for readability at call sites
  void buyerState;
}

// ── GSTR-1: Outward supplies (from unit bookings) ───────────────────────────

export type Gstr1B2BRow = {
  bookingId: Id<"bookings">;
  invoiceNumber: string;
  invoiceDate: string;
  buyerName: string;
  buyerGstin: string;
  placeOfSupply: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  total: number;
};

export type AdvanceReceivedRow = {
  bookingId: Id<"bookings">;
  buyerName: string;
  placeOfSupply: string;
  amountReceived: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
};

export type Gstr1Summary = {
  b2b: Gstr1B2BRow[];
  b2cLarge: Gstr1B2BRow[];
  b2cSmallTaxableValue: number;
  b2cSmallCgst: number;
  b2cSmallSgst: number;
  b2cSmallIgst: number;
  hsnSummary: { sacCode: string; description: string; taxableValue: number; cgst: number; sgst: number; igst: number; total: number }[];
  totalTaxableValue: number;
  totalTax: number;
  totalInvoices: number;
  // ── Table 11A: Advances received against units whose sale deed is not yet registered ──
  advancesReceived: AdvanceReceivedRow[];
  advancesReceivedTaxableValue: number;
  advancesReceivedCgst: number;
  advancesReceivedSgst: number;
  advancesReceivedIgst: number;
};

export const getGstr1Summary = query({
  args: { fromDate: v.string(), toDate: v.string() },
  handler: async (ctx, args): Promise<Gstr1Summary> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    const [settings, bookings, buyers, units, projects, receipts] = await Promise.all([
      ctx.db.query("gstSettings").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).first(),
      ctx.db.query("bookings").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("buyers").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("units").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("projects").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("receipts").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
    ]);

    const buyerMap = new Map(buyers.map((b) => [b._id, b]));
    const unitMap = new Map(units.map((u) => [u._id, u]));
    const projectMap = new Map(projects.map((p) => [p._id, p]));

    // A booking's sale deed is "registered" once registrationDate is set and
    // falls on/before the given date — only then is it reported as a regular
    // outward supply. Until then, GST on collected amounts is an advance.
    const isRegisteredBy = (b: Doc<"bookings">, date: string) =>
      !!b.registrationDate && b.registrationDate.slice(0, 10) <= date;

    // ── Regular sales: booking's registration falls within this period ──────
    const relevant = bookings.filter(
      (b) =>
        b.status === "active" &&
        (b.gstAmount ?? 0) > 0 &&
        b.registrationDate &&
        b.registrationDate.slice(0, 10) >= args.fromDate &&
        b.registrationDate.slice(0, 10) <= args.toDate,
    );

    const b2b: Gstr1B2BRow[] = [];
    const b2cLarge: Gstr1B2BRow[] = [];
    let b2cSmallTaxableValue = 0;
    let b2cSmallCgst = 0;
    let b2cSmallSgst = 0;
    let b2cSmallIgst = 0;

    for (const booking of relevant) {
      const buyer = buyerMap.get(booking.buyerId);
      const unit = unitMap.get(booking.unitId);
      const project = unit ? projectMap.get(unit.projectId) : undefined;
      const taxableValue = booking.agreementValue;
      const totalTax = booking.gstAmount ?? 0;
      const intraState = isIntraState(settings?.stateCode, buyer?.state, undefined);
      const igst = intraState ? 0 : totalTax;
      const cgst = intraState ? totalTax / 2 : 0;
      const sgst = intraState ? totalTax / 2 : 0;

      const row: Gstr1B2BRow = {
        bookingId: booking._id,
        invoiceNumber: `BKG-${booking._id.slice(-6).toUpperCase()}`,
        invoiceDate: booking.registrationDate!.slice(0, 10),
        buyerName: buyer?.name ?? "—",
        buyerGstin: buyer?.gstin ?? "",
        placeOfSupply: buyer?.state ?? project?.city ?? "—",
        taxableValue,
        igst,
        cgst,
        sgst,
        total: taxableValue + totalTax,
      };

      if (buyer?.gstin) {
        b2b.push(row);
      } else if (taxableValue > B2C_LARGE_THRESHOLD) {
        b2cLarge.push(row);
      } else {
        b2cSmallTaxableValue += taxableValue;
        b2cSmallCgst += cgst;
        b2cSmallSgst += sgst;
        b2cSmallIgst += igst;
      }
    }

    // ── Table 11A: Advances received against units not yet registered ───────
    // For every active, taxable booking whose sale deed is not registered by
    // the end of this period, tax the receipts actually collected in this
    // period, apportioned using the booking's own GST rate.
    const receiptsByBooking = new Map<Id<"bookings">, Doc<"receipts">[]>();
    for (const r of receipts) {
      const list = receiptsByBooking.get(r.bookingId) ?? [];
      list.push(r);
      receiptsByBooking.set(r.bookingId, list);
    }

    const advancesReceived: AdvanceReceivedRow[] = [];
    let advancesReceivedTaxableValue = 0;
    let advancesReceivedCgst = 0;
    let advancesReceivedSgst = 0;
    let advancesReceivedIgst = 0;

    for (const booking of bookings) {
      if (booking.status !== "active") continue;
      if ((booking.gstAmount ?? 0) <= 0) continue;
      if (isRegisteredBy(booking, args.toDate)) continue; // reported as a sale instead

      const bookingReceipts = receiptsByBooking.get(booking._id) ?? [];
      const amountReceived = bookingReceipts
        .filter((r) => {
          const d = r.paymentDate.slice(0, 10);
          return d >= args.fromDate && d <= args.toDate;
        })
        .reduce((s, r) => s + r.amount, 0);
      if (amountReceived <= 0) continue;

      const taxRatio = booking.agreementValue > 0 ? (booking.gstAmount ?? 0) / booking.agreementValue : 0;
      const taxableValue = amountReceived;
      const totalTax = Math.round(taxableValue * taxRatio * 100) / 100;
      const buyer = buyerMap.get(booking.buyerId);
      const unit = unitMap.get(booking.unitId);
      const project = unit ? projectMap.get(unit.projectId) : undefined;
      const intraState = isIntraState(settings?.stateCode, buyer?.state, undefined);
      const igst = intraState ? 0 : totalTax;
      const cgst = intraState ? totalTax / 2 : 0;
      const sgst = intraState ? totalTax / 2 : 0;

      advancesReceived.push({
        bookingId: booking._id,
        buyerName: buyer?.name ?? "—",
        placeOfSupply: buyer?.state ?? project?.city ?? "—",
        amountReceived,
        taxableValue,
        igst,
        cgst,
        sgst,
      });
      advancesReceivedTaxableValue += taxableValue;
      advancesReceivedCgst += cgst;
      advancesReceivedSgst += sgst;
      advancesReceivedIgst += igst;
    }

    const allRows = [...b2b, ...b2cLarge];
    const hsnTaxable = allRows.reduce((s, r) => s + r.taxableValue, 0) + b2cSmallTaxableValue;
    const hsnCgst = allRows.reduce((s, r) => s + r.cgst, 0) + b2cSmallCgst;
    const hsnSgst = allRows.reduce((s, r) => s + r.sgst, 0) + b2cSmallSgst;
    const hsnIgst = allRows.reduce((s, r) => s + r.igst, 0) + b2cSmallIgst;

    return {
      b2b,
      b2cLarge,
      b2cSmallTaxableValue,
      b2cSmallCgst,
      b2cSmallSgst,
      b2cSmallIgst,
      hsnSummary:
        hsnTaxable > 0
          ? [
              {
                sacCode: "9954",
                description: "Construction services of buildings",
                taxableValue: hsnTaxable,
                cgst: hsnCgst,
                sgst: hsnSgst,
                igst: hsnIgst,
                total: hsnTaxable + hsnCgst + hsnSgst + hsnIgst,
              },
            ]
          : [],
      totalTaxableValue: hsnTaxable,
      totalTax: hsnCgst + hsnSgst + hsnIgst,
      totalInvoices: relevant.length + advancesReceived.length,
      advancesReceived,
      advancesReceivedTaxableValue,
      advancesReceivedCgst,
      advancesReceivedSgst,
      advancesReceivedIgst,
    };
  },
});

// ── GSTR-3B: Summary return (outward tax liability vs input tax credit) ────

export type Gstr3bSummary = {
  outwardTaxableValue: number;
  outwardCgst: number;
  outwardSgst: number;
  outwardIgst: number;
  itcCgst: number;
  itcSgst: number;
  itcIgst: number;
  itcInvoiceCount: number;
  netCgstPayable: number;
  netSgstPayable: number;
  netIgstPayable: number;
  netTaxPayable: number;
};

export const getGstr3bSummary = query({
  args: { fromDate: v.string(), toDate: v.string() },
  handler: async (ctx, args): Promise<Gstr3bSummary> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    const [settings, bookings, buyers, purchaseInvoices, receipts] = await Promise.all([
      ctx.db.query("gstSettings").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).first(),
      ctx.db.query("bookings").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("buyers").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("purchaseInvoices").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("receipts").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
    ]);

    const buyerMap = new Map(buyers.map((b) => [b._id, b]));

    let outwardTaxableValue = 0;
    let outwardCgst = 0;
    let outwardSgst = 0;
    let outwardIgst = 0;

    // Regular sales — reported in the period the sale deed is registered.
    for (const booking of bookings) {
      if (booking.status !== "active") continue;
      if ((booking.gstAmount ?? 0) <= 0) continue;
      if (!booking.registrationDate) continue;
      const dateOnly = booking.registrationDate.slice(0, 10);
      if (dateOnly < args.fromDate || dateOnly > args.toDate) continue;

      const buyer = buyerMap.get(booking.buyerId);
      const intraState = isIntraState(settings?.stateCode, buyer?.state, undefined);
      const totalTax = booking.gstAmount ?? 0;
      outwardTaxableValue += booking.agreementValue;
      if (intraState) {
        outwardCgst += totalTax / 2;
        outwardSgst += totalTax / 2;
      } else {
        outwardIgst += totalTax;
      }
    }

    // Advances received — receipts collected in this period against bookings
    // whose sale deed is not yet registered by the period end.
    const receiptsByBooking = new Map<Id<"bookings">, Doc<"receipts">[]>();
    for (const r of receipts) {
      const list = receiptsByBooking.get(r.bookingId) ?? [];
      list.push(r);
      receiptsByBooking.set(r.bookingId, list);
    }
    for (const booking of bookings) {
      if (booking.status !== "active") continue;
      if ((booking.gstAmount ?? 0) <= 0) continue;
      if (booking.registrationDate && booking.registrationDate.slice(0, 10) <= args.toDate) continue;

      const amountReceived = (receiptsByBooking.get(booking._id) ?? [])
        .filter((r) => {
          const d = r.paymentDate.slice(0, 10);
          return d >= args.fromDate && d <= args.toDate;
        })
        .reduce((s, r) => s + r.amount, 0);
      if (amountReceived <= 0) continue;

      const taxRatio = booking.agreementValue > 0 ? (booking.gstAmount ?? 0) / booking.agreementValue : 0;
      const totalTax = Math.round(amountReceived * taxRatio * 100) / 100;
      const buyer = buyerMap.get(booking.buyerId);
      const intraState = isIntraState(settings?.stateCode, buyer?.state, undefined);
      outwardTaxableValue += amountReceived;
      if (intraState) {
        outwardCgst += totalTax / 2;
        outwardSgst += totalTax / 2;
      } else {
        outwardIgst += totalTax;
      }
    }

    let itcCgst = 0;
    let itcSgst = 0;
    let itcIgst = 0;
    let itcInvoiceCount = 0;

    for (const inv of purchaseInvoices) {
      if (inv.status !== "approved" && inv.status !== "paid") continue;
      const dateOnly = inv.date.slice(0, 10);
      if (dateOnly < args.fromDate || dateOnly > args.toDate) continue;
      if (inv.cgst + inv.sgst + inv.igst <= 0) continue;
      itcCgst += inv.cgst;
      itcSgst += inv.sgst;
      itcIgst += inv.igst;
      itcInvoiceCount += 1;
    }

    return {
      outwardTaxableValue,
      outwardCgst,
      outwardSgst,
      outwardIgst,
      itcCgst,
      itcSgst,
      itcIgst,
      itcInvoiceCount,
      netCgstPayable: Math.max(0, outwardCgst - itcCgst),
      netSgstPayable: Math.max(0, outwardSgst - itcSgst),
      netIgstPayable: Math.max(0, outwardIgst - itcIgst),
      netTaxPayable:
        Math.max(0, outwardCgst - itcCgst) + Math.max(0, outwardSgst - itcSgst) + Math.max(0, outwardIgst - itcIgst),
    };
  },
});

// ── Filing status tracker (simple log of return periods marked as filed) ───

export const listVendorsWithGstin = query({
  args: {},
  handler: async (ctx): Promise<{ vendorId: Id<"vendors">; name: string; gstin: string }[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const vendors = await ctx.db.query("vendors").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect();
    return vendors.filter((v) => !!v.gstin).map((v) => ({ vendorId: v._id, name: v.name, gstin: v.gstin! }));
  },
});
