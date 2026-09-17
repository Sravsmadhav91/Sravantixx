import { useState } from "react";
import { ArrowRight, CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { parseSpreadsheetFile } from "@/lib/file-parser.ts";
import { applyMapping, buildAutoMapping, ColumnMapper, type FieldDef } from "./column-mapper.tsx";
import { createMigrationBuyer, createMigrationLead } from "@/lib/migration-api.ts";

type Kind = "buyers" | "leads";
type Row = Record<string, unknown>;

const configs: Record<Kind, { title: string; fields: FieldDef[] }> = {
  buyers: {
    title: "Buyers",
    fields: [
      { key: "name", label: "Full Name", required: true, aliases: ["buyer_name", "customer_name", "fullname", "buyer"] },
      { key: "phone", label: "Phone", required: true, aliases: ["mobile", "contact", "phone_number"] },
      { key: "email", label: "Email", required: false, aliases: ["email_address", "mail"] },
      { key: "pan", label: "PAN", required: false, aliases: ["pan_number", "pan_no"] },
      { key: "address", label: "Address", required: false, aliases: ["full_address", "addr"] },
      { key: "notes", label: "Notes", required: false, aliases: ["remarks", "comments"] },
    ],
  },
  leads: {
    title: "Leads",
    fields: [
      { key: "name", label: "Full Name", required: true, aliases: ["lead_name", "customer_name", "prospect"] },
      { key: "phone", label: "Phone", required: true, aliases: ["mobile", "contact", "phone_number"] },
      { key: "email", label: "Email", required: false, aliases: ["email_address", "mail"] },
      { key: "source", label: "Source", required: true, aliases: ["lead_source", "channel"] },
      { key: "status", label: "Status", required: true, aliases: ["lead_status", "stage"] },
      { key: "budget", label: "Budget", required: false, aliases: ["budget_amount", "price_range"] },
      { key: "project_interest", label: "Project Interest", required: false, aliases: ["project", "interested_in"] },
      { key: "notes", label: "Notes", required: false, aliases: ["remarks", "comments"] },
    ],
  },
};

function value(row: Row, key: string) {
  return String(row[key] ?? "").trim();
}

export default function MigrationCrmImportPanel({ kind }: { kind: Kind }) {
  const config = configs[kind];
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [stage, setStage] = useState<"idle" | "mapping" | "preview" | "importing" | "done">("idle");
  const [validRows, setValidRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [imported, setImported] = useState(0);

  const handleFile = async (selected: File) => {
    setFile(selected);
    const result = await parseSpreadsheetFile(selected);
    if (result.parseErrors.length) {
      toast.error(result.parseErrors[0]);
      return;
    }
    setRawRows(result.rows);
    setMapping(buildAutoMapping(config.fields, Object.keys(result.rows[0] ?? {})));
    setStage("mapping");
  };

  const validate = () => {
    const parsed = rawRows.map((row) => applyMapping(row, mapping));
    const rowErrors: string[] = [];
    const accepted = parsed.filter((row, index) => {
      const missing = config.fields.filter((field) => field.required && !value(row, field.key)).map((field) => field.label);
      if (missing.length) {
        rowErrors.push(`Row ${index + 2}: missing ${missing.join(", ")}`);
        return false;
      }
      return true;
    });
    setValidRows(accepted);
    setErrors(rowErrors);
    setStage("preview");
  };

  const importRows = async () => {
    setStage("importing");
    try {
      for (const row of validRows) {
        if (kind === "buyers") {
          await createMigrationBuyer({ name: value(row, "name"), phone: value(row, "phone"), email: value(row, "email") || undefined, pan: value(row, "pan") || undefined, address: value(row, "address") || undefined, notes: value(row, "notes") || undefined });
        } else {
          const source = ["walk_in", "referral", "advertisement", "website", "social_media", "other"].includes(value(row, "source")) ? value(row, "source") : "other";
          const status = ["new", "contacted", "site_visit", "negotiation", "won", "lost"].includes(value(row, "status")) ? value(row, "status") : "new";
          await createMigrationLead({ name: value(row, "name"), phone: value(row, "phone"), email: value(row, "email") || undefined, source, status, budget: value(row, "budget") ? Number(value(row, "budget").replace(/,/g, "")) : undefined, projectInterest: value(row, "project_interest") || undefined, notes: value(row, "notes") || undefined });
        }
      }
      setImported(validRows.length);
      setStage("done");
      toast.success(`Imported ${validRows.length} ${config.title.toLowerCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not import ${config.title.toLowerCase()}`);
      setStage("preview");
    }
  };

  return <Card><CardHeader><CardTitle>{config.title} Import</CardTitle></CardHeader><CardContent className="space-y-4">
    {stage === "idle" && <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center hover:border-primary hover:bg-muted/30"><Upload className="size-8 text-muted-foreground" /><span className="text-sm font-medium">Drop file here or click to browse</span><span className="text-xs text-muted-foreground">CSV, XLSX, XLS, or ODS</span><input type="file" accept=".csv,.xlsx,.xls,.ods" className="sr-only" onChange={(event) => event.target.files?.[0] && void handleFile(event.target.files[0])} /></label>}
    {file && stage !== "idle" && <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm"><FileText className="size-4 text-primary" /><span className="truncate">{file.name}</span><Badge variant="secondary">{rawRows.length} rows</Badge></div>}
    {stage === "mapping" && <div className="space-y-4"><p className="text-sm text-muted-foreground">Map the required fields before previewing the import.</p><ColumnMapper fields={config.fields} fileHeaders={Object.keys(rawRows[0] ?? {})} sampleRows={rawRows.slice(0, 5)} mapping={mapping} onChange={setMapping} /><Button onClick={validate}><ArrowRight className="size-4" />Preview import</Button></div>}
    {stage === "preview" && <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Valid rows</p><p className="text-xl font-semibold text-primary">{validRows.length}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Rows with errors</p><p className="text-xl font-semibold">{errors.length}</p></div></div>{errors.length > 0 && <div className="max-h-32 overflow-y-auto rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">{errors.slice(0, 10).map((error) => <p key={error}>{error}</p>)}</div>}<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setStage("idle")}>Choose another file</Button><Button onClick={() => void importRows()} disabled={!validRows.length}>Import {validRows.length} rows</Button></div></div>}
    {stage === "importing" && <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Importing {config.title.toLowerCase()}...</div>}
    {stage === "done" && <div className="flex flex-col items-center gap-3 py-8 text-center"><CheckCircle2 className="size-10 text-primary" /><p className="font-semibold">Import complete</p><p className="text-sm text-muted-foreground">{imported} {config.title.toLowerCase()} imported.</p><Button variant="secondary" onClick={() => { setStage("idle"); setFile(null); setRawRows([]); setValidRows([]); }}>Import another file</Button></div>}
  </CardContent></Card>;
}
