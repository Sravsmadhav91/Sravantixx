import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { DOC_TYPE_OPTIONS, type DocType, formatFileSize } from "@/lib/documents.ts";
import { uploadMigrationDocument } from "@/lib/migration-api.ts";
import { cn } from "@/lib/utils.ts";

type LinkedType = "buyer" | "booking" | "project";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  linkedType: LinkedType;
  linkedId: string;
  linkedName?: string;
  onUploaded: () => void;
};

export default function MigrationUploadDocumentDialog({ open, onOpenChange, linkedType, linkedId, linkedName, onUploaded }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocType>("other");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setFile(null);
    setDocType("other");
    setLabel("");
    setNotes("");
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleFileSelect = (f: File) => {
    setFile(f);
    if (!label) setLabel(f.name.replace(/\.[^.]+$/, ""));
    const name = f.name.toLowerCase();
    if (name.includes("agreement") || name.includes("sale")) setDocType("sale_agreement");
    else if (name.includes("possession")) setDocType("possession_letter");
    else if (name.includes("noc")) setDocType("noc");
    else if (name.includes("demand") || name.includes("notice")) setDocType("demand_notice");
    else if (name.includes("receipt") || name.includes("payment")) setDocType("receipt");
    else if (name.includes("pan") || name.includes("aadhaar") || name.includes("passport") || name.includes("id")) setDocType("identity");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadMigrationDocument({ linkedType, linkedId, linkedName, file, docType, label: label.trim() || file.name, notes: notes.trim() || undefined });
      toast.success("Document uploaded");
      onUploaded();
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload document{linkedName ? ` — ${linkedName}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
            )}
          >
            {file ? (
              <>
                <FileText className="size-8 text-primary" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="mt-1 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                >
                  Remove
                </button>
              </>
            ) : (
              <>
                <Upload className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Drop a file here or click to browse</p>
                <p className="text-xs text-muted-foreground">PDF, images, Word, Excel — any file up to 20 MB</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
          />

          <div className="space-y-1">
            <Label>Document type</Label>
            <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Label <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              placeholder="e.g. Sale Agreement – Tower A"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              rows={2}
              className="resize-none"
              placeholder="Any context…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button onClick={() => void handleUpload()} disabled={!file || uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
