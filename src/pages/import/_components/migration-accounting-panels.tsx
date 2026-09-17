import { useRef, useState } from "react";
import { Camera, FileUp, ScanLine, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { parseImsFile, type ImsInvoiceRow } from "@/lib/ims-parser.ts";
import { importMigrationImsInvoices } from "@/lib/migration-api.ts";

function FileDrop({ accept, label, onFile, disabled }: { accept: string; label: string; onFile: (file: File) => void; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center hover:border-primary hover:bg-muted/30">
      <FileUp className="size-8 text-muted-foreground" />
      <span className="text-sm font-medium">{disabled ? "Reading file..." : label}</span>
      <span className="text-xs text-muted-foreground">Maximum file size: 20 MB</span>
      <input type="file" accept={accept} className="sr-only" disabled={disabled} onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0])} />
    </label>
  );
}

export function MigrationImsInvoicesPanel() {
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImsInvoiceRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<number | null>(null);

  const handleFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be smaller than 20 MB");
      return;
    }
    setReading(true);
    setFileName(file.name);
    try {
      const result = await parseImsFile(file);
      if (result.parseErrors.length > 0) throw new Error(result.parseErrors[0]);
      if (result.rows.length === 0) throw new Error("No B2B invoices found in this file");
      setRows(result.rows);
    } catch (error) {
      setRows([]);
      toast.error(error instanceof Error ? error.message : "Could not read IMS file");
    } finally {
      setReading(false);
    }
  };

  const taxable = rows.reduce((sum, row) => sum + (row.isCreditNote ? -1 : 1) * row.taxableValue, 0);
  const tax = rows.reduce((sum, row) => sum + (row.isCreditNote ? -1 : 1) * (row.integratedTax + row.centralTax + row.stateTax + row.cess), 0);

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await importMigrationImsInvoices(rows.map((row) => ({ ...row })));
      setImported(result.imported);
      toast.success(`Imported ${result.imported} entries${result.skippedDuplicates ? ` - ${result.skippedDuplicates} duplicates skipped` : ""}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import IMS entries");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ReceiptText className="size-4" /> GST Portal IMS - Vendor Purchases</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">Upload the monthly GST Portal IMS or GSTR-2B Excel export. The migration preview reads B2B invoices and credit notes, including their portal status.</p>
        {!rows.length && <FileDrop accept=".xlsx,.xls" label="Drop IMS Excel file or click to browse" onFile={(file) => void handleFile(file)} disabled={reading} />}
        {fileName && <Badge variant="secondary">{fileName}</Badge>}
        {rows.length > 0 && <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Invoices</p><p className="text-xl font-semibold">{rows.filter((row) => !row.isCreditNote).length}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Credit notes</p><p className="text-xl font-semibold">{rows.filter((row) => row.isCreditNote).length}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Net taxable</p><p className="text-xl font-semibold">₹{taxable.toLocaleString("en-IN")}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Net tax</p><p className="text-xl font-semibold">₹{tax.toLocaleString("en-IN")}</p></div>
          </div>
          <div className="overflow-x-auto rounded-lg border"><table className="w-full text-xs"><thead><tr className="border-b text-left text-muted-foreground"><th className="px-3 py-2">Vendor</th><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{rows.slice(0, 10).map((row) => <tr className="border-b last:border-0" key={`${row.gstin}-${row.invoiceNumber}`}><td className="px-3 py-2">{row.vendorName}</td><td className="px-3 py-2">{row.invoiceNumber}{row.isCreditNote && <Badge className="ml-2" variant="outline">Credit note</Badge>}</td><td className="px-3 py-2">{row.invoiceDate}</td><td className="px-3 py-2">{row.status}</td></tr>)}</tbody></table></div>
          {imported === null ? <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { setRows([]); setFileName(null); }}>Choose another file</Button><Button onClick={() => void handleImport()} disabled={importing}>{importing ? "Importing..." : `Import ${rows.length} entries`}</Button></div> : <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">Imported {imported} entries. Credit notes were stored as negative draft purchase invoices.</div>}
        </>}
      </CardContent>
    </Card>
  );
}

export function MigrationScanInvoicePanel() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File must be smaller than 15 MB");
      return;
    }
    setFileName(file.name);
    setOpen(false);
    toast.info("Invoice selected. Configure the AI backend to extract its fields.");
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ScanLine className="size-4" /> Scan Invoice (AI)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">Take a photo of a vendor invoice, or upload a PDF/image. AI extraction requires an OCR/AI provider key in the independent backend.</p>
        <Button onClick={() => setOpen(true)}><ScanLine className="size-4" /> Scan an invoice</Button>
        {fileName && <div className="flex items-center justify-between rounded-lg border p-3 text-sm"><Badge variant="secondary">{fileName}</Badge><Button variant="ghost" onClick={() => setFileName(null)}>Clear</Button></div>}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><ScanLine className="size-5 text-primary" /> Scan Purchase Invoice</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Take a photo of a vendor invoice, or upload a PDF/image. AI will read it and pre-fill the invoice for your review.</p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-primary hover:bg-muted/40">
                  <Camera className="size-7 text-muted-foreground" /><span className="text-sm font-medium">Take a photo</span><span className="text-xs text-muted-foreground">Mobile camera</span>
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-primary hover:bg-muted/40">
                  <FileUp className="size-7 text-muted-foreground" /><span className="text-sm font-medium">Upload file</span><span className="text-xs text-muted-foreground">Image or PDF · max 15 MB</span>
                </button>
              </div>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => handleFile(event.target.files?.[0])} />
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(event) => handleFile(event.target.files?.[0])} />
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
