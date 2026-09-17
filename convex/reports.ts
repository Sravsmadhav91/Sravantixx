import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser, effectiveOwnerId } from "./lib/auth.ts";
import { requireModuleAccess } from "./lib/rbac.ts";
import type { Id } from "./_generated/dataModel";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns "Jan 2025" from an ISO timestamp. */
function monthLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/** Returns "YYYY-MM" for sorting. */
function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

// ── KPIs ─────────────────────────────────────────────────────────────────────

export type DashboardKpis = {
  activeBookings: number;
  totalBookingValue: number;
  totalCollected: number;
  totalOutstanding: number;
  overdueCount: number;
  totalProjects: number;
  totalUnits: number;
  availableUnits: number;
};

export const getDashboardKpis = query({
  args: {},
  handler: async (ctx): Promise<DashboardKpis> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const now = new Date().toISOString();

    const [projects, units, bookings, receipts, installments] = await Promise.all([
      ctx.db.query("projects").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("units").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("bookings").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("receipts").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("paymentInstallments").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
    ]);

    const activeBookings = bookings.filter((b) => b.status === "active");
    const totalBookingValue = activeBookings.reduce((s, b) => s + b.agreementValue, 0);
    const totalCollected = receipts.reduce((s, r) => s + r.amount, 0);
    const totalOutstanding = Math.max(0, totalBookingValue - totalCollected);

    // Overdue: demanded/pending installments with dueDate < now
    const overdueCount = installments.filter(
      (i) => i.status !== "paid" && i.dueDate !== undefined && i.dueDate < now,
    ).length;

    return {
      activeBookings: activeBookings.length,
      totalBookingValue,
      totalCollected,
      totalOutstanding,
      overdueCount,
      totalProjects: projects.length,
      totalUnits: units.length,
      availableUnits: units.filter((u) => u.status === "available").length,
    };
  },
});

// ── Bookings by month ─────────────────────────────────────────────────────────

export type MonthlyBooking = { month: string; sortKey: string; count: number; value: number };

export const getBookingsByMonth = query({
  args: {},
  handler: async (ctx): Promise<MonthlyBooking[]> => {
    const user = await requireUser(ctx);
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_owner", (q) => q.eq("ownerId", effectiveOwnerId(user)))
      .collect();

    const map = new Map<string, MonthlyBooking>();
    for (const b of bookings) {
      if (b.status !== "active") continue;
      const key = monthKey(b.bookingDate);
      const entry = map.get(key) ?? { month: monthLabel(b.bookingDate), sortKey: key, count: 0, value: 0 };
      entry.count += 1;
      entry.value += b.agreementValue;
      map.set(key, entry);
    }

    return [...map.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(-12);
  },
});

// ── Collections by month ──────────────────────────────────────────────────────

export type MonthlyCollection = { month: string; sortKey: string; amount: number };

export const getCollectionsByMonth = query({
  args: {},
  handler: async (ctx): Promise<MonthlyCollection[]> => {
    const user = await requireUser(ctx);
    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_owner", (q) => q.eq("ownerId", effectiveOwnerId(user)))
      .collect();

    const map = new Map<string, MonthlyCollection>();
    for (const r of receipts) {
      const key = monthKey(r.paymentDate);
      const entry = map.get(key) ?? { month: monthLabel(r.paymentDate), sortKey: key, amount: 0 };
      entry.amount += r.amount;
      map.set(key, entry);
    }

    return [...map.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(-12);
  },
});

// ── Project-wise unit status ───────────────────────────────────────────────────

export type ProjectStatus = {
  projectId: Id<"projects">;
  name: string;
  available: number;
  onHold: number;
  booked: number;
  sold: number;
  total: number;
};

export const getProjectWiseStatus = query({
  args: {},
  handler: async (ctx): Promise<ProjectStatus[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const [projects, units] = await Promise.all([
      ctx.db.query("projects").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("units").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
    ]);

    const map = new Map<Id<"projects">, ProjectStatus>();
    for (const p of projects) {
      map.set(p._id, { projectId: p._id, name: p.name, available: 0, onHold: 0, booked: 0, sold: 0, total: 0 });
    }
    for (const u of units) {
      const entry = map.get(u.projectId);
      if (!entry) continue;
      entry.total += 1;
      if (u.status === "available") entry.available += 1;
      if (u.status === "on_hold") entry.onHold += 1;
      if (u.status === "booked") entry.booked += 1;
      if (u.status === "sold") entry.sold += 1;
    }

    return [...map.values()];
  },
});

// ── Report: Unit availability ─────────────────────────────────────────────────

export type UnitAvailabilityRow = {
  unitId: Id<"units">;
  projectName: string;
  unitNumber: string;
  block: string;
  configuration: string;
  superBuiltUpAreaSqft: number;
  areaSqft?: number;
  price: number;
  status: string;
};

export const getUnitAvailability = query({
  args: {},
  handler: async (ctx): Promise<UnitAvailabilityRow[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const [projects, units] = await Promise.all([
      ctx.db.query("projects").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("units").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
    ]);
    const projectMap = new Map(projects.map((p) => [p._id, p.name]));

    return units
      .sort((a, b) => (projectMap.get(a.projectId) ?? "").localeCompare(projectMap.get(b.projectId) ?? "") || a.number.localeCompare(b.number))
      .map((u) => ({
        unitId: u._id,
        projectName: projectMap.get(u.projectId) ?? "—",
        unitNumber: u.number,
        block: u.block ?? "—",
        configuration: u.configuration ?? "—",
        superBuiltUpAreaSqft: u.superBuiltUpAreaSqft,
        areaSqft: u.areaSqft,
        price: u.price,
        status: u.status,
      }));
  },
});

// ── Report: Collections due ───────────────────────────────────────────────────

export type CollectionsDueRow = {
  installmentId: Id<"paymentInstallments">;
  buyerName: string;
  projectName: string;
  unitNumber: string;
  milestone: string;
  amount: number;
  dueDate: string;
  status: string;
  bookingId: Id<"bookings">;
};

export const getCollectionsDue = query({
  args: {},
  handler: async (ctx): Promise<CollectionsDueRow[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const now = new Date().toISOString();

    const [installments, bookings, buyers, units, projects] = await Promise.all([
      ctx.db.query("paymentInstallments").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("bookings").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("buyers").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("units").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("projects").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
    ]);

    const bookingMap = new Map(bookings.map((b) => [b._id, b]));
    const buyerMap = new Map(buyers.map((b) => [b._id, b.name]));
    const unitMap = new Map(units.map((u) => [u._id, u]));
    const projectMap = new Map(projects.map((p) => [p._id, p.name]));

    return installments
      .filter((i) => i.status !== "paid" && i.dueDate !== undefined)
      .map((i) => {
        const booking = bookingMap.get(i.bookingId);
        const unit = booking ? unitMap.get(booking.unitId) : undefined;
        return {
          installmentId: i._id,
          buyerName: booking ? (buyerMap.get(booking.buyerId) ?? "—") : "—",
          projectName: unit ? (projectMap.get(unit.projectId) ?? "—") : "—",
          unitNumber: unit?.number ?? "—",
          milestone: i.milestone,
          amount: i.amount,
          dueDate: i.dueDate!,
          status: i.status,
          isOverdue: i.dueDate! < now,
          bookingId: i.bookingId,
        };
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)) as CollectionsDueRow[];
  },
});

// ── Analytics: Sales velocity (bookings + collections per month) ───────────────

export type SalesVelocityRow = {
  month: string;
  sortKey: string;
  bookingCount: number;
  bookingValue: number;
  collectionAmount: number;
};

export const getSalesVelocity = query({
  args: { fromDate: v.string(), toDate: v.string() },
  handler: async (ctx, args): Promise<SalesVelocityRow[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const [bookings, receipts] = await Promise.all([
      ctx.db.query("bookings").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("receipts").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
    ]);

    const map = new Map<string, SalesVelocityRow>();
    const ensureMonth = (key: string, label: string) => {
      if (!map.has(key)) {
        map.set(key, { month: label, sortKey: key, bookingCount: 0, bookingValue: 0, collectionAmount: 0 });
      }
      return map.get(key)!;
    };

    for (const b of bookings) {
      if (b.status !== "active") continue;
      if (b.bookingDate < args.fromDate || b.bookingDate > args.toDate) continue;
      const key = monthKey(b.bookingDate);
      const row = ensureMonth(key, monthLabel(b.bookingDate));
      row.bookingCount += 1;
      row.bookingValue += b.agreementValue;
    }

    for (const r of receipts) {
      if (r.paymentDate < args.fromDate || r.paymentDate > args.toDate) continue;
      const key = monthKey(r.paymentDate);
      const row = ensureMonth(key, monthLabel(r.paymentDate));
      row.collectionAmount += r.amount;
    }

    return [...map.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  },
});

// ── Analytics: Lead funnel ────────────────────────────────────────────────────

export type FunnelData = {
  leads: number;
  contacted: number;
  siteVisit: number;
  negotiation: number;
  won: number;
  bookings: number;
  leadConversionRate: number;
};

export const getLeadFunnel = query({
  args: {},
  handler: async (ctx): Promise<FunnelData> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const [leads, bookings] = await Promise.all([
      ctx.db.query("leads").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("bookings").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
    ]);

    const total = leads.length;
    const contacted = leads.filter((l) => ["contacted", "site_visit", "negotiation", "won"].includes(l.status)).length;
    const siteVisit = leads.filter((l) => ["site_visit", "negotiation", "won"].includes(l.status)).length;
    const negotiation = leads.filter((l) => ["negotiation", "won"].includes(l.status)).length;
    const won = leads.filter((l) => l.status === "won").length;

    return {
      leads: total,
      contacted,
      siteVisit,
      negotiation,
      won,
      bookings: bookings.filter((b) => b.status === "active").length,
      leadConversionRate: total > 0 ? Math.round((won / total) * 100) : 0,
    };
  },
});

// ── Analytics: Project P&L ────────────────────────────────────────────────────

export type ProjectPnLRow = {
  projectId: Id<"projects">;
  name: string;
  totalBookingValue: number;
  totalCollected: number;
  constructionCost: number;
  grossProfit: number;
  grossMarginPct: number;
  unitsSold: number;
  unitsBooked: number;
  totalUnits: number;
};

export const getProjectPnL = query({
  args: {},
  handler: async (ctx): Promise<ProjectPnLRow[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const [projects, units, bookings, receipts, expenses] = await Promise.all([
      ctx.db.query("projects").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("units").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("bookings").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("receipts").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("projectExpenses").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
    ]);

    const unitProjectMap = new Map(units.map((u) => [u._id, u.projectId]));
    const bookingReceiptMap = new Map<string, number>();
    for (const r of receipts) {
      bookingReceiptMap.set(r.bookingId, (bookingReceiptMap.get(r.bookingId) ?? 0) + r.amount);
    }

    return projects.map((p) => {
      const projectUnits = units.filter((u) => u.projectId === p._id);
      const projectBookings = bookings.filter(
        (b) => b.status === "active" && unitProjectMap.get(b.unitId) === p._id,
      );
      const totalCollected = projectBookings.reduce(
        (s, b) => s + (bookingReceiptMap.get(b._id) ?? 0), 0,
      );
      const constructionCost = expenses
        .filter((e) => e.projectId === p._id)
        .reduce((s, e) => s + e.amount, 0);
      const totalBookingValue = projectBookings.reduce((s, b) => s + b.agreementValue, 0);
      const grossProfit = totalCollected - constructionCost;

      return {
        projectId: p._id,
        name: p.name,
        totalBookingValue,
        totalCollected,
        constructionCost,
        grossProfit,
        grossMarginPct: totalCollected > 0 ? Math.round((grossProfit / totalCollected) * 100) : 0,
        unitsSold: projectUnits.filter((u) => u.status === "sold").length,
        unitsBooked: projectUnits.filter((u) => u.status === "booked").length,
        totalUnits: projectUnits.length,
      };
    });
  },
});

// ── Analytics: Unit absorption rate ──────────────────────────────────────────

export type AbsorptionRow = {
  projectId: Id<"projects">;
  name: string;
  totalUnits: number;
  soldOrBooked: number;
  absorptionRate: number;
  available: number;
};

export const getUnitAbsorption = query({
  args: {},
  handler: async (ctx): Promise<AbsorptionRow[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const [projects, units] = await Promise.all([
      ctx.db.query("projects").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("units").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
    ]);

    return projects.map((p) => {
      const projectUnits = units.filter((u) => u.projectId === p._id);
      const soldOrBooked = projectUnits.filter((u) => u.status === "sold" || u.status === "booked").length;
      const total = projectUnits.length;
      return {
        projectId: p._id,
        name: p.name,
        totalUnits: total,
        soldOrBooked,
        absorptionRate: total > 0 ? Math.round((soldOrBooked / total) * 100) : 0,
        available: projectUnits.filter((u) => u.status === "available").length,
      };
    });
  },
});

// ── Analytics: Top buyers by booking value ────────────────────────────────────

export type TopBuyerRow = {
  buyerId: Id<"buyers">;
  name: string;
  phone: string;
  bookingCount: number;
  totalBookingValue: number;
  totalCollected: number;
  outstanding: number;
};

export const getTopBuyers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<TopBuyerRow[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const [buyers, bookings, receipts] = await Promise.all([
      ctx.db.query("buyers").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("bookings").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("receipts").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
    ]);

    const receiptByBooking = new Map<string, number>();
    for (const r of receipts) {
      receiptByBooking.set(r.bookingId, (receiptByBooking.get(r.bookingId) ?? 0) + r.amount);
    }

    const buyerMap = new Map(buyers.map((b) => [b._id, b]));
    const buyerBookings = new Map<string, { value: number; collected: number; count: number }>();
    for (const b of bookings) {
      if (b.status !== "active") continue;
      const existing = buyerBookings.get(b.buyerId) ?? { value: 0, collected: 0, count: 0 };
      existing.value += b.agreementValue;
      existing.collected += receiptByBooking.get(b._id) ?? 0;
      existing.count += 1;
      buyerBookings.set(b.buyerId, existing);
    }

    const rows: TopBuyerRow[] = [];
    for (const [buyerId, stats] of buyerBookings) {
      const buyer = buyerMap.get(buyerId as Id<"buyers">);
      if (!buyer) continue;
      rows.push({
        buyerId: buyer._id,
        name: buyer.name,
        phone: buyer.phone,
        bookingCount: stats.count,
        totalBookingValue: stats.value,
        totalCollected: stats.collected,
        outstanding: stats.value - stats.collected,
      });
    }

    return rows.sort((a, b) => b.totalBookingValue - a.totalBookingValue).slice(0, args.limit ?? 10);
  },
});

// ── Sales dashboard ───────────────────────────────────────────────────────────

export type SalesDashboardKpis = {
  bookingCount: number;
  bookingValue: number;
  collectedAmount: number;
  avgTicketSize: number;
  leadToBookingRate: number;
  totalLeads: number;
};

export type SalesTrendRow = {
  month: string;
  sortKey: string;
  bookingCount: number;
  bookingValue: number;
  collectedAmount: number;
};

export type SalesByProjectRow = {
  projectId: Id<"projects">;
  name: string;
  bookingCount: number;
  bookingValue: number;
  collectedAmount: number;
};

export type SalesRepRow = {
  userId: Id<"users"> | null;
  name: string;
  bookingCount: number;
  bookingValue: number;
};

export type SalesDashboardData = {
  kpis: SalesDashboardKpis;
  trend: SalesTrendRow[];
  byProject: SalesByProjectRow[];
  bySalesRep: SalesRepRow[];
};

/**
 * Sales dashboard: bookings over time, revenue trends, and lead-to-booking
 * conversion, optionally filtered by project and date range (matched against
 * bookingDate).
 */
export const getSalesDashboard = query({
  args: {
    projectId: v.optional(v.id("projects")),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SalesDashboardData> => {
    const user = await requireModuleAccess(ctx, "salesDashboard");
    const ownerId = effectiveOwnerId(user);

    const [bookings, receipts, units, leads, teamUsers] = await Promise.all([
      ctx.db.query("bookings").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("receipts").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("units").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("leads").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("users").withIndex("by_token").collect(),
    ]);

    const unitMap = new Map(units.map((u) => [u._id, u]));
    const projectMap = new Map<Id<"projects">, string>();
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    for (const p of projects) projectMap.set(p._id, p.name);

    const inRange = (dateIso: string) =>
      (!args.fromDate || dateIso >= args.fromDate) && (!args.toDate || dateIso <= args.toDate);

    const scopedBookings = bookings.filter((b) => {
      if (b.status !== "active") return false;
      if (!inRange(b.bookingDate)) return false;
      if (args.projectId) {
        const unit = unitMap.get(b.unitId);
        if (!unit || unit.projectId !== args.projectId) return false;
      }
      return true;
    });
    const scopedBookingIds = new Set(scopedBookings.map((b) => b._id));

    const scopedReceipts = receipts.filter((r) => {
      if (!scopedBookingIds.has(r.bookingId)) return false;
      if (!inRange(r.paymentDate)) return false;
      return true;
    });

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const bookingValue = scopedBookings.reduce((s, b) => s + b.agreementValue, 0);
    const collectedAmount = scopedReceipts.reduce((s, r) => s + r.amount, 0);
    const bookingCount = scopedBookings.length;
    const avgTicketSize = bookingCount > 0 ? Math.round(bookingValue / bookingCount) : 0;

    const scopedLeads = leads.filter((l) => inRange(l.lastActivityAt));
    const wonLeads = scopedLeads.filter((l) => l.status === "won").length;
    const leadToBookingRate = scopedLeads.length > 0 ? Math.round((wonLeads / scopedLeads.length) * 100) : 0;

    // ── Trend by month ────────────────────────────────────────────────────────
    const trendMap = new Map<string, SalesTrendRow>();
    const ensureMonth = (key: string, label: string) => {
      if (!trendMap.has(key)) {
        trendMap.set(key, { month: label, sortKey: key, bookingCount: 0, bookingValue: 0, collectedAmount: 0 });
      }
      return trendMap.get(key)!;
    };
    for (const b of scopedBookings) {
      const row = ensureMonth(monthKey(b.bookingDate), monthLabel(b.bookingDate));
      row.bookingCount += 1;
      row.bookingValue += b.agreementValue;
    }
    for (const r of scopedReceipts) {
      const row = ensureMonth(monthKey(r.paymentDate), monthLabel(r.paymentDate));
      row.collectedAmount += r.amount;
    }
    const trend = [...trendMap.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(-12);

    // ── By project ────────────────────────────────────────────────────────────
    const byProjectMap = new Map<Id<"projects">, SalesByProjectRow>();
    const receiptByBooking = new Map<string, number>();
    for (const r of scopedReceipts) {
      receiptByBooking.set(r.bookingId, (receiptByBooking.get(r.bookingId) ?? 0) + r.amount);
    }
    for (const b of scopedBookings) {
      const unit = unitMap.get(b.unitId);
      if (!unit) continue;
      const entry = byProjectMap.get(unit.projectId) ?? {
        projectId: unit.projectId,
        name: projectMap.get(unit.projectId) ?? "—",
        bookingCount: 0,
        bookingValue: 0,
        collectedAmount: 0,
      };
      entry.bookingCount += 1;
      entry.bookingValue += b.agreementValue;
      entry.collectedAmount += receiptByBooking.get(b._id) ?? 0;
      byProjectMap.set(unit.projectId, entry);
    }
    const byProject = [...byProjectMap.values()].sort((a, b) => b.bookingValue - a.bookingValue);

    // ── By sales rep (submittedBy on the booking, e.g. staff who created it) ──
    const userNameMap = new Map<Id<"users">, string>();
    for (const u of teamUsers) {
      if (u._id === ownerId || u.linkedOwnerId === ownerId) {
        userNameMap.set(u._id, u.name ?? u.email ?? "Team member");
      }
    }
    const bySalesRepMap = new Map<string, SalesRepRow>();
    for (const b of scopedBookings) {
      const repId = b.submittedBy ?? null;
      const key = repId ?? "unassigned";
      const entry = bySalesRepMap.get(key) ?? {
        userId: repId,
        name: repId ? (userNameMap.get(repId) ?? "Team member") : "Owner / unattributed",
        bookingCount: 0,
        bookingValue: 0,
      };
      entry.bookingCount += 1;
      entry.bookingValue += b.agreementValue;
      bySalesRepMap.set(key, entry);
    }
    const bySalesRep = [...bySalesRepMap.values()].sort((a, b) => b.bookingValue - a.bookingValue);

    return {
      kpis: {
        bookingCount,
        bookingValue,
        collectedAmount,
        avgTicketSize,
        leadToBookingRate,
        totalLeads: scopedLeads.length,
      },
      trend,
      byProject,
      bySalesRep,
    };
  },
});


// ── Collections dashboard ─────────────────────────────────────────────────────

export type CollectionsDashboardKpis = {
  totalAgreementValue: number;
  totalCollected: number;
  totalOutstanding: number;
  collectionRate: number;
  overdueCount: number;
  overdueAmount: number;
  upcomingCount: number;
  upcomingAmount: number;
};

export type CollectionsAgingBucket = {
  label: string;
  count: number;
  amount: number;
};

export type CollectionsTrendRow = {
  month: string;
  sortKey: string;
  collectedAmount: number;
};

export type CollectionsByProjectRow = {
  projectId: Id<"projects">;
  name: string;
  agreementValue: number;
  collectedAmount: number;
  outstanding: number;
};

export type CollectionsDashboardData = {
  kpis: CollectionsDashboardKpis;
  aging: CollectionsAgingBucket[];
  trend: CollectionsTrendRow[];
  byProject: CollectionsByProjectRow[];
};

const AGING_BUCKETS = [
  { label: "0–30 days", minDays: 0, maxDays: 30 },
  { label: "31–60 days", minDays: 31, maxDays: 60 },
  { label: "61–90 days", minDays: 61, maxDays: 90 },
  { label: "90+ days", minDays: 91, maxDays: Infinity },
];

/**
 * Collections dashboard: outstanding vs collected across active bookings,
 * an overdue aging breakdown, a monthly collections trend, and a per-project
 * rollup. Optionally filtered by project and receipt date range.
 */
export const getCollectionsDashboard = query({
  args: {
    projectId: v.optional(v.id("projects")),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<CollectionsDashboardData> => {
    const user = await requireModuleAccess(ctx, "collections");
    const ownerId = effectiveOwnerId(user);

    const [bookings, receipts, units, installments, projects] = await Promise.all([
      ctx.db.query("bookings").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("receipts").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("units").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("paymentInstallments").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("projects").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
    ]);

    const unitMap = new Map(units.map((u) => [u._id, u]));
    const projectMap = new Map(projects.map((p) => [p._id, p.name]));

    // Active bookings, optionally scoped to a single project (snapshot — not date filtered).
    const scopedBookings = bookings.filter((b) => {
      if (b.status !== "active") return false;
      if (args.projectId) {
        const unit = unitMap.get(b.unitId);
        if (!unit || unit.projectId !== args.projectId) return false;
      }
      return true;
    });
    const scopedBookingIds = new Set(scopedBookings.map((b) => b._id));

    const receiptByBooking = new Map<string, number>();
    for (const r of receipts) {
      if (!scopedBookingIds.has(r.bookingId)) continue;
      receiptByBooking.set(r.bookingId, (receiptByBooking.get(r.bookingId) ?? 0) + r.amount);
    }

    const totalAgreementValue = scopedBookings.reduce((s, b) => s + b.agreementValue, 0);
    const totalCollected = [...receiptByBooking.values()].reduce((s, v) => s + v, 0);
    const totalOutstanding = Math.max(0, totalAgreementValue - totalCollected);
    const collectionRate =
      totalAgreementValue > 0 ? Math.round((totalCollected / totalAgreementValue) * 100) : 0;

    // ── Overdue / upcoming + aging (based on unpaid installments on scoped bookings) ──
    const now = new Date();
    const nowIso = now.toISOString();
    const upcomingCutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const scopedInstallments = installments.filter((i) => scopedBookingIds.has(i.bookingId));
    const overdueInstallments = scopedInstallments.filter(
      (i) => i.status !== "paid" && i.dueDate !== undefined && i.dueDate < nowIso,
    );
    const upcomingInstallments = scopedInstallments.filter(
      (i) => i.status !== "paid" && i.dueDate !== undefined && i.dueDate >= nowIso && i.dueDate <= upcomingCutoff,
    );

    const aging: CollectionsAgingBucket[] = AGING_BUCKETS.map((bucket) => ({
      label: bucket.label,
      count: 0,
      amount: 0,
    }));
    for (const inst of overdueInstallments) {
      const daysOverdue = Math.floor((now.getTime() - new Date(inst.dueDate!).getTime()) / (24 * 60 * 60 * 1000));
      const bucketIndex = AGING_BUCKETS.findIndex((b) => daysOverdue >= b.minDays && daysOverdue <= b.maxDays);
      const target = aging[bucketIndex === -1 ? aging.length - 1 : bucketIndex];
      target.count += 1;
      target.amount += inst.amount;
    }

    // ── Monthly collections trend (receipts within optional date range) ──────────
    const inRange = (dateIso: string) =>
      (!args.fromDate || dateIso >= args.fromDate) && (!args.toDate || dateIso <= args.toDate);
    const scopedReceiptsInRange = receipts.filter(
      (r) => scopedBookingIds.has(r.bookingId) && inRange(r.paymentDate),
    );
    const trendMap = new Map<string, CollectionsTrendRow>();
    for (const r of scopedReceiptsInRange) {
      const key = monthKey(r.paymentDate);
      const entry = trendMap.get(key) ?? { month: monthLabel(r.paymentDate), sortKey: key, collectedAmount: 0 };
      entry.collectedAmount += r.amount;
      trendMap.set(key, entry);
    }
    const trend = [...trendMap.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(-12);

    // ── By project ─────────────────────────────────────────────────────────────
    const byProjectMap = new Map<Id<"projects">, CollectionsByProjectRow>();
    for (const b of scopedBookings) {
      const unit = unitMap.get(b.unitId);
      if (!unit) continue;
      const entry = byProjectMap.get(unit.projectId) ?? {
        projectId: unit.projectId,
        name: projectMap.get(unit.projectId) ?? "—",
        agreementValue: 0,
        collectedAmount: 0,
        outstanding: 0,
      };
      const collected = receiptByBooking.get(b._id) ?? 0;
      entry.agreementValue += b.agreementValue;
      entry.collectedAmount += collected;
      entry.outstanding += Math.max(0, b.agreementValue - collected);
      byProjectMap.set(unit.projectId, entry);
    }
    const byProject = [...byProjectMap.values()].sort((a, b) => b.outstanding - a.outstanding);

    return {
      kpis: {
        totalAgreementValue,
        totalCollected,
        totalOutstanding,
        collectionRate,
        overdueCount: overdueInstallments.length,
        overdueAmount: overdueInstallments.reduce((s, i) => s + i.amount, 0),
        upcomingCount: upcomingInstallments.length,
        upcomingAmount: upcomingInstallments.reduce((s, i) => s + i.amount, 0),
      },
      aging,
      trend,
      byProject,
    };
  },
});

export type ProjectCostRow = {
  projectId: Id<"projects">;
  name: string;
  budget: number | null;
  spent: number;
  remaining: number | null;
  overallProgress: number;
  stageCount: number;
};

export const getProjectCostSummary = query({
  args: {},
  handler: async (ctx): Promise<ProjectCostRow[]> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const [projects, expenses, stages] = await Promise.all([
      ctx.db.query("projects").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("projectExpenses").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
      ctx.db.query("constructionStages").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect(),
    ]);

    return projects.map((p) => {
      const projectExpenses = expenses.filter((e) => e.projectId === p._id);
      const projectStages = stages.filter((s) => s.projectId === p._id);
      const spent = projectExpenses.reduce((s, e) => s + e.amount, 0);
      const overallProgress =
        projectStages.length === 0
          ? 0
          : Math.round(projectStages.reduce((s, st) => s + st.percentComplete, 0) / projectStages.length);

      return {
        projectId: p._id,
        name: p.name,
        budget: p.constructionBudget ?? null,
        spent,
        remaining: p.constructionBudget != null ? p.constructionBudget - spent : null,
        overallProgress,
        stageCount: projectStages.length,
      };
    });
  },
});
