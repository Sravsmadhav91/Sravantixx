import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { FileSignature, Plus, MoreHorizontal, Link2, Pencil, Trash2, Unlink, AlertTriangle } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
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
import { useMigrationSubcontracts } from "@/hooks/use-migration-subcontracts.ts";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";
import SubcontractDialog from "./_components/subcontract-dialog.tsx";
import LinkInvoiceDialog from "./_components/link-invoice-dialog.tsx";
import MigrationSubcontractDialog from "./_components/migration-subcontract-dialog.tsx";

function MigrationSubcontractsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<any | null>(null);
  return (
    <>
      <MigrationSubcontractsContent onEdit={(contract) => setEditingContract(contract)} />
      <Button className="fixed bottom-6 right-6 z-20 shadow-lg" onClick={() => setCreateOpen(true)}>
        <Plus className="size-4" /> New subcontract
      </Button>
      <MigrationSubcontractDialog open={createOpen || !!editingContract} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditingContract(null); } }} editing={editingContract} />
    </>
  );
}

/*
function MigrationSubcontractsContent({ onEdit }: { onEdit: (contract: any) => void }) {
  const { contracts, error } = useMigrationSubcontracts();
  if (error) return <div className="p-8 text-sm text-destructive">{error.message}</div>;
  if (contracts === undefined) return <div className="mx-auto w-full max-w-4xl space-y-4 p-4 md:p-8"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>;
  return <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8"><div className="flex flex-wrap items-end justify-between gap-3"><div className="space-y-1"><h1 className="font-serif text-3xl font-semibold tracking-tight">Subcontracts</h1><p className="text-sm text-muted-foreground">Track total contract value, payments made, and balance due per subcontractor.</p></div></div>{contracts.length === 0 ? <Empty><EmptyHeader><EmptyMedia variant="icon"><FileSignature /></EmptyMedia><EmptyTitle>No subcontracts yet</EmptyTitle><EmptyDescription>Record a subcontractor's agreed contract value to start tracking payments.</EmptyDescription></EmptyHeader></Empty> : <div className="space-y-2">{contracts.map((c) => <div key={c._id} className="rounded-lg border border-border bg-card px-4 py-3"><div className="flex flex-wrap items-start justify-between gap-3"><button type="button" className="min-w-0 flex-1 space-y-1 text-left"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{c.title}</span>{!c.isActive && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}{!c.vendorPan && <Badge className="gap-1 bg-amber-500/15 text-[10px] text-amber-600 dark:text-amber-400"><AlertTriangle className="size-3" /> Vendor missing PAN</Badge>}</div><p className="text-xs text-muted-foreground">{c.vendorName} · {c.projectName}</p><div className="flex items-center gap-2 pt-1"><div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${c.contractValue > 0 ? Math.min(100, (c.paidAmount / c.contractValue) * 100) : 0}%` }} /></div><span className="text-[11px] text-muted-foreground">{formatCompactInr(c.paidAmount)} of {formatCompactInr(c.contractValue)} paid</span></div></button><div className="flex items-center gap-2"><Button size="sm" variant="ghost" onClick={() => onEdit(c)}>Edit</Button><div className="text-right"><p className="text-xs text-muted-foreground">Balance</p><p className={cn("font-mono text-sm font-semibold tabular-nums", c.balance > 0.01 ? "text-amber-600" : "text-green-600")}>{formatCompactInr(c.balance)}</p></div></div></div></div>)}</div>}</div>;
}
*/

function MigrationSubcontractsContent({ onEdit }: { onEdit: (contract: any) => void }) {
  const { contracts, error } = useMigrationSubcontracts();
  if (error) return <div className="p-8 text-sm text-destructive">{error.message}</div>;
  if (contracts === undefined) return <div className="mx-auto w-full max-w-4xl space-y-4 p-4 md:p-8"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>;
  return <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8"><div><h1 className="font-serif text-3xl font-semibold tracking-tight">Subcontracts</h1><p className="text-sm text-muted-foreground">Track total contract value, payments made, and balance due per subcontractor.</p></div>{contracts.length === 0 ? <Empty><EmptyHeader><EmptyMedia variant="icon"><FileSignature /></EmptyMedia><EmptyTitle>No subcontracts yet</EmptyTitle><EmptyDescription>Record a subcontractor's agreed contract value to start tracking payments.</EmptyDescription></EmptyHeader></Empty> : <div className="space-y-2">{contracts.map((contract) => <div key={contract._id} className="rounded-lg border border-border bg-card px-4 py-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{contract.title}</p><p className="text-xs text-muted-foreground">{contract.vendorName} · {contract.projectName}</p><p className="mt-2 text-xs text-muted-foreground">{formatCompactInr(contract.paidAmount)} of {formatCompactInr(contract.contractValue)} paid</p></div><div className="flex items-center gap-2"><div className="text-right"><p className="text-xs text-muted-foreground">Balance</p><p className="font-mono text-sm font-semibold text-amber-600">{formatCompactInr(contract.balance)}</p></div><Button size="sm" variant="ghost" onClick={() => onEdit(contract)}>Edit</Button></div></div></div>)}</div>}</div>;
}

function SubcontractsInner() {
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; id: Id<"subcontracts"> } | null>(null);
  const [linkDialog, setLinkDialog] = useState<{
    subcontractId: Id<"subcontracts">;
    vendorId: Id<"vendors">;
  } | null>(null);
  const [expanded, setExpanded] = useState<Id<"subcontracts"> | null>(null);
  const [deleteId, setDeleteId] = useState<Id<"subcontracts"> | null>(null);

  const contracts = useQuery(api.subcontracts.listSubcontracts, {});
  const detail = useQuery(
    api.subcontracts.getSubcontract,
    expanded ? { subcontractId: expanded } : "skip",
  );
  const deleteSubcontract = useMutation(api.subcontracts.deleteSubcontract);
  const unlinkInvoice = useMutation(api.subcontracts.unlinkInvoiceFromSubcontract);

  const editingContract =
    dialog?.mode === "edit" ? contracts?.find((c) => c._id === dialog.id) ?? null : null;

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteSubcontract({ subcontractId: deleteId });
      toast.success("Subcontract deleted");
      setDeleteId(null);
    } catch (error) {
      toast.error(error instanceof ConvexError ? (error.data as { message: string }).message : "Could not delete");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Subcontracts</h1>
          <p className="text-sm text-muted-foreground">
            Track total contract value, payments made, and balance due per subcontractor.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialog({ mode: "create" })}>
          <Plus className="size-4" /> New subcontract
        </Button>
      </div>

      {contracts === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileSignature />
            </EmptyMedia>
            <EmptyTitle>No subcontracts yet</EmptyTitle>
            <EmptyDescription>Record a subcontractor's agreed contract value to start tracking payments.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => setDialog({ mode: "create" })}>
              <Plus className="size-4" /> New subcontract
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-2">
          {contracts.map((c) => {
            const isOpen = expanded === c._id;
            const pct = c.contractValue > 0 ? Math.min(100, (c.paidAmount / c.contractValue) * 100) : 0;
            return (
              <div key={c._id} className="rounded-lg border border-border bg-card px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 space-y-1 text-left"
                    onClick={() => setExpanded(isOpen ? null : c._id)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.title}</span>
                      {!c.isActive && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                      {!c.vendorPan && (
                        <Badge className="gap-1 bg-amber-500/15 text-[10px] text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="size-3" /> Vendor missing PAN
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.vendorName} · {c.projectName}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {formatCompactInr(c.paidAmount)} of {formatCompactInr(c.contractValue)} paid
                      </span>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p
                        className={cn(
                          "font-mono text-sm font-semibold tabular-nums",
                          c.balance > 0.01 ? "text-amber-600" : "text-green-600",
                        )}
                      >
                        {formatCompactInr(c.balance)}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setLinkDialog({ subcontractId: c._id, vendorId: c.vendorId })}>
                          <Link2 className="size-4 mr-2" /> Link invoice
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDialog({ mode: "edit", id: c._id })}>
                          <Pencil className="size-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(c._id)}>
                          <Trash2 className="size-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-3 border-t border-border pt-3">
                    {detail === undefined ? (
                      <Skeleton className="h-10 w-full" />
                    ) : detail && detail.invoices.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No invoices linked yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Linked invoices
                        </p>
                        {detail?.invoices.map((inv) => (
                          <div key={inv._id} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {inv.internalRef} · {formatDate(inv.date)}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono tabular-nums">{formatCompactInr(inv.total)}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 text-muted-foreground hover:text-destructive"
                                onClick={async () => {
                                  try {
                                    await unlinkInvoice({ linkId: inv.linkId });
                                    toast.success("Invoice unlinked");
                                  } catch {
                                    toast.error("Could not unlink invoice");
                                  }
                                }}
                              >
                                <Unlink className="size-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SubcontractDialog
        open={!!dialog}
        onOpenChange={(v) => {
          if (!v) setDialog(null);
        }}
        editing={editingContract}
      />
      <LinkInvoiceDialog
        open={!!linkDialog}
        onOpenChange={(v) => {
          if (!v) setLinkDialog(null);
        }}
        subcontractId={linkDialog?.subcontractId}
        vendorId={linkDialog?.vendorId}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this subcontract?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the contract and its linked invoice records. Purchase invoices themselves are not deleted.
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

export default function SubcontractsPage() {
  if (migrationApiEnabled) {
    return <MigrationSubcontractsPage />;
  }
  return (
    <>
      <AuthLoading>
        <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
          <Skeleton className="h-20 w-full" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="mx-auto w-full max-w-4xl p-8">
          <SignInButton />
        </div>
      </Unauthenticated>
      <Authenticated>
        <SubcontractsInner />
      </Authenticated>
    </>
  );
}




