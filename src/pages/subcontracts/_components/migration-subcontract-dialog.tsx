import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createMigrationSubcontract, migrationGet, updateMigrationSubcontract } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";

type Option = { _id: string; name: string; pan?: string };

export default function MigrationSubcontractDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (open: boolean) => void; editing?: any }) {
  const [projects, setProjects] = useState<Option[]>([]);
  const [vendors, setVendors] = useState<Option[]>([]);
  const [projectId, setProjectId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [title, setTitle] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) { setProjectId(editing.projectId || ""); setVendorId(editing.vendorId || ""); setTitle(editing.title || ""); setContractValue(String(editing.contractValue || "")); setStartDate(editing.startDate || ""); setEndDate(editing.endDate || ""); setNotes(editing.notes || ""); }
    Promise.all([
      migrationGet<Option[]>("/api/tables/projects/records"),
      migrationGet<Option[]>("/api/tables/vendors/records"),
    ]).then(([projectRows, vendorRows]) => {
      setProjects(projectRows);
      setVendors(vendorRows);
    }).catch((error) => toast.error(error instanceof Error ? error.message : "Could not load project and vendor options"));
  }, [open]);

  const submit = async () => {
    if (!projectId || !vendorId || !title.trim() || !contractValue) {
      toast.error("Project, vendor, title, and contract value are required");
      return;
    }
    setSaving(true);
    try {
      const payload = { projectId, vendorId, title: title.trim(), contractValue: Number(contractValue), startDate: startDate || undefined, endDate: endDate || undefined, notes: notes.trim() || undefined };
      if (editing) await updateMigrationSubcontract(editing._id, payload); else await createMigrationSubcontract(payload);
      toast.success(editing ? "Subcontract updated" : "Subcontract created");
      onOpenChange(false);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create subcontract");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Edit subcontract" : "New subcontract"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Select project *</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</select>
          <SearchableSelect value={vendorId} onValueChange={setVendorId} options={vendors.map((vendor) => ({ value: vendor._id, label: vendor.name, sub: vendor.pan ? undefined : "PAN missing", keywords: `${vendor.name} ${vendor.pan ?? ""}` }))} placeholder="Select vendor *" searchPlaceholder="Type vendor name…" />
          <Input placeholder="Contract title *" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Input type="number" placeholder="Contract value (₹) *" value={contractValue} onChange={(event) => setContractValue(event.target.value)} />
          <div className="grid grid-cols-2 gap-3"><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /><Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div>
          <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        <DialogFooter><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create subcontract"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}