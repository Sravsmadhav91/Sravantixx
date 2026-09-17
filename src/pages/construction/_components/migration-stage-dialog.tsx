import { useState } from "react";
import { toast } from "sonner";
import { createMigrationConstructionStage } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";

export default function MigrationStageDialog({ open, onOpenChange, projectId }: { open: boolean; onOpenChange: (open: boolean) => void; projectId: string }) {
  const [name, setName] = useState(""); const [order, setOrder] = useState("1"); const [percentComplete, setPercentComplete] = useState("0"); const [targetDate, setTargetDate] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async () => { if (!name.trim()) { toast.error("Stage name is required"); return; } setSaving(true); try { await createMigrationConstructionStage(projectId, { name, order: Number(order), percentComplete: Number(percentComplete), targetDate: targetDate || undefined }); toast.success("Stage added"); onOpenChange(false); window.location.reload(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add stage"); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Add construction stage</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-3"><Input className="col-span-2" placeholder="Stage name *" value={name} onChange={(e) => setName(e.target.value)} /><Input type="number" placeholder="Display order" value={order} onChange={(e) => setOrder(e.target.value)} /><Input type="number" min="0" max="100" placeholder="% Complete" value={percentComplete} onChange={(e) => setPercentComplete(e.target.value)} /><Input className="col-span-2" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></div><DialogFooter><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Add stage"}</Button></DialogFooter></DialogContent></Dialog>;
}
