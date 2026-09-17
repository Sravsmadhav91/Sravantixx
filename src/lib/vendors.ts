export const VENDOR_CATEGORIES = [
  { value: "contractor", label: "Contractor" },
  { value: "material_supplier", label: "Material Supplier" },
  { value: "consultant", label: "Consultant" },
  { value: "utility", label: "Utility" },
  { value: "legal", label: "Legal & Professional" },
  { value: "labour", label: "Labour / Manpower" },
  { value: "other", label: "Other" },
] as const;

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number]["value"];

export const VENDOR_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  VENDOR_CATEGORIES.map((c) => [c.value, c.label]),
);

export const PO_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_received: "Partially Received",
  received: "Received",
  cancelled: "Cancelled",
};

export const PO_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  partially_received: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  received: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-destructive/10 text-destructive",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  paid: "Paid",
  cancelled: "Cancelled",
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-destructive/10 text-destructive",
};
