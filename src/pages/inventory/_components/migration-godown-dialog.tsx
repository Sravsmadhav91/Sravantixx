import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createMigrationGodown } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";

export default function MigrationGodownDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setAddress("");
  }, [open]);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Godown name is required");
      return;
    }
    setSaving(true);
    try {
      await createMigrationGodown({ name: name.trim(), address: address.trim() || undefined });
      toast.success("Godown created");
      onOpenChange(false);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create godown");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New godown / store</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name *" value={name} onChange={(event) => setName(event.target.value)} />
          <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Address / notes (optional)" value={address} onChange={(event) => setAddress(event.target.value)} />
        </div>
        <DialogFooter><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Create godown"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}