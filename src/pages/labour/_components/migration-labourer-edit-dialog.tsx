import { useEffect, useState } from "react";
import { toast } from "sonner";
import { updateMigrationLabourer } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";

type Labourer = { _id: string; name: string; memberCount?: number; phone?: string; skill?: string; pan?: string; projectId?: string; notes?: string };

type Props = { open: boolean; onOpenChange: (open: boolean) => void; labourer?: Labourer | null; projects: Array<{ _id: string; name: string }> };

export default function MigrationLabourerEditDialog({ open, onOpenChange, labourer, projects }: Props) {
  const [form, setForm] = useState({ name: "", memberCount: "1", skill: "", phone: "", pan: "", projectId: "", notes: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!labourer) return;
    setForm({ name: labourer.name || "", memberCount: String(labourer.memberCount || 1), skill: labourer.skill || "", phone: labourer.phone || "", pan: labourer.pan || "", projectId: labourer.projectId || "", notes: labourer.notes || "" });
  }, [labourer]);
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try { await updateMigrationLabourer(labourer?._id || "", { ...form, memberCount: Number(form.memberCount || 1), projectId: form.projectId || undefined }); toast.success("Labourer updated"); onOpenChange(false); window.location.reload(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update labourer"); } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Edit labourer</DialogTitle></DialogHeader><div className="space-y-3"><Input placeholder="Name *" value={form.name} onChange={(e) => set("name", e.target.value)} /><div className="grid gap-3 sm:grid-cols-2"><Input type="number" min="1" placeholder="Number of workers" value={form.memberCount} onChange={(e) => set("memberCount", e.target.value)} /><Input placeholder="Skill / trade" value={form.skill} onChange={(e) => set("skill", e.target.value)} /></div><Input placeholder="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} /><Input placeholder="PAN" value={form.pan} onChange={(e) => set("pan", e.target.value.toUpperCase())} /><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.projectId} onChange={(e) => set("projectId", e.target.value)}><option value="">Unassigned project</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</select><textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div><DialogFooter><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button></DialogFooter></DialogContent></Dialog>;
}
