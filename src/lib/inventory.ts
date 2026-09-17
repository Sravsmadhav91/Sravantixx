export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  opening: "Opening Stock",
  purchase_in: "Purchase Receipt",
  consumption_out: "Consumption",
  adjustment_in: "Adjustment In",
  adjustment_out: "Adjustment Out",
  transfer_in: "Transfer In",
  transfer_out: "Transfer Out",
};

export const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  opening: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  purchase_in: "bg-green-500/15 text-green-700 dark:text-green-300",
  consumption_out: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  adjustment_in: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  adjustment_out: "bg-red-500/15 text-red-700 dark:text-red-300",
  transfer_in: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  transfer_out: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
};

export const COMMON_STOCK_UNITS = [
  "Bags",
  "Kg",
  "Tonnes",
  "Cum",
  "Sqft",
  "Nos",
  "Ltr",
  "Rmt",
  "Box",
  "Bundle",
];
