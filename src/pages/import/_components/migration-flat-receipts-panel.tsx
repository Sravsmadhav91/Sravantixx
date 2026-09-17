import { useRef, useState } from "react";
import { FileUp, Receipt, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { parseFlatWiseWorkbook, type ParsedFlatBlock } from "@/lib/flat-receipts-import.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";

export default function MigrationFlatReceiptsPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [flats, setFlats] = useState<ParsedFlatBlock[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const totalPayments = flats.reduce((sum, flat) => sum + flat.payments.length, 0);
  const totalAmount = flats.reduce((sum, flat) => sum + flat.payments.reduce((subtotal, payment) => subtotal + payment.amount, 0), 0);

  const handleFile = async (file: File) => {
    setReading(true);
    setFileName(file.name);
    try {
      const parsed = parseFlatWiseWorkbook(await file.arrayBuffer());
      setFlats(parsed.flats);
      setWarnings(parsed.warnings);
      if (!parsed.flats.length) toast.error("Could not find any FLAT No. blocks in this file");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read workbook");
      setFlats([]);
    } finally {
      setReading(false);
    }
  };

  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="size-4" /> Import Receipts by Flat Number</CardTitle></CardHeader><CardContent className="space-y-4"><div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">Upload a “Flat Wise Payment Details” workbook. Each flat is a block beginning with a “FLAT No.” row followed by payment rows. The migration preview validates flat numbers and payment totals before import.</div><label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center hover:border-primary hover:bg-muted/30"><FileUp className="size-8 text-muted-foreground" /><span className="font-medium text-sm">{reading ? "Reading workbook..." : "Drop file here or click to browse"}</span><span className="text-xs text-muted-foreground">Excel (.xlsx / .xls) — max 20 MB</span><input ref={inputRef} type="file" accept=".xlsx,.xls" className="sr-only" disabled={reading} onChange={(event) => event.target.files?.[0] && void handleFile(event.target.files[0])} /></label>{fileName && <div className="flex flex-wrap items-center gap-2 text-sm"><Badge variant="secondary">{fileName}</Badge>{flats.length > 0 && <span className="text-muted-foreground">{flats.length} flats · {totalPayments} payments · ₹{totalAmount.toLocaleString("en-IN")}</span>}</div>}{warnings.length > 0 && <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800"><p className="flex items-center gap-1 font-medium"><AlertTriangle className="size-3.5" />Warnings</p>{warnings.slice(0, 5).map((warning) => <p key={warning}>{warning}</p>)}</div>}{flats.length > 0 && <div className="rounded-lg border"><div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium"><CheckCircle2 className="size-4 text-primary" />Preview ready</div><div className="max-h-56 overflow-y-auto divide-y">{flats.slice(0, 20).map((flat) => <div key={flat.flatNumber} className="flex items-center justify-between px-3 py-2 text-sm"><span>Flat {flat.flatNumber}</span><span className="text-muted-foreground">{flat.payments.length} payments · ₹{flat.payments.reduce((sum, payment) => sum + payment.amount, 0).toLocaleString("en-IN")}</span></div>)}</div></div>}<div className="flex justify-end"><Button disabled={!flats.length} onClick={() => toast.info("Receipt import is ready to connect to the migration backend.")}>Import receipts</Button></div></CardContent></Card>;
}
