import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { HardHat, Plus, MoreHorizontal, Pencil, Trash2, Wallet, AlertTriangle } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
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
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import { LABOUR_ENTRY_TYPE_LABELS, LABOUR_ENTRY_TYPE_COLORS } from "@/lib/labour.ts";
import { cn } from "@/lib/utils.ts";
import LabourerDialog from "./_components/labourer-dialog.tsx";
import LedgerEntryDialog from "./_components/ledger-entry-dialog.tsx";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { useMigrationLabourers } from "@/hooks/use-migration-labourers.ts";
import { createMigrationLabourer, createMigrationLabourEntry } from "@/lib/migration-api.ts";
import { useMigrationProjects } from "@/hooks/use-migration-projects.ts";
import MigrationLabourerEditDialog from "./_components/migration-labourer-edit-dialog.tsx";

function MigrationLabourPage() {
  const labourers = useMigrationLabourers();
  const projects = useMigrationProjects().projects;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "individual", memberCount: "1", skill: "", phone: "", pan: "", projectId: "", notes: "" });
  const [entryTarget, setEntryTarget] = useState<any>();
  const [editingLabourer, setEditingLabourer] = useState<any | null>(null);
  const [entryForm, setEntryForm] = useState({ type: "work", amount: "", date: new Date().toISOString().slice(0, 10), description: "" });
  const submit = async () => { if (!form.name.trim()) { toast.error("Name is required"); return; } try { await createMigrationLabourer({ ...form, memberCount: Number(form.memberCount || 1), projectId: form.projectId || undefined }); toast.success("Labourer added"); setDialogOpen(false); window.location.reload(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add labourer"); } };
  return <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8"><div className="flex flex-wrap items-end justify-between gap-3"><div className="space-y-1"><h1 className="font-serif text-3xl font-semibold tracking-tight">Labour Management</h1><p className="text-sm text-muted-foreground">Track work, advances, and payments for individual labourers and groups.</p></div><Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="size-4" />Add labourer</Button></div>{labourers === undefined ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div> : labourers.length === 0 ? <Empty><EmptyHeader><EmptyMedia variant="icon"><HardHat /></EmptyMedia><EmptyTitle>No labourers yet</EmptyTitle></EmptyHeader></Empty> : <div className="space-y-2">{labourers.map((labourer) => <div key={labourer._id} className="rounded-lg border border-border bg-card px-4 py-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1 space-y-1"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{labourer.name}</span><Badge variant="secondary" className="text-[10px]">{labourer.type === "group" ? `Group · ${labourer.memberCount} workers` : "Individual"}</Badge>{labourer.skill && <Badge variant="secondary" className="text-[10px]">{labourer.skill}</Badge>}</div><p className="text-xs text-muted-foreground">{labourer.projectName ?? "Unassigned"}{labourer.phone ? ` · ${labourer.phone}` : ""}{labourer.pan ? ` · PAN ${labourer.pan}` : ""}</p></div><div className="flex shrink-0 items-center gap-2"><div className="text-right"><p className="text-xs text-muted-foreground">Balance owed</p><p className={cn("font-mono text-sm font-semibold", labourer.balance > 0.01 ? "text-amber-600" : "text-green-600")}>{formatCompactInr(labourer.balance)}</p></div><Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => setEntryTarget(labourer)}><Wallet className="size-3.5" />Add entry</Button><Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${labourer.name}`} onClick={() => setEditingLabourer(labourer)}><MoreHorizontal className="size-4" /></Button></div></div></div>)}</div>}<MigrationLabourerEditDialog open={!!editingLabourer} onOpenChange={(open) => { if (!open) setEditingLabourer(null); }} labourer={editingLabourer} projects={projects ?? []} />{dialogOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md space-y-3 rounded-lg bg-card p-6"><h2 className="text-xl font-semibold">Add labourer or group</h2><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="individual">Individual</option><option value="group">Group</option></select><Input placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><div className="grid gap-3 sm:grid-cols-2"><Input type="number" placeholder="Number of workers" value={form.memberCount} onChange={(e) => setForm({ ...form, memberCount: e.target.value })} /><Input placeholder="Skill / trade" value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })} /></div><Input placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><Input placeholder="PAN" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} /><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}><option value="">Assigned project (optional)</option>{(projects ?? []).map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</select><textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => void submit()}>Add labourer</Button></div></div></div>}{entryTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md space-y-3 rounded-lg bg-card p-6"><h2 className="text-xl font-semibold">Add ledger entry</h2><select className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={entryForm.type} onChange={(e) => setEntryForm({ ...entryForm, type: e.target.value })}><option value="work">Work</option><option value="advance">Advance</option><option value="payment">Payment</option></select><Input type="number" placeholder="Amount" value={entryForm.amount} onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })} /><Input type="date" value={entryForm.date} onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })} /><Input placeholder="Description" value={entryForm.description} onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })} /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setEntryTarget(undefined)}>Cancel</Button><Button onClick={async () => { if (!entryForm.amount) return; await createMigrationLabourEntry(entryTarget._id, entryForm); toast.success("Entry added"); window.location.reload(); }}>Add entry</Button></div></div></div>}</div>;
}

function LabourInner() {
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; id: Id<"labourers"> } | null>(null);
  const [entryLabourerId, setEntryLabourerId] = useState<Id<"labourers"> | null>(null);
  const [expanded, setExpanded] = useState<Id<"labourers"> | null>(null);
  const [deleteId, setDeleteId] = useState<Id<"labourers"> | null>(null);

  const labourers = useQuery(api.labour.listLabourers, {});
  const detail = useQuery(api.labour.getLabourer, expanded ? { labourerId: expanded } : "skip");
  const deleteLabourer = useMutation(api.labour.deleteLabourer);
  const deleteLedgerEntry = useMutation(api.labour.deleteLedgerEntry);
  const backfillAccounts = useMutation(api.labour.backfillLabourerAccounts);

  const missingAccountCount = labourers?.filter((l) => !l.accountId).length ?? 0;
  const [backfilling, setBackfilling] = useState(false);

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const { created } = await backfillAccounts({});
      toast.success(`Created ${created} ledger account${created !== 1 ? "s" : ""}`);
    } catch {
      toast.error("Could not create ledger accounts");
    } finally {
      setBackfilling(false);
    }
  };

  const editingLabourer =
    dialog?.mode === "edit" ? labourers?.find((l) => l._id === dialog.id) ?? null : null;
  const entryTargetProjectId =
    labourers?.find((l) => l._id === entryLabourerId)?.projectId ?? null;

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteLabourer({ labourerId: deleteId });
      toast.success("Labourer removed");
      setDeleteId(null);
    } catch (error) {
      toast.error(error instanceof ConvexError ? (error.data as { message: string }).message : "Could not delete");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Labour Management</h1>
          <p className="text-sm text-muted-foreground">
            Track work, advances, and payments for individual labourers and groups.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialog({ mode: "create" })}>
          <Plus className="size-4" /> Add labourer
        </Button>
      </div>

      {missingAccountCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300">
          <span>
            {missingAccountCount} labourer{missingAccountCount !== 1 ? "s" : ""} missing a ledger account — they won't show up in Bank Reconciliation until fixed.
          </span>
          <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={handleBackfill} disabled={backfilling}>
            {backfilling ? "Creating…" : "Create missing accounts"}
          </Button>
        </div>
      )}

      {labourers === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : labourers.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HardHat />
            </EmptyMedia>
            <EmptyTitle>No labourers yet</EmptyTitle>
            <EmptyDescription>Add an individual worker or a labour group to start tracking payments.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => setDialog({ mode: "create" })}>
              <Plus className="size-4" /> Add labourer
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-2">
          {labourers.map((l) => {
            const isOpen = expanded === l._id;
            return (
              <div key={l._id} className="rounded-lg border border-border bg-card px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 space-y-1 text-left"
                    onClick={() => setExpanded(isOpen ? null : l._id)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{l.name}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {l.type === "group" ? `Group · ${l.memberCount} workers` : "Individual"}
                      </Badge>
                      {l.skill && <Badge variant="secondary" className="text-[10px]">{l.skill}</Badge>}
                      {!l.isActive && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                      {!l.pan && (
                        <Badge className="gap-1 bg-amber-500/15 text-[10px] text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="size-3" /> Missing PAN
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {l.projectName ?? "Unassigned"}
                      {l.phone ? ` · ${l.phone}` : ""}
                      {l.pan ? ` · PAN ${l.pan}` : ""}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Balance owed</p>
                      <p
                        className={cn(
                          "font-mono text-sm font-semibold tabular-nums",
                          l.balance > 0.01 ? "text-amber-600" : "text-green-600",
                        )}
                      >
                        {formatCompactInr(l.balance)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 text-xs"
                      onClick={() => setEntryLabourerId(l._id)}
                    >
                      <Wallet className="size-3.5" /> Add entry
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDialog({ mode: "edit", id: l._id })}>
                          <Pencil className="size-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(l._id)}>
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
                    ) : detail && detail.entries.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No ledger entries yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="mb-2 flex gap-4 text-[11px] text-muted-foreground">
                          <span>Work: {formatCompactInr(detail?.workTotal ?? 0)}</span>
                          <span>Advances: {formatCompactInr(detail?.advanceTotal ?? 0)}</span>
                          <span>Paid: {formatCompactInr(detail?.paymentTotal ?? 0)}</span>
                        </div>
                        {detail?.entries.map((e) => (
                          <div key={e._id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <Badge className={cn("text-[10px]", LABOUR_ENTRY_TYPE_COLORS[e.type])}>
                                {LABOUR_ENTRY_TYPE_LABELS[e.type]}
                              </Badge>
                              <span className="text-muted-foreground">{formatDate(e.date)}</span>
                              {e.description && <span className="text-muted-foreground">— {e.description}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono tabular-nums">{formatCompactInr(e.amount)}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 text-muted-foreground hover:text-destructive"
                                onClick={async () => {
                                  try {
                                    await deleteLedgerEntry({ entryId: e._id });
                                  } catch {
                                    toast.error("Could not delete entry");
                                  }
                                }}
                              >
                                <Trash2 className="size-3" />
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

      <LabourerDialog
        open={!!dialog}
        onOpenChange={(v) => {
          if (!v) setDialog(null);
        }}
        editing={editingLabourer}
      />
      <LedgerEntryDialog
        open={!!entryLabourerId}
        onOpenChange={(v) => {
          if (!v) setEntryLabourerId(null);
        }}
        labourerId={entryLabourerId ?? undefined}
        projectId={entryTargetProjectId}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this labourer?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes their full ledger history. This cannot be undone.
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

export default function LabourPage() {
  if (migrationApiEnabled) return <MigrationLabourPage />;
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
        <LabourInner />
      </Authenticated>
    </>
  );
}

