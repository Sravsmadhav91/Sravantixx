import { useEffect, useState } from "react";
import { toast } from "sonner";
import { updateMigrationTdsDeductee } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";

type Props = { deductee: any | null; open: boolean; onOpenChange: (open: boolean) => void };
export default function MigrationDeducteeEditDialog({ deductee, open, onOpenChange }: Props) {
  const [form, setForm] = useState({ name: "", pan: "", panValidationStatus: "", panHolderName: "" }); const [saving, setSaving] = useState(false);
  useEffect(() => { if (deductee) setForm({ name: deductee.name || "", pan: deductee.pan || "", panValidationStatus: deductee.panValidationStatus || "", panHolderName: deductee.panHolderName || "" }); }, [deductee]);
  const submit = async () => { setSaving(true); try { await updateMigrationTdsDeductee(deductee._id, { ...form, pan: form.pan.replace(/\s+/g, "").toUpperCase() }); toast.success("Deductee updated"); onOpenChange(false); window.location.reload(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update deductee"); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Edit Deductee</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Input className="sm:col-span-2" placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Input placeholder="PAN *" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} /><Input placeholder="PAN validation status" value={form.panValidationStatus} onChange={(e) => setForm({ ...form, panValidationStatus: e.target.value })} /><Input className="sm:col-span-2" placeholder="PAN holder's name" value={form.panHolderName} onChange={(e) => setForm({ ...form, panHolderName: e.target.value })} /></div><DialogFooter><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button></DialogFooter></DialogContent></Dialog>;
}
