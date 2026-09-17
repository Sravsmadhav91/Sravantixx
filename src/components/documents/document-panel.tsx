import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  Download,
  Eye,
  File,
  FileImage,
  FileText,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { DOC_TYPE_LABELS, formatFileSize, isPreviewable, type DocType } from "@/lib/documents.ts";
import { formatDate } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";
import { useRole } from "@/hooks/use-role.ts";
import UploadDocumentDialog from "./upload-document-dialog.tsx";
import EditDocumentDialog from "./edit-document-dialog.tsx";

type DocumentWithUrl = Doc<"documents"> & { url: string | null };
type LinkedType = "buyer" | "booking" | "project";

type Props = {
  linkedType: LinkedType;
  linkedId: string;
  linkedName?: string;
};

function DocTypeChip({ docType }: { docType: string }) {
  const TYPE_COLORS: Record<string, string> = {
    sale_agreement: "bg-primary/10 text-primary",
    possession_letter: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    noc: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    demand_notice: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    receipt: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    identity: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    other: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TYPE_COLORS[docType] ?? TYPE_COLORS.other)}>
      {DOC_TYPE_LABELS[docType as DocType] ?? docType}
    </span>
  );
}

function DocIcon({ contentType }: { contentType?: string }) {
  if (!contentType) return <File className="size-5 text-muted-foreground" />;
  if (contentType.startsWith("image/")) return <FileImage className="size-5 text-primary" />;
  if (contentType === "application/pdf") return <FileText className="size-5 text-red-500" />;
  return <File className="size-5 text-muted-foreground" />;
}

export default function DocumentPanel({ linkedType, linkedId, linkedName }: Props) {
  const { isOwner } = useRole();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<DocumentWithUrl | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentWithUrl | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentWithUrl | null>(null);

  const docs = useQuery(api.documents.listForEntity, { linkedType, linkedId });
  const deleteDocument = useMutation(api.documents.deleteDocument);

  const handleDelete = async () => {
    if (!deleteDoc) return;
    try {
      await deleteDocument({ documentId: deleteDoc._id });
      toast.success("Document deleted");
      setDeleteDoc(null);
    } catch (err) {
      toast.error(
        err instanceof ConvexError ? (err.data as { message: string }).message : "Could not delete",
      );
    }
  };

  const handleDownload = (doc: DocumentWithUrl) => {
    if (!doc.url) { toast.error("File URL not available"); return; }
    const a = document.createElement("a");
    a.href = doc.url;
    a.download = doc.fileName;
    a.target = "_blank";
    a.click();
  };

  if (docs === undefined) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {docs.length} document{docs.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" variant="secondary" onClick={() => setUploadOpen(true)}>
          <Plus className="size-3.5" /> Upload
        </Button>
      </div>

      {docs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><FileText /></EmptyMedia>
            <EmptyTitle>No documents yet</EmptyTitle>
            <EmptyDescription>Upload sale agreements, NOCs, receipts, and more.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-1.5">
          {docs.map((doc) => (
            <div
              key={doc._id}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors"
            >
              <DocIcon contentType={doc.contentType} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.label ?? doc.fileName}</p>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                  <DocTypeChip docType={doc.docType} />
                  <span className="text-xs text-muted-foreground">
                    {formatDate(doc.uploadedAt)}
                    {doc.size != null && ` · ${formatFileSize(doc.size)}`}
                  </span>
                </div>
                {doc.notes && <p className="mt-0.5 text-xs text-muted-foreground truncate">{doc.notes}</p>}
              </div>
              <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isPreviewable(doc.contentType) && doc.url && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    title="Preview"
                    onClick={() => setPreviewDoc(doc)}
                  >
                    <Eye className="size-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title="Download"
                  onClick={() => handleDownload(doc)}
                >
                  <Download className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title="Edit"
                  onClick={() => setEditDoc(doc)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    title="Delete"
                    onClick={() => setDeleteDoc(doc)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        linkedType={linkedType}
        linkedId={linkedId}
        linkedName={linkedName}
      />

      {editDoc && <EditDocumentDialog document={editDoc} onClose={() => setEditDoc(null)} />}

      {/* Preview dialog */}
      {previewDoc && previewDoc.url && (
        <Dialog open onOpenChange={(o) => !o && setPreviewDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle className="text-base font-medium">{previewDoc.label ?? previewDoc.fileName}</DialogTitle>
            </DialogHeader>
            {previewDoc.contentType?.startsWith("image/") ? (
              <img
                src={previewDoc.url}
                alt={previewDoc.label ?? previewDoc.fileName}
                className="w-full h-full object-contain max-h-[75vh]"
              />
            ) : (
              <iframe
                src={previewDoc.url}
                className="w-full"
                style={{ height: "75vh" }}
                title={previewDoc.label ?? previewDoc.fileName}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteDoc} onOpenChange={(o) => !o && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteDoc?.label ?? deleteDoc?.fileName}" will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
