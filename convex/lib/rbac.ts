import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireUser } from "./auth.ts";

/** Every module in the app that can be gated by role. Mirrors the sidebar nav sections. */
export const MODULES = [
  "dashboard",
  "salesDashboard",
  "projects",
  "buyers",
  "bookings",
  "collections",
  "construction",
  "materialRequests",
  "subcontracts",
  "labour",
  "loans",
  "leads",
  "tasks",
  "documents",
  "accounting",
  "payables",
  "banking",
  "inventory",
  "gst",
  "payroll",
  "tds",
  "import",
  "reports",
  "settings",
] as const;

export type Module = (typeof MODULES)[number];

/** Scoped roles that are restricted to a fixed module set. "owner" and "staff" are handled separately. */
export type ScopedRole = "accountant" | "sales" | "site_engineer" | "site_supervisor" | "project_manager";

export const SCOPED_ROLES: ScopedRole[] = ["accountant", "sales", "project_manager", "site_supervisor", "site_engineer"];

export const ROLE_LABELS: Record<"owner" | "staff" | ScopedRole, string> = {
  owner: "Owner",
  staff: "Staff (all modules)",
  accountant: "Accountant",
  sales: "Sales",
  project_manager: "Project Manager",
  site_supervisor: "Site Supervisor",
  site_engineer: "Site Engineer",
};

export const ROLE_DESCRIPTIONS: Record<"owner" | "staff" | ScopedRole, string> = {
  owner: "Full read + write access, can delete records, manages the team.",
  staff: "Full read + write access to every module. Cannot delete records.",
  accountant: "Accounting, Payables, Banking, GST Returns, TDS Filing, Payroll, Subcontracts, Loans, and Reports only.",
  sales: "Sales Dashboard, Buyers, Bookings, Collections, Leads, and Tasks only.",
  project_manager: "Projects, Construction, Material Requests, Inventory, Payables, and Purchase Order approvals.",
  site_supervisor: "Projects, Construction, Material Requests, Labour, Inventory, Tasks, and Documents only.",
  site_engineer: "Projects, Construction, Material Requests, Labour, and Inventory, and Tasks only.",
};

/** Modules each scoped role can access. Dashboard, Tasks, and Documents are shared across all roles. */
const SCOPED_ROLE_MODULES: Record<ScopedRole, Module[]> = {
  accountant: ["dashboard", "accounting", "payables", "banking", "gst", "tds", "payroll", "subcontracts", "loans", "reports", "tasks", "documents", "settings"],
  sales: ["dashboard", "salesDashboard", "buyers", "bookings", "collections", "leads", "tasks", "documents", "settings"],
  project_manager: ["dashboard", "projects", "construction", "materialRequests", "inventory", "payables", "subcontracts", "labour", "tasks", "documents", "reports", "settings"],
  site_supervisor: ["dashboard", "projects", "construction", "materialRequests", "labour", "inventory", "tasks", "documents"],
  site_engineer: ["dashboard", "projects", "construction", "materialRequests", "labour", "inventory", "tasks", "documents", "settings"],
};

/** Returns the set of modules a user's role can access. Owner and staff get every module. */
export function modulesForRole(role: Doc<"users">["role"]): Module[] {
  if (!role || role === "owner" || role === "staff") {
    return [...MODULES];
  }
  return SCOPED_ROLE_MODULES[role];
}

/** Whether a user's role grants access to a given module. */
export function canAccessModule(role: Doc<"users">["role"], mod: Module): boolean {
  return modulesForRole(role).includes(mod);
}

/**
 * Requires the signed-in user to have access to `mod`. Throws FORBIDDEN otherwise.
 * Staff acting on behalf of an owner are checked using their own scoped role, not the owner's.
 */
export async function requireModuleAccess(
  ctx: QueryCtx | MutationCtx,
  mod: Module,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!canAccessModule(user.role, mod)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You don't have access to this section. Contact your account owner.",
    });
  }
  return user;
}
