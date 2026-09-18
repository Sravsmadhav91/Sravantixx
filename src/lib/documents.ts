export const DOC_TYPE_LABELS = {
  sale_agreement: "Sale Agreement",
  sale_deed: "Sale Deed",
  possession_letter: "Possession Letter",
  noc: "NOC",
  demand_notice: "Demand Notice",
  receipt: "Receipt",
  identity: "Identity Document",
  other: "Other",
} as const;

export type DocType = keyof typeof DOC_TYPE_LABELS;

export const DOC_TYPE_OPTIONS = Object.entries(DOC_TYPE_LABELS).map(([value, label]) => ({
  value: value as DocType,
  label,
}));

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isPreviewable(contentType?: string): boolean {
  if (!contentType) return false;
  return (
    contentType.startsWith("image/") ||
    contentType === "application/pdf"
  );
}
