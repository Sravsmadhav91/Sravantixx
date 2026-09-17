import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUser, effectiveOwnerId } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";
import {
  leadSourceValidator,
  leadStatusValidator,
} from "./schema/realEstate.ts";

// ── Bulk import: Buyers ───────────────────────────────────────────────────────

const buyerRowValidator = v.object({
  name: v.string(),
  phone: v.string(),
  email: v.optional(v.string()),
  pan: v.optional(v.string()),
  address: v.optional(v.string()),
  notes: v.optional(v.string()),
});

export const bulkImportBuyers = mutation({
  args: { rows: v.array(buyerRowValidator) },
  handler: async (ctx, args): Promise<{ imported: number }> => {
    const user = await requireModuleAccess(ctx, "import");
    const ownerId = effectiveOwnerId(user);
    if (args.rows.length === 0)
      throw new ConvexError({ code: "BAD_REQUEST", message: "No rows provided" });

    for (const row of args.rows) {
      await ctx.db.insert("buyers", {
        ownerId,
        name: row.name.trim(),
        phone: row.phone.trim(),
        email: row.email?.trim() || undefined,
        pan: row.pan?.trim() || undefined,
        address: row.address?.trim() || undefined,
        notes: row.notes?.trim() || undefined,
      });
    }

    return { imported: args.rows.length };
  },
});

// ── Bulk import: Units ────────────────────────────────────────────────────────

const unitRowValidator = v.object({
  /** Must match a project code or name the user owns */
  projectCode: v.string(),
  number: v.string(),
  block: v.optional(v.string()),
  floor: v.optional(v.number()),
  configuration: v.optional(v.string()),
  superBuiltUpAreaSqft: v.number(),
  areaSqft: v.optional(v.number()),
  carpetAreaSqft: v.optional(v.number()),
  balconyAreaSqft: v.optional(v.number()),
  undividedShare: v.optional(v.string()),
  ratePerSqft: v.number(),
  facing: v.optional(v.string()),
  notes: v.optional(v.string()),
});

export const bulkImportUnits = mutation({
  args: { rows: v.array(unitRowValidator) },
  handler: async (ctx, args): Promise<{ imported: number; skipped: number }> => {
    const user = await requireModuleAccess(ctx, "import");
    const ownerId = effectiveOwnerId(user);
    if (args.rows.length === 0)
      throw new ConvexError({ code: "BAD_REQUEST", message: "No rows provided" });

    // Build a map of project code -> _id for this owner
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();

    const codeMap = new Map<string, (typeof projects)[0]["_id"]>();
    for (const p of projects) {
      codeMap.set(p.code.toUpperCase(), p._id);
      codeMap.set(p.name.toUpperCase(), p._id);
    }

    let imported = 0;
    let skipped = 0;

    for (const row of args.rows) {
      const projectId =
        codeMap.get(row.projectCode.trim().toUpperCase());
      if (!projectId) {
        skipped++;
        continue;
      }
      const price = Math.round(row.superBuiltUpAreaSqft * row.ratePerSqft);
      await ctx.db.insert("units", {
        ownerId,
        projectId,
        number: row.number.trim(),
        block: row.block?.trim() || undefined,
        floor: row.floor ?? undefined,
        configuration: row.configuration?.trim() || undefined,
        superBuiltUpAreaSqft: row.superBuiltUpAreaSqft,
        areaSqft: row.areaSqft ?? undefined,
        carpetAreaSqft: row.carpetAreaSqft ?? undefined,
        balconyAreaSqft: row.balconyAreaSqft ?? undefined,
        undividedShare: row.undividedShare?.trim() || undefined,
        ratePerSqft: row.ratePerSqft,
        price,
        status: "available",
        facing: row.facing?.trim() || undefined,
        notes: row.notes?.trim() || undefined,
      });
      imported++;
    }

    return { imported, skipped };
  },
});

// ── Bulk import: Purchase Invoices ───────────────────────────────────────────

const invoiceRowValidator = v.object({
  vendorName: v.string(),
  invoiceNumber: v.string(),
  date: v.string(),
  dueDate: v.optional(v.string()),
  description: v.string(),
  quantity: v.number(),
  rate: v.number(),
  gstRate: v.number(),
  tds: v.number(),
  narration: v.optional(v.string()),
});

/**
 * Creates purchase invoices from CSV rows.
 * - Looks up vendor by name (case-insensitive); creates a new vendor if not found.
 * - Groups rows by vendor+invoice_number so a multi-line invoice is merged.
 * - Returns { imported, created } where created = new vendor records.
 */
export const bulkImportInvoices = mutation({
  args: { rows: v.array(invoiceRowValidator) },
  handler: async (
    ctx,
    args,
  ): Promise<{ imported: number; vendorsCreated: number }> => {
    const user = await requireModuleAccess(ctx, "import");
    const ownerId = effectiveOwnerId(user);

    if (args.rows.length === 0)
      throw new ConvexError({ code: "BAD_REQUEST", message: "No rows provided" });

    // Build vendor lookup map (name → id)
    const existingVendors = await ctx.db
      .query("vendors")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();

    const vendorMap = new Map<string, typeof existingVendors[0]["_id"]>();
    for (const v of existingVendors) {
      vendorMap.set(v.name.trim().toUpperCase(), v._id);
    }

    let vendorsCreated = 0;

    // Group rows by vendor + invoice number
    type InvoiceKey = string; // `${vendorName}|||${invoiceNumber}`
    const groups = new Map<InvoiceKey, typeof args.rows>();
    for (const row of args.rows) {
      const key: InvoiceKey = `${row.vendorName.trim().toUpperCase()}|||${row.invoiceNumber.trim()}`;
      const existing = groups.get(key) ?? [];
      existing.push(row);
      groups.set(key, existing);
    }

    // Auto-generate sequential internal ref
    const existing = await ctx.db
      .query("purchaseInvoices")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .first();
    const year = new Date().getFullYear();
    let seq = existing
      ? (() => {
          const m = existing.internalRef.match(/PI-\d{4}-(\d+)$/);
          return m ? parseInt(m[1], 10) + 1 : 1;
        })()
      : 1;

    let imported = 0;

    for (const [, rows] of groups) {
      const first = rows[0];
      const vendorNameUpper = first.vendorName.trim().toUpperCase();

      // Ensure vendor exists
      let vendorId = vendorMap.get(vendorNameUpper);
      if (!vendorId) {
        vendorId = await ctx.db.insert("vendors", {
          ownerId,
          name: first.vendorName.trim(),
          category: "other",
          isActive: true,
        });
        vendorMap.set(vendorNameUpper, vendorId);
        vendorsCreated++;
      }

      // Compute totals
      let subtotal = 0;
      let cgst = 0;
      let sgst = 0;
      const igst = 0;
      const tds = first.tds; // TDS is per invoice header

      for (const row of rows) {
        const lineAmount = Math.round(row.quantity * row.rate * 100) / 100;
        subtotal += lineAmount;
        const gstAmount = Math.round(lineAmount * row.gstRate) / 100;
        // Intra-state GST split
        cgst += gstAmount / 2;
        sgst += gstAmount / 2;
      }

      const total = Math.round((subtotal + cgst + sgst + igst - tds) * 100) / 100;
      const internalRef = `PI-${year}-${String(seq).padStart(3, "0")}`;
      seq++;

      const invoiceId = await ctx.db.insert("purchaseInvoices", {
        ownerId,
        vendorId,
        invoiceNumber: first.invoiceNumber.trim(),
        internalRef,
        date: first.date,
        dueDate: first.dueDate,
        status: "draft",
        subtotal,
        cgst: Math.round(cgst * 100) / 100,
        sgst: Math.round(sgst * 100) / 100,
        igst,
        tds,
        total,
        amountPaid: 0,
        narration: first.narration,
      });

      // Insert invoice lines
      for (const row of rows) {
        const amount = Math.round(row.quantity * row.rate * 100) / 100;
        await ctx.db.insert("purchaseInvoiceLines", {
          ownerId,
          purchaseInvoiceId: invoiceId,
          description: row.description.trim(),
          quantity: row.quantity,
          rate: row.rate,
          amount,
          gstRate: row.gstRate > 0 ? row.gstRate : undefined,
        });
      }

      imported++;
    }

    return { imported, vendorsCreated };
  },
});

// ── Bulk import: Receipts matched by flat/unit number ──────────────────────

const flatReceiptRowValidator = v.object({
  flatNumber: v.string(),
  amount: v.number(),
  paymentDate: v.string(),
  referenceNumber: v.optional(v.string()),
  notes: v.optional(v.string()),
});

export type FlatReceiptImportResult = {
  imported: number;
  skippedDuplicates: number;
  unmatchedFlats: string[];
  ambiguousFlats: string[];
};

/**
 * Matches each row's flat number to a unit (by number, case/space-insensitive)
 * with an active booking, then records a receipt against that booking.
 * Rows whose flat number has no matching unit, or matches a unit with no
 * active booking, are reported back as unmatched — nothing is guessed.
 * Skips rows that look like an exact duplicate of an existing receipt
 * (same booking, date, and amount) so the import is safe to re-run.
 */
export const bulkImportFlatReceipts = mutation({
  args: { rows: v.array(flatReceiptRowValidator) },
  handler: async (ctx, args): Promise<FlatReceiptImportResult> => {
    const user = await requireModuleAccess(ctx, "import");
    const ownerId = effectiveOwnerId(user);
    if (args.rows.length === 0)
      throw new ConvexError({ code: "BAD_REQUEST", message: "No rows provided" });

    const normalize = (n: string) => n.trim().toUpperCase().replace(/[\s-]+/g, "");

    const units = await ctx.db
      .query("units")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    const unitsByNumber = new Map<string, typeof units>();
    for (const u of units) {
      const key = normalize(u.number);
      const list = unitsByNumber.get(key) ?? [];
      list.push(u);
      unitsByNumber.set(key, list);
    }

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_owner_and_status", (q) => q.eq("ownerId", ownerId).eq("status", "active"))
      .collect();
    const bookingByUnitId = new Map<string, (typeof bookings)[0]>();
    for (const b of bookings) bookingByUnitId.set(b.unitId, b);

    let imported = 0;
    let skippedDuplicates = 0;
    const unmatchedFlats = new Set<string>();
    const ambiguousFlats = new Set<string>();
    // Cache existing receipts per booking to detect duplicates without re-querying per row.
    const existingReceiptsCache = new Map<string, Array<{ paymentDate: string; amount: number }>>();

    for (const row of args.rows) {
      const key = normalize(row.flatNumber);
      const matches = unitsByNumber.get(key) ?? [];
      if (matches.length === 0) {
        unmatchedFlats.add(row.flatNumber.trim());
        continue;
      }
      if (matches.length > 1) {
        ambiguousFlats.add(row.flatNumber.trim());
        continue;
      }
      const unit = matches[0];
      const booking = bookingByUnitId.get(unit._id);
      if (!booking) {
        unmatchedFlats.add(row.flatNumber.trim());
        continue;
      }

      let existing = existingReceiptsCache.get(booking._id);
      if (!existing) {
        const rows = await ctx.db
          .query("receipts")
          .withIndex("by_booking", (q) => q.eq("bookingId", booking._id))
          .collect();
        existing = rows.map((r) => ({ paymentDate: r.paymentDate, amount: r.amount }));
        existingReceiptsCache.set(booking._id, existing);
      }

      const isDuplicate = existing.some(
        (r) => r.paymentDate === row.paymentDate && r.amount === row.amount,
      );
      if (isDuplicate) {
        skippedDuplicates++;
        continue;
      }

      await ctx.db.insert("receipts", {
        ownerId,
        bookingId: booking._id,
        amount: row.amount,
        paymentDate: row.paymentDate,
        paymentMode: "neft",
        referenceNumber: row.referenceNumber,
        notes: row.notes,
      });
      existing.push({ paymentDate: row.paymentDate, amount: row.amount });
      imported++;
    }

    return {
      imported,
      skippedDuplicates,
      unmatchedFlats: [...unmatchedFlats],
      ambiguousFlats: [...ambiguousFlats],
    };
  },
});

// ── Bulk import: GST Portal IMS (Invoice Management System) rows ────────────

const imsRowValidator = v.object({
  gstin: v.string(),
  vendorName: v.string(),
  invoiceNumber: v.string(),
  invoiceDate: v.string(),
  taxableValue: v.number(),
  integratedTax: v.number(),
  centralTax: v.number(),
  stateTax: v.number(),
  cess: v.number(),
  status: v.string(),
  isCreditNote: v.boolean(),
});

export type ImsImportResult = {
  imported: number;
  skippedDuplicates: number;
  vendorsCreated: number;
  vendorsMatched: number;
};

/**
 * Imports every B2B invoice row and every B2B-CN credit note row from a GST
 * Portal IMS export, regardless of their portal status (Accepted / Pending /
 * Rejected / No Action Taken) — the status is kept as a note on the invoice.
 * - Matches vendors by GSTIN (creates a new vendor if none exists for that GSTIN).
 * - Skips rows that exactly match an existing purchase invoice for the same
 *   vendor + invoice number, so re-uploading the same monthly file is safe.
 * - Each row becomes one purchase invoice with a single line (GST-inclusive
 *   totals from the portal; CGST/SGST/IGST/cess taken as reported). Credit
 *   notes are recorded as negative-amount purchase invoices, reducing what
 *   is owed to that vendor.
 */
export const bulkImportImsInvoices = mutation({
  args: { rows: v.array(imsRowValidator) },
  handler: async (ctx, args): Promise<ImsImportResult> => {
    const user = await requireModuleAccess(ctx, "import");
    const ownerId = effectiveOwnerId(user);
    if (args.rows.length === 0)
      throw new ConvexError({ code: "BAD_REQUEST", message: "No rows provided" });

    const existingVendors = await ctx.db
      .query("vendors")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    const vendorByGstin = new Map<string, typeof existingVendors[0]["_id"]>();
    for (const v of existingVendors) {
      if (v.gstin) vendorByGstin.set(v.gstin.trim().toUpperCase(), v._id);
    }

    const existingInvoices = await ctx.db
      .query("purchaseInvoices")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    const invoiceKey = (vendorId: string, invoiceNumber: string) =>
      `${vendorId}|||${invoiceNumber.trim().toUpperCase()}`;
    const existingInvoiceKeys = new Set(
      existingInvoices.map((i) => invoiceKey(i.vendorId, i.invoiceNumber)),
    );

    const sortedInvoices = existingInvoices.sort((a, b) => a.internalRef.localeCompare(b.internalRef));
    const last = sortedInvoices[sortedInvoices.length - 1];
    const year = new Date().getFullYear();
    const lastSeqMatch = last?.internalRef.match(/PI-\d{4}-(\d+)$/);
    let seq = lastSeqMatch ? parseInt(lastSeqMatch[1], 10) + 1 : 1;

    let imported = 0;
    let skippedDuplicates = 0;
    let vendorsCreated = 0;
    let vendorsMatched = 0;

    for (const row of args.rows) {
      const gstinKey = row.gstin.trim().toUpperCase();
      let vendorId = vendorByGstin.get(gstinKey);
      if (!vendorId) {
        vendorId = await ctx.db.insert("vendors", {
          ownerId,
          name: row.vendorName.trim(),
          gstin: gstinKey,
          category: "material_supplier",
          isActive: true,
          notes: "Auto-created from GST Portal IMS import",
        });
        vendorByGstin.set(gstinKey, vendorId);
        vendorsCreated++;
      } else {
        vendorsMatched++;
      }

      const key = invoiceKey(vendorId, row.invoiceNumber);
      if (existingInvoiceKeys.has(key)) {
        skippedDuplicates++;
        continue;
      }
      existingInvoiceKeys.add(key);

      // Credit notes reduce what is owed to the vendor — record as a negative amount.
      const sign = row.isCreditNote ? -1 : 1;
      const subtotal = sign * row.taxableValue;
      const cgst = sign * row.centralTax;
      const sgst = sign * row.stateTax;
      const igst = sign * row.integratedTax;
      const total =
        sign *
        (Math.round(
          (row.taxableValue + row.integratedTax + row.centralTax + row.stateTax + row.cess) * 100,
        ) / 100);
      const internalRef = `PI-${year}-${String(seq).padStart(3, "0")}`;
      seq++;

      const narration = row.isCreditNote
        ? `Credit note imported from GST Portal IMS · Status: ${row.status}`
        : `Imported from GST Portal IMS · Status: ${row.status}`;

      const invoiceId = await ctx.db.insert("purchaseInvoices", {
        ownerId,
        vendorId,
        invoiceNumber: row.invoiceNumber.trim(),
        internalRef,
        date: row.invoiceDate,
        status: "draft",
        subtotal,
        cgst,
        sgst,
        igst,
        tds: 0,
        total,
        amountPaid: 0,
        narration,
      });

      await ctx.db.insert("purchaseInvoiceLines", {
        ownerId,
        purchaseInvoiceId: invoiceId,
        description: row.isCreditNote
          ? `Credit note — ${row.vendorName.trim()} (IMS import)`
          : `Purchase — ${row.vendorName.trim()} (IMS import)`,
        quantity: 1,
        amount: subtotal,
        rate: subtotal,
        gstRate:
          row.taxableValue > 0
            ? Math.round(
                ((row.integratedTax + row.centralTax + row.stateTax) / row.taxableValue) * 100,
              )
            : undefined,
      });

      imported++;
    }

    return { imported, skippedDuplicates, vendorsCreated, vendorsMatched };
  },
});

// ── Bulk import: Leads ────────────────────────────────────────────────────────

const leadRowValidator = v.object({
  name: v.string(),
  phone: v.string(),
  email: v.optional(v.string()),
  source: leadSourceValidator,
  status: leadStatusValidator,
  budget: v.optional(v.number()),
  projectInterest: v.optional(v.string()),
  notes: v.optional(v.string()),
});

export const bulkImportLeads = mutation({
  args: { rows: v.array(leadRowValidator) },
  handler: async (ctx, args): Promise<{ imported: number }> => {
    const user = await requireModuleAccess(ctx, "import");
    const ownerId = effectiveOwnerId(user);
    if (args.rows.length === 0)
      throw new ConvexError({ code: "BAD_REQUEST", message: "No rows provided" });

    const now = new Date().toISOString();
    for (const row of args.rows) {
      await ctx.db.insert("leads", {
        ownerId,
        name: row.name.trim(),
        phone: row.phone.trim(),
        email: row.email?.trim() || undefined,
        source: row.source,
        status: row.status,
        budget: row.budget ?? undefined,
        projectInterest: row.projectInterest?.trim() || undefined,
        notes: row.notes?.trim() || undefined,
        lastActivityAt: now,
      });
    }

    return { imported: args.rows.length };
  },
});
