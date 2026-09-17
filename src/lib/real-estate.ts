import type { Doc } from "@/convex/_generated/dataModel";

export type ProjectType = Doc<"projects">["type"];
export type ProjectStatus = Doc<"projects">["status"];
export type UnitStatus = Doc<"units">["status"];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  apartment: "Apartment",
  plotted: "Plotted layout",
  villa: "Villa",
  commercial: "Commercial",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  under_construction: "Under construction",
  ready: "Ready to move",
  completed: "Completed",
};

export const UNIT_STATUS_LABELS: Record<UnitStatus, string> = {
  available: "Available",
  on_hold: "On hold",
  booked: "Booked",
  sold: "Sold",
};

/** Tailwind classes per unit status, readable in light and dark mode. */
export const UNIT_STATUS_CLASSES: Record<UnitStatus, string> = {
  available:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  on_hold:
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  booked: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300",
  sold: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-300",
};

export const PROJECT_TYPES = Object.keys(PROJECT_TYPE_LABELS) as ProjectType[];
export const PROJECT_STATUSES = Object.keys(
  PROJECT_STATUS_LABELS,
) as ProjectStatus[];
export const UNIT_STATUSES = Object.keys(UNIT_STATUS_LABELS) as UnitStatus[];

/** Compact Indian money format used in dense tables and tiles. */
export function formatCompactInr(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${new Intl.NumberFormat("en-IN").format(Math.round(amount))}`;
}
