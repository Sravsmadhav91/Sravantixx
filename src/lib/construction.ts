export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  material: "Material",
  labour: "Labour",
  approvals: "Approvals",
  legal: "Legal",
  marketing: "Marketing",
  other: "Other",
};

export const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  material: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  labour: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  approvals: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  legal: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  marketing: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  other: "bg-muted text-muted-foreground",
};

export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as Array<
  keyof typeof EXPENSE_CATEGORY_LABELS
>;

/** Progress ring colour based on % */
export function progressColor(pct: number): string {
  if (pct >= 100) return "text-primary";
  if (pct >= 60) return "text-primary/80";
  if (pct >= 30) return "text-yellow-500";
  return "text-muted-foreground";
}
