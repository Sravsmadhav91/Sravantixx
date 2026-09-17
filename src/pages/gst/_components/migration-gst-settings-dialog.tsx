import { useEffect, useState } from "react";
import { toast } from "sonner";
import { saveMigrationGstSettings } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { INDIAN_STATES, stateCodeFromName } from "@/lib/indian-states.ts";

type GstSettings = { gstin?: string; legalName?: string; tradeName?: string; stateName?: string };

export default function MigrationGstSettingsDialog({ open, onOpenChange, settings }: { open: boolean; onOpenChange: (open: boolean) => void; settings?: GstSettings }) {
  const [gstin, setGstin] = useState("");
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [stateName, setStateName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGstin(settings?.gstin ?? "");
    setLegalName(settings?.legalName ?? "");
    setTradeName(settings?.tradeName ?? "");
    setStateName(settings?.stateName ?? "");
  }, [open, settings]);

  const submit = async () => {
    setSaving(true);
    try {
      await saveMigrationGstSettings({
        gstin: gstin.trim().toUpperCase() || undefined,
        legalName: legalName.trim() || undefined,
        tradeName: tradeName.trim() || undefined,
        stateName: stateName || undefined,
        stateCode: stateCodeFromName(stateName),
      });
      toast.success("GST profile saved");
      onOpenChange(false);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save GST profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Company GST Profile</DialogTitle>
          <DialogDescription>Used to determine intra vs inter-state tax split and headers on GSTR-1/3B.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="GSTIN" value={gstin} onChange={(event) => setGstin(event.target.value.toUpperCase())} />
          <Input placeholder="Legal Name" value={legalName} onChange={(event) => setLegalName(event.target.value)} />
          <Input placeholder="Trade Name (optional)" value={tradeName} onChange={(event) => setTradeName(event.target.value)} />
          <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={stateName} onChange={(event) => setStateName(event.target.value)}><option value="">Registered State</option>{INDIAN_STATES.map((state) => <option key={state.code} value={state.name}>{state.name} ({state.code})</option>)}</select>
        </div>
        <DialogFooter><Button onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Save Profile"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}