import { useMigrationFinance } from "@/hooks/use-migration-finance.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import MigrationDeducteeImport from "./migration-deductee-import.tsx";
import MigrationDeducteeEditDialog from "./migration-deductee-edit-dialog.tsx";
import MigrationDeducteeAddDialog from "./migration-deductee-add-dialog.tsx";
import { deleteMigrationTdsDeductee } from "@/lib/migration-api.ts";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";

export default function MigrationDeducteeTab() {
  const deductees = useMigrationFinance<any[]>("/api/tds/deductees") ?? [];
  const [editing, setEditing] = useState<any | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const remove = async (deductee: any) => { if (!window.confirm(`Delete deductee ${deductee.name}?`)) return; try { await deleteMigrationTdsDeductee(deductee._id); toast.success("Deductee deleted"); window.location.reload(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete deductee"); } };
  return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Deductee List</CardTitle><p className="text-sm text-muted-foreground">Maintain PAN-validated deductees for Form 26Q and other TDS returns.</p></div><div className="flex gap-2"><Button size="sm" onClick={() => setAddOpen(true)}>Add Deductee</Button><MigrationDeducteeImport /></div></div></CardHeader><CardContent>{deductees.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No deductees imported yet.</div> : <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-2">ID No.</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">PAN</th><th className="px-3 py-2">PAN Validation Result / Status</th><th className="px-3 py-2">PAN holder&apos;s name</th><th className="px-3 py-2" /></tr></thead><tbody className="divide-y">{deductees.map((deductee, index) => <tr key={deductee._id}><td className="px-3 py-2 text-xs text-muted-foreground">{index + 1}</td><td className="px-3 py-2 font-medium">{deductee.name}</td><td className="px-3 py-2 font-mono text-xs">{deductee.pan}</td><td className="px-3 py-2"><Badge variant="secondary">{deductee.panValidationStatus || "Not checked"}</Badge></td><td className="px-3 py-2 text-xs">{deductee.panHolderName || "-"}</td><td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(deductee)}>Edit</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => void remove(deductee)}>Delete</Button></td></tr>)}</tbody></table></div>}<MigrationDeducteeAddDialog open={addOpen} onOpenChange={setAddOpen} /><MigrationDeducteeEditDialog deductee={editing} open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }} /></CardContent></Card>;
}
