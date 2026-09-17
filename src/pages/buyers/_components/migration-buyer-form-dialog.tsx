import { useState } from "react";
import { toast } from "sonner";
import { createMigrationBuyer } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";

const INDIA_STATES = ["Andhra Pradesh", "Karnataka", "Kerala", "Maharashtra", "Tamil Nadu", "Telangana", "Other"];

export default function MigrationBuyerFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", pan: "", gstin: "", state: "", address: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    if (!form.name.trim() || !form.phone.trim()) { toast.error("Name and phone are required"); return; }
    setSaving(true);
    try { await createMigrationBuyer({ ...form, email: form.email || undefined, pan: form.pan || undefined, gstin: form.gstin || undefined, state: form.state || undefined, address: form.address || undefined, notes: form.notes || undefined }); toast.success("Buyer added"); setForm({ name: "", phone: "", email: "", pan: "", gstin: "", state: "", address: "", notes: "" }); onOpenChange(false); window.location.reload(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add buyer"); } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Add buyer</DialogTitle><p className="text-sm text-muted-foreground">Keep contact, PAN and address details for this buyer.</p></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Input className="sm:col-span-2" placeholder="Full name *" value={form.name} onChange={(e) => set("name", e.target.value)} /><Input placeholder="Phone *" value={form.phone} onChange={(e) => set("phone", e.target.value)} /><Input type="email" placeholder="Email" value={form.email} onChange={(e) => set("email", e.target.value)} /><Input placeholder="PAN" value={form.pan} onChange={(e) => set("pan", e.target.value)} /><Input placeholder="GSTIN (if a business buyer)" value={form.gstin} onChange={(e) => set("gstin", e.target.value)} /><select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.state} onChange={(e) => set("state", e.target.value)}><option value="">Select state...</option>{INDIA_STATES.map((state) => <option key={state} value={state}>{state}</option>)}</select><textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm sm:col-span-2" placeholder="Address" value={form.address} onChange={(e) => set("address", e.target.value)} /><textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm sm:col-span-2" placeholder="Notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div><DialogFooter><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Add buyer"}</Button></DialogFooter></DialogContent></Dialog>;
}