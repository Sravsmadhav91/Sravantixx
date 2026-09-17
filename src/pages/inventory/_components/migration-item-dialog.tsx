import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createMigrationStockItem } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";

export default function MigrationItemDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState("");
  const [reorderLevel, setReorderLevel] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSku("");
    setName("");
    setUnit("");
    setCategory("");
    setReorderLevel("");
    setNotes("");
  }, [open]);

  const submit = async () => {
    if (!sku.trim() || !name.trim() || !unit.trim()) {
      toast.error("SKU, name, and unit are required");
      return;
    }
    setSaving(true);
    try {
      await createMigrationStockItem({ sku, name, unit, category: category || undefined, reorderLevel: reorderLevel ? Number(reorderLevel) : undefined, notes: notes || undefined });
      toast.success("Item created");
      onOpenChange(false);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New stock item</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><Input placeholder="SKU / Code *" value={sku} onChange={(event) => setSku(event.target.value)} /><Input placeholder="Unit *" value={unit} onChange={(event) => setUnit(event.target.value)} /></div>
          <Input placeholder="Item name *" value={name} onChange={(event) => setName(event.target.value)} />
          <div className="grid grid-cols-2 gap-3"><Input placeholder="Category" value={category} onChange={(event) => setCategory(event.target.value)} /><Input type="number" placeholder="Reorder level" value={reorderLevel} onChange={(event) => setReorderLevel(event.target.value)} /></div>
          <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        <DialogFooter><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Create item"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}