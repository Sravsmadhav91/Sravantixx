export const MATERIAL_REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  ordered: "Ordered",
};

export const MATERIAL_REQUEST_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  rejected: "bg-destructive/10 text-destructive",
  ordered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};
