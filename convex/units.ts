import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { unitStatusValidator } from "./schema/realEstate.ts";
import { requireOwnedProject, requireOwnedUnit, requireUser, effectiveOwnerId } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";
import { splitGstInclusive } from "./lib/gst.ts";

export type UnitWithBuyer = Doc<"units"> & {
  buyerName?: string;
  buyerId?: Id<"buyers">;
  /** All buyer names (primary + co-buyers) */
  allBuyerNames?: string[];
  allBuyerIds?: Id<"buyers">[];
};

const unitFields = {
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
  price: v.number(),
  status: unitStatusValidator,
  facing: v.optional(v.string()),
  notes: v.optional(v.string()),
};

/** Sorts units the way a site plan reads: block, then floor, then number. */
function compareUnits(
  a: { block?: string; floor?: number; number: string },
  b: { block?: string; floor?: number; number: string },
): number {
  const blockDiff = (a.block ?? "").localeCompare(b.block ?? "");
  if (blockDiff !== 0) return blockDiff;
  const floorDiff = (a.floor ?? 0) - (b.floor ?? 0);
  if (floorDiff !== 0) return floorDiff;
  return a.number.localeCompare(b.number, undefined, { numeric: true });
}

export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    status: v.optional(unitStatusValidator),
  },
  handler: async (ctx, args): Promise<UnitWithBuyer[]> => {
    const user = await requireUser(ctx);
    await requireOwnedProject(ctx, args.projectId, effectiveOwnerId(user));

    const status = args.status;
    const units =
      status === undefined
        ? await ctx.db
            .query("units")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .collect()
        : await ctx.db
            .query("units")
            .withIndex("by_project_and_status", (q) =>
              q.eq("projectId", args.projectId).eq("status", status),
            )
            .collect();

    const sorted = units.sort(compareUnits);

    // Enrich booked/sold units with buyer names via active booking
    return await Promise.all(
      sorted.map(async (unit): Promise<UnitWithBuyer> => {
        if (unit.status !== "booked" && unit.status !== "sold") return unit;
        const booking = await ctx.db
          .query("bookings")
          .withIndex("by_unit", (q) => q.eq("unitId", unit._id))
          // eslint-disable-next-line @convex-dev/no-filter-in-query
          .filter((q) => q.eq(q.field("status"), "active"))
          .first();
        if (!booking) return unit;
        const buyer = await ctx.db.get("buyers", booking.buyerId);
        const coBuyers = await Promise.all(
          (booking.coBuyerIds ?? []).map((id) => ctx.db.get("buyers", id)),
        );
        const validCoBuyers = coBuyers.filter((b): b is Doc<"buyers"> => b !== null);
        const allBuyers = buyer ? [buyer, ...validCoBuyers] : validCoBuyers;
        return {
          ...unit,
          buyerName: buyer?.name,
          buyerId: booking.buyerId,
          allBuyerNames: allBuyers.map((b) => b.name),
          allBuyerIds: allBuyers.map((b) => b._id),
        };
      }),
    );
  },
});

export const create = mutation({
  args: { projectId: v.id("projects"), ...unitFields },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "projects");
    const ownerId = effectiveOwnerId(user);
    const { projectId, ...fields } = args;
    await requireOwnedProject(ctx, projectId, ownerId);

    const existing = await ctx.db
      .query("units")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    const clash = existing.find(
      (unit) =>
        unit.number.trim().toLowerCase() === fields.number.trim().toLowerCase(),
    );
    if (clash) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Unit ${fields.number} already exists in this project`,
      });
    }

    return await ctx.db.insert("units", {
      ...fields,
      projectId,
      ownerId,
    });
  },
});

export const update = mutation({
  args: { unitId: v.id("units"), ...unitFields },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "projects");
    const { unitId, ...fields } = args;
    await requireOwnedUnit(ctx, unitId, effectiveOwnerId(user));
    const previous = await ctx.db.get("units", unitId);
    await ctx.db.patch("units", unitId, fields);

    // Keep any active booking's agreement value in sync with the unit's price,
    // so edits to a unit's area/rate always flow through to its booking,
    // collections, and sales figures.
    if (previous && previous.price !== fields.price) {
      const activeBooking = await ctx.db
        .query("bookings")
        .withIndex("by_unit", (q) => q.eq("unitId", unitId))
        // eslint-disable-next-line @convex-dev/no-filter-in-query
        .filter((q) => q.eq(q.field("status"), "active"))
        .first();
      if (activeBooking) {
        const gstUpdate = activeBooking.gstPercent
          ? { gstAmount: splitGstInclusive(fields.price, activeBooking.gstPercent).gstAmount }
          : {};
        await ctx.db.patch("bookings", activeBooking._id, {
          agreementValue: fields.price,
          ...gstUpdate,
        });
      }
    }

    return unitId;
  },
});

export const setStatus = mutation({
  args: { unitId: v.id("units"), status: unitStatusValidator },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "projects");
    await requireOwnedUnit(ctx, args.unitId, effectiveOwnerId(user));
    await ctx.db.patch("units", args.unitId, { status: args.status });
    return args.unitId;
  },
});

/**
 * Links an existing buyer to a booked/sold unit by creating a minimal booking record.
 * If the unit already has an active booking for the same buyer, this is a no-op.
 * If it has a booking for a different buyer, the old booking is cancelled and a new one created.
 */
export const linkBuyer = mutation({
  args: {
    unitId: v.id("units"),
    buyerId: v.optional(v.id("buyers")),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "projects");
    const ownerId = effectiveOwnerId(user);
    await requireOwnedUnit(ctx, args.unitId, ownerId);

    const unit = await ctx.db.get("units", args.unitId);
    if (!unit) throw new ConvexError({ code: "NOT_FOUND", message: "Unit not found" });

    // Find existing active booking for this unit
    const existingBooking = await ctx.db
      .query("bookings")
      .withIndex("by_unit", (q) => q.eq("unitId", args.unitId))
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    // If clearing the buyer link
    if (!args.buyerId) {
      if (existingBooking) {
        await ctx.db.patch("bookings", existingBooking._id, { status: "cancelled" });
      }
      return;
    }

    const buyer = await ctx.db.get("buyers", args.buyerId);
    if (!buyer || buyer.ownerId !== ownerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Buyer not found" });
    }

    // Already linked to this buyer — nothing to do
    if (existingBooking && existingBooking.buyerId === args.buyerId) return;

    // Cancel existing booking if linked to a different buyer
    if (existingBooking) {
      await ctx.db.patch("bookings", existingBooking._id, { status: "cancelled" });
    }

    // Create minimal booking record
    const today = new Date().toISOString().slice(0, 10);
    await ctx.db.insert("bookings", {
      ownerId,
      unitId: args.unitId,
      buyerId: args.buyerId,
      bookingDate: today,
      agreementValue: unit.price,
      bookingAmount: 0,
      status: "active",
      notes: "Linked via unit form",
    });
  },
});

export const remove = mutation({
  args: { unitId: v.id("units") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role && user.role !== "owner") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the account owner can delete units" });
    }
    const unit = await requireOwnedUnit(ctx, args.unitId, user._id);
    if (unit.status === "booked" || unit.status === "sold") {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Booked or sold units cannot be deleted",
      });
    }
    await ctx.db.delete("units", args.unitId);
    return null;
  },
});

/** Generates a run of units in one go, e.g. floors 1-10 with 4 flats each. */
export const bulkCreate = mutation({
  args: {
    projectId: v.id("projects"),
    block: v.optional(v.string()),
    fromFloor: v.number(),
    toFloor: v.number(),
    unitsPerFloor: v.number(),
    superBuiltUpAreaSqft: v.number(),
    ratePerSqft: v.number(),
    configuration: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireModuleAccess(ctx, "projects");
    const ownerId = effectiveOwnerId(user);
    await requireOwnedProject(ctx, args.projectId, ownerId);

    if (args.toFloor < args.fromFloor) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "The last floor must not be below the first floor",
      });
    }
    const floors = args.toFloor - args.fromFloor + 1;
    const total = floors * args.unitsPerFloor;
    if (args.unitsPerFloor < 1 || total > 500) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Please generate between 1 and 500 units at a time",
      });
    }

    const existing = await ctx.db
      .query("units")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const taken = new Set(
      existing.map((unit) => unit.number.trim().toLowerCase()),
    );

    const prefix = args.block ? `${args.block}-` : "";
    let created = 0;
    for (let floor = args.fromFloor; floor <= args.toFloor; floor++) {
      for (let index = 1; index <= args.unitsPerFloor; index++) {
        const number = `${prefix}${floor}${String(index).padStart(2, "0")}`;
        if (taken.has(number.toLowerCase())) continue;
        taken.add(number.toLowerCase());
        await ctx.db.insert("units", {
          ownerId,
          projectId: args.projectId,
          number,
          block: args.block,
          floor,
          configuration: args.configuration,
          superBuiltUpAreaSqft: args.superBuiltUpAreaSqft,
          ratePerSqft: args.ratePerSqft,
          price: Math.round(args.superBuiltUpAreaSqft * args.ratePerSqft),
          status: "available",
        });
        created += 1;
      }
    }
    return { created, skipped: total - created };
  },
});
