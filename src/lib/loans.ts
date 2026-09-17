export const LOAN_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  closed: "Closed",
};

export const LOAN_STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  closed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

export const INSTALLMENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};
