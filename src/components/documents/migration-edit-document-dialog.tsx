import { useState } from "react";
import { toast } from "sonner";
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
import { DOC_TYPE_OPTIONS, type DocType } from "@/lib/documents.ts";
import { updateMigrationDocument, type MigrationDocument } from "@/lib/migration-api.ts";

type Props = {
  document: MigrationDocument;
  onClose: () => void;
  onUpdated: () => void;
};

export default function MigrationEditDocumentDialog({ document, onClose, onUpdated }: Props) {
  const [label, setLabel] = useState(document.label ?? document.fileName);
  const [docType, setDocType] = useState<DocType>((document.docType ?? "other") as DocType);
  const [notes, setNotes] = useState(document.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMigrationDocument(document._id, { label: label.trim(), docType, notes: notes.trim() || undefined });
      toast.success("Document updated");
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
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
            <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea rows={2} className="resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
