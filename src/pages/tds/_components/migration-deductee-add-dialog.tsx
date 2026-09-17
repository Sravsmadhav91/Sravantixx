import { useState } from "react";
import { toast } from "sonner";
import { createMigrationTdsDeductee } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";

export default function MigrationDeducteeAddDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState({ name: "", pan: "", panValidationStatus: "", panHolderName: "" }); const [saving, setSaving] = useState(false);
  const submit = async () => { setSaving(true); try { await createMigrationTdsDeductee({ ...form, pan: form.pan.replace(/\s+/g, "").toUpperCase() }); toast.success("Deductee added"); onOpenChange(false); setForm({ name: "", pan: "", panValidationStatus: "", panHolderName: "" }); window.location.reload(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add deductee"); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Add Deductee</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Input className="sm:col-span-2" placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Input placeholder="PAN *" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} /><Input placeholder="PAN validation status" value={form.panValidationStatus} onChange={(e) => setForm({ ...form, panValidationStatus: e.target.value })} /><Input className="sm:col-span-2" placeholder="PAN holder's name" value={form.panHolderName} onChange={(e) => setForm({ ...form, panHolderName: e.target.value })} /></div><DialogFooter><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Add Deductee"}</Button></DialogFooter></DialogContent></Dialog>;
}
