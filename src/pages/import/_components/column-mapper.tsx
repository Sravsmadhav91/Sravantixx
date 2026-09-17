/**
 * ColumnMapper — lets users map their own column headers to system fields.
 * Works for any spreadsheet regardless of column names / order.
 */
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";

export type FieldDef = {
  key: string;
  label: string;
  required: boolean;
  description?: string;
  /** Alternative header names used for auto-detection */
  aliases?: string[];
  /** Hint shown under the field label */
  hint?: string;
};

type Props = {
  fields: FieldDef[];
  fileHeaders: string[];
  sampleRows: Record<string, unknown>[];
  mapping: Record<string, string>; // fieldKey → fileHeader
  onChange: (mapping: Record<string, string>) => void;
};

// ── Auto-detect initial mapping ───────────────────────────────────────────────

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function buildAutoMapping(
  fields: FieldDef[],
  headers: string[],
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalHeaders = headers.map((h) => norm(h));

  for (const field of fields) {
    const candidates = [field.key, ...(field.aliases ?? [])].map(norm);
    for (const candidate of candidates) {
      const idx = normalHeaders.findIndex(
        (h) => h === candidate || h.includes(candidate) || candidate.includes(h),
      );
      if (idx !== -1 && !Object.values(mapping).includes(headers[idx])) {
        mapping[field.key] = headers[idx];
        break;
      }
    }
  }
  return mapping;
}

// ── Apply a mapping to a raw row (renames keys) ───────────────────────────────

export function applyMapping(
  row: Record<string, unknown>,
  mapping: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row }; // keep all original keys too
  for (const [field, col] of Object.entries(mapping)) {
    if (col) out[field] = row[col];
  }
  return out;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ColumnMapper({ fields, fileHeaders, sampleRows, mapping, onChange }: Props) {
  const headerOptions = [
    { value: "", label: "— ignore —" },
    ...fileHeaders.map((h) => ({ value: h, label: h })),
  ];

  const unmapped = fields.filter((f) => f.required && !mapping[f.key]);

  return (
    <div className="space-y-4">
      {unmapped.length > 0 && (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Map all required fields (<span className="text-destructive font-semibold">*</span>) to continue.
        </div>
      )}

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium w-[180px]">System field</th>
              <th className="px-3 py-2 text-left font-medium">Your column</th>
              <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">Sample values</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {fields.map((field) => {
              const mapped = mapping[field.key] ?? "";
              const samples = mapped
                ? sampleRows
                    .map((r) => String(r[mapped] ?? "").trim())
                    .filter(Boolean)
                    .slice(0, 3)
                : [];

              return (
                <tr key={field.key} className={cn(!mapped && field.required && "bg-destructive/3")}>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-start gap-1">
                      <span className="font-medium leading-tight">{field.label}</span>
                      {field.required && (
                        <span className="text-destructive font-bold text-xs mt-0.5">*</span>
                      )}
                    </div>
                    {field.hint && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{field.hint}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top w-[200px]">
                    <SearchableSelect
                      value={mapped}
                      onValueChange={(v) => onChange({ ...mapping, [field.key]: v })}
                      options={headerOptions}
                      placeholder="— ignore —"
                      searchPlaceholder="Search columns…"
                      allowClear
                      clearLabel="— ignore —"
                      triggerClassName={cn(
                        "w-full",
                        !mapped && field.required && "border-destructive/50",
                      )}
                    />
                  </td>
                  <td className="px-3 py-2 align-top hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {samples.map((s, i) => (
                        <Badge key={i} variant="secondary" className="font-mono text-[10px] max-w-[120px] truncate">
                          {s}
                        </Badge>
                      ))}
                      {!mapped && (
                        <span className="text-xs text-muted-foreground italic">not mapped</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
