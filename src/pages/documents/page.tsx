import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { useMigrationDocuments } from "@/hooks/use-migration-documents.ts";
import {
  Download,
  Eye,
  File,
  FileImage,
  FileText,
  FolderOpen,
  Pencil,
  Trash2,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { DOC_TYPE_LABELS, DOC_TYPE_OPTIONS, formatFileSize, isPreviewable, type DocType } from "@/lib/documents.ts";
import { formatDate } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";
import { useRole } from "@/hooks/use-role.ts";
import EditDocumentDialog from "@/components/documents/edit-document-dialog.tsx";
import { useDebounce } from "@/hooks/use-debounce.ts";

type DocumentWithUrl = Doc<"documents"> & { url: string | null };

const TYPE_COLORS: Record<string, string> = {
  sale_agreement: "bg-primary/10 text-primary",
  possession_letter: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  noc: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  demand_notice: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  receipt: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  identity: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  other: "bg-muted text-muted-foreground",
};

function entityLink(linkedType: string, linkedId: string) {
  if (linkedType === "buyer") return `/buyers/${linkedId}`;
  if (linkedType === "booking") return `/collections/${linkedId}`;
  if (linkedType === "project") return `/projects/${linkedId}`;
  return "#";
}

function entityLabel(linkedType: string) {
  if (linkedType === "buyer") return "Buyer";
  if (linkedType === "booking") return "Booking";
  if (linkedType === "project") return "Project";
  return linkedType;
}

function DocIcon({ contentType }: { contentType?: string }) {
  if (!contentType) return <File className="size-4 text-muted-foreground" />;
  if (contentType.startsWith("image/")) return <FileImage className="size-4 text-primary" />;
  if (contentType === "application/pdf") return <FileText className="size-4 text-red-500" />;
  return <File className="size-4 text-muted-foreground" />;
}

function MigrationDocumentsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocType | "all">("all");
  const { docs, error } = useMigrationDocuments(search, typeFilter === "all" ? undefined : typeFilter);

  if (error) return <div className="p-8 text-sm text-destructive">{error.message}</div>;
  if (docs === undefined) return <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documents</p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Document Library</h1>
          <p className="text-sm text-muted-foreground">All uploaded documents across buyers, bookings, and projects.</p>
        </div>
        <Button asChild variant="ghost" size="sm"><Link to="/dashboard">← Dashboard</Link></Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search by label…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as DocType | "all")}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {DOC_TYPE_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">{docs.length} document{docs.length !== 1 ? "s" : ""}</p>
      {docs.length === 0 ? (
        <Empty>
          <EmptyHeader><EmptyMedia variant="icon"><FolderOpen /></EmptyMedia><EmptyTitle>{search || typeFilter !== "all" ? "No documents match" : "No documents yet"}</EmptyTitle><EmptyDescription>{search || typeFilter !== "all" ? "Try adjusting your filters." : "Upload documents from buyer, booking, or project detail pages."}</EmptyDescription></EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground uppercase"><th className="px-4 py-2 text-left">Document</th><th className="px-4 py-2 text-left">Type</th><th className="px-4 py-2 text-left">Linked to</th><th className="px-4 py-2 text-left">Uploaded</th><th className="px-4 py-2 text-right">Size</th></tr></thead>
            <tbody className="divide-y divide-border">
              {docs.map((doc) => (
                <tr key={doc._id} className="group hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><DocIcon contentType={doc.contentType} /><span className="font-medium truncate max-w-[200px]">{doc.label ?? doc.fileName}</span></div></td>
                  <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TYPE_COLORS[doc.docType ?? "other"] ?? TYPE_COLORS.other)}>{DOC_TYPE_LABELS[(doc.docType ?? "other") as DocType]}</span></td>
                  <td className="px-4 py-3">{doc.linkedType && doc.linkedId ? <Link to={entityLink(doc.linkedType, doc.linkedId)} className="text-primary hover:underline text-xs">{entityLabel(doc.linkedType)}{doc.linkedName ? `: ${doc.linkedName}` : ""}</Link> : <span className="text-muted-foreground text-xs">—</span>}</td>
                  <td className="px-4 py-3 text-muted-foreground">{doc.uploadedAt ? formatDate(doc.uploadedAt) : "—"}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{doc.size != null ? formatFileSize(doc.size) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  if (migrationApiEnabled) return <MigrationDocumentsPage />;

  const { isOwner } = useRole();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const [typeFilter, setTypeFilter] = useState<DocType | "all">("all");
  const [editDoc, setEditDoc] = useState<DocumentWithUrl | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentWithUrl | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentWithUrl | null>(null);

  const docs = useQuery(api.documents.listAll, {
    search: debouncedSearch.trim() || undefined,
    docType: typeFilter === "all" ? undefined : typeFilter,
  });

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

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documents</p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Document Library</h1>
          <p className="text-sm text-muted-foreground">
            All uploaded documents across buyers, bookings, and projects.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard">← Dashboard</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by label…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as DocType | "all")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {DOC_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Count */}
      {docs !== undefined && (
        <p className="text-xs text-muted-foreground">{docs.length} document{docs.length !== 1 ? "s" : ""}</p>
      )}

      {/* List */}
      {docs === undefined ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : docs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><FolderOpen /></EmptyMedia>
            <EmptyTitle>{search || typeFilter !== "all" ? "No documents match" : "No documents yet"}</EmptyTitle>
            <EmptyDescription>
              {search || typeFilter !== "all"
                ? "Try adjusting your filters."
                : "Upload documents from buyer, booking, or project detail pages."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground uppercase">
                <th className="px-4 py-2 text-left">Document</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Linked to</th>
                <th className="px-4 py-2 text-left">Uploaded</th>
                <th className="px-4 py-2 text-right">Size</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {docs.map((doc) => (
                <tr key={doc._id} className="group hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <DocIcon contentType={doc.contentType} />
                      <span className="font-medium truncate max-w-[200px]">{doc.label ?? doc.fileName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TYPE_COLORS[doc.docType] ?? TYPE_COLORS.other)}>
                      {DOC_TYPE_LABELS[doc.docType as DocType]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {doc.linkedName ? (
                      <Link
                        to={entityLink(doc.linkedType, doc.linkedId)}
                        className="text-primary hover:underline text-xs"
                      >
                        {entityLabel(doc.linkedType)}: {doc.linkedName}
                      </Link>
                    ) : (
                      <Link
                        to={entityLink(doc.linkedType, doc.linkedId)}
                        className="text-muted-foreground hover:text-primary text-xs"
                      >
                        {entityLabel(doc.linkedType)}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(doc.uploadedAt)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                    {doc.size != null ? formatFileSize(doc.size) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isPreviewable(doc.contentType) && doc.url && (
                        <Button variant="ghost" size="icon" className="size-7" title="Preview" onClick={() => setPreviewDoc(doc)}>
                          <Eye className="size-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="size-7" title="Download" onClick={() => handleDownload(doc)}>
                        <Download className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" title="Edit" onClick={() => setEditDoc(doc)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      {isOwner && (
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" title="Delete" onClick={() => setDeleteDoc(doc)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editDoc && <EditDocumentDialog document={editDoc} onClose={() => setEditDoc(null)} />}

      {/* Preview */}
      {previewDoc && previewDoc.url && (
        <Dialog open onOpenChange={(o) => !o && setPreviewDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle className="text-base font-medium">{previewDoc.label ?? previewDoc.fileName}</DialogTitle>
            </DialogHeader>
            {previewDoc.contentType?.startsWith("image/") ? (
              <img src={previewDoc.url} alt={previewDoc.label ?? previewDoc.fileName} className="w-full h-full object-contain max-h-[75vh]" />
            ) : (
              <iframe src={previewDoc.url} className="w-full" style={{ height: "75vh" }} title={previewDoc.label ?? previewDoc.fileName} />
            )}
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={!!deleteDoc} onOpenChange={(o) => !o && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteDoc?.label ?? deleteDoc?.fileName}" will be permanently deleted and cannot be recovered.
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
