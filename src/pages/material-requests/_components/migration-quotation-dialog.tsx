import { useRef, useState } from "react";
import { Camera, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadMigrationDocument } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";

type Props = { request: { _id: string; requestNumber: string; projectName?: string } | null; open: boolean; onOpenChange: (open: boolean) => void };

export default function MigrationQuotationDialog({ request, open, onOpenChange }: Props) {
  const browseInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const chooseFile = (selected: File | undefined) => {
    if (!selected) return;
    if (selected.size > 20 * 1024 * 1024) { toast.error("Quotation file must be 20 MB or smaller"); return; }
    setFile(selected);
  };
  const upload = async () => {
    if (!request || !file) return;
    setUploading(true);
    try {
      await uploadMigrationDocument({ linkedType: "materialRequest", linkedId: request._id, linkedName: `${request.requestNumber} - ${request.projectName ?? "Material Request"}`, file, docType: "other", label: `Quotation - ${file.name}` });
      toast.success("Quotation uploaded");
      setFile(null);
      onOpenChange(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not upload quotation"); }
    finally { setUploading(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Upload quotation</DialogTitle><p className="text-sm text-muted-foreground">Attach a vendor quotation to {request?.requestNumber}. Excel, PDF, and photos are supported.</p></DialogHeader><div className="grid grid-cols-2 gap-3"><Button type="button" variant="secondary" className="h-28 flex-col" onClick={() => cameraInput.current?.click()}><Camera className="size-6" />Scan quotation</Button><Button type="button" variant="secondary" className="h-28 flex-col" onClick={() => browseInput.current?.click()}><Upload className="size-6" />Choose file</Button></div><input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0])} /><input ref={browseInput} type="file" accept=".xlsx,.xls,application/pdf,image/*" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0])} />{file && <div className="flex items-center gap-2 rounded-md border p-3 text-sm">{file.type.includes("sheet") || /\.xls/i.test(file.name) ? <FileSpreadsheet className="size-4 text-emerald-600" /> : <FileText className="size-4 text-primary" />}<span className="min-w-0 flex-1 truncate">{file.name}</span><Button size="sm" variant="ghost" onClick={() => setFile(null)}>Remove</Button></div>}<DialogFooter><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void upload()} disabled={!file || uploading}>{uploading ? "Uploading..." : "Upload quotation"}</Button></DialogFooter></DialogContent></Dialog>;
}
