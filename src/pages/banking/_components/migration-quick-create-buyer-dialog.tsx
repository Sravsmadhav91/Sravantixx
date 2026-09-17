import { useState } from "react";
import { toast } from "sonner";
import { createMigrationBuyer } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (buyer: { _id: string; name: string; phone?: string }) => void };

export default function MigrationQuickCreateBuyerDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", pan: "", gstin: "" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.name.trim() || !form.phone.trim()) { toast.error("Buyer name and phone are required"); return; }
    setSaving(true);
    try { const buyer = await createMigrationBuyer({ ...form, email: form.email || undefined, pan: form.pan || undefined, gstin: form.gstin || undefined }); onCreated(buyer); toast.success("Buyer created"); onOpenChange(false); setForm({ name: "", phone: "", email: "", pan: "", gstin: "" }); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create buyer"); } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Create New Buyer</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Input className="sm:col-span-2" placeholder="Full name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Input placeholder="Phone *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><Input placeholder="PAN" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} /><Input placeholder="GSTIN" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></div><DialogFooter><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? "Creating..." : "Create buyer"}</Button></DialogFooter></DialogContent></Dialog>;
}
