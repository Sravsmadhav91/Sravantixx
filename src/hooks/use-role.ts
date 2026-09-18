import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { migrationApiEnabled, migrationGet } from "@/lib/migration-api.ts";

export type UserRole = "owner" | "customer" | "staff" | "accountant" | "sales" | "site_engineer" | "site_supervisor" | "project_manager";

/** Modules each scoped role can access. Mirrors convex/lib/rbac.ts — keep in sync. */
const SCOPED_ROLE_MODULES: Record<"accountant" | "sales" | "site_engineer" | "site_supervisor" | "project_manager", string[]> = {
  accountant: ["dashboard", "accounting", "payables", "banking", "gst", "tds", "payroll", "subcontracts", "loans", "reports", "tasks", "documents", "settings"],
  sales: ["dashboard", "salesDashboard", "buyers", "bookings", "collections", "leads", "tasks", "documents", "settings"],
  project_manager: ["dashboard", "projects", "construction", "materialRequests", "inventory", "payables", "subcontracts", "labour", "tasks", "documents", "reports", "settings"],
  site_supervisor: ["dashboard", "projects", "construction", "materialRequests", "labour", "inventory", "tasks", "documents"],
  site_engineer: ["dashboard", "projects", "construction", "materialRequests", "labour", "inventory", "tasks", "documents", "settings"],
};

/** Returns the current user's role and helpers to check access. */
export function useRole() {
  const data = migrationApiEnabled ? undefined : useQuery(api.team.getMyRole);
  const [migrationRole, setMigrationRole] = useState<UserRole | undefined>();
  useEffect(() => {
    if (!migrationApiEnabled) return;
    let active = true;
    migrationGet<{ role: UserRole }>("/api/auth/me").then((result) => active && setMigrationRole(result.role)).catch(() => active && setMigrationRole("owner"));
    return () => { active = false; };
  }, []);
  const role: UserRole = (migrationRole ?? data?.role ?? "owner") as UserRole;
  const isOwner = migrationApiEnabled ? role === "owner" : data === undefined ? undefined : role === "owner";
  const isStaff = migrationApiEnabled ? false : data === undefined ? undefined : role === "staff";
  const isScoped = migrationApiEnabled ? false : data === undefined ? undefined : role in SCOPED_ROLE_MODULES;

  /** True if the current role can access the given module (nav path key, e.g. "accounting"). */
  const canAccess = (mod: string): boolean => {
    if (role === "owner" || role === "staff") return true;
    return SCOPED_ROLE_MODULES[role as "accountant" | "sales" | "site_engineer" | "site_supervisor" | "project_manager"]?.includes(mod) ?? false;
  };

  return {
    role,
    isOwner,
    isStaff,
    isScoped,
    canAccess,
    isLoading: migrationApiEnabled ? migrationRole === undefined : data === undefined,
  };
}
