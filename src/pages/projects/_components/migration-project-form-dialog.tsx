import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createMigrationProject, updateMigrationProject } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";

type ProjectFormProject = { _id: string; name: string; code: string; city: string; address?: string; type?: string; status?: string; reraNumber?: string; possessionDate?: string; constructionBudget?: number; notes?: string; brandName?: string; brandLogoUrl?: string };

export default function MigrationProjectFormDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (open: boolean) => void; project?: ProjectFormProject }) {
  const [name, setName] = useState(project?.name ?? "");
  const [code, setCode] = useState(project?.code ?? "");
  const [city, setCity] = useState(project?.city ?? "");
  const [type, setType] = useState(project?.type ?? "apartment");
  const [status, setStatus] = useState(project?.status ?? "planning");
  const [reraNumber, setReraNumber] = useState(project?.reraNumber ?? "");
  const [possessionDate, setPossessionDate] = useState(project?.possessionDate?.slice(0, 10) ?? "");
  const [constructionBudget, setConstructionBudget] = useState(project?.constructionBudget?.toString() ?? "");
  const [address, setAddress] = useState(project?.address ?? "");
  const [notes, setNotes] = useState(project?.notes ?? "");
  const [brandName, setBrandName] = useState(project?.brandName ?? "Mighty Homes");
  const [brandLogoUrl, setBrandLogoUrl] = useState(project?.brandLogoUrl ?? "/mighty-homes-logo.png");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? ""); setCode(project?.code ?? ""); setCity(project?.city ?? "");
    setType(project?.type ?? "apartment"); setStatus(project?.status ?? "planning");
    setReraNumber(project?.reraNumber ?? ""); setPossessionDate(project?.possessionDate?.slice(0, 10) ?? "");
    setConstructionBudget(project?.constructionBudget?.toString() ?? ""); setAddress(project?.address ?? ""); setNotes(project?.notes ?? "");
    setBrandName(project?.brandName ?? "Mighty Homes"); setBrandLogoUrl(project?.brandLogoUrl ?? "/mighty-homes-logo.png");
  }, [open, project]);

  const submit = async () => {
    if (!name.trim() || !code.trim() || !city.trim()) {
      toast.error("Name, code, and city are required");
      return;
    }
    setSaving(true);
    try {
      if (project) {
        await updateMigrationProject(project._id, { name, code, city, type, status, reraNumber, possessionDate, constructionBudget: constructionBudget ? Number(constructionBudget) : undefined, address, notes, brandName, brandLogoUrl });
        toast.success("Project updated");
      } else {
        await createMigrationProject({ name, code, city, type, status, reraNumber, possessionDate, constructionBudget: constructionBudget ? Number(constructionBudget) : undefined, address, notes, brandName, brandLogoUrl });
        toast.success("Project created");
      }
      setName(""); setCode(""); setCity(""); setAddress(""); setNotes(""); onOpenChange(false);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create project");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file for the logo");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be 2 MB or smaller");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setBrandLogoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle><p className="text-sm text-muted-foreground">A project is one tower, layout or scheme you are selling.</p></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input className="sm:col-span-2" placeholder="Project name" value={name} onChange={(event) => setName(event.target.value)} />
          <Input placeholder="Brand / developer name" value={brandName} onChange={(event) => setBrandName(event.target.value)} />
          <div className="space-y-1">
            <Input type="file" accept="image/*" onChange={(event) => handleLogoUpload(event.target.files?.[0])} />
            <p className="text-xs text-muted-foreground">Upload a customer logo, or use the URL below. Maximum 2 MB.</p>
          </div>
          <Input placeholder="Brand logo URL" value={brandLogoUrl.startsWith("data:") ? "Uploaded logo" : brandLogoUrl} onChange={(event) => setBrandLogoUrl(event.target.value)} />
          <Input placeholder="Short code" value={code} onChange={(event) => setCode(event.target.value)} />
          <Input placeholder="City" value={city} onChange={(event) => setCity(event.target.value)} />
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={type} onChange={(event) => setType(event.target.value)}><option value="apartment">Apartment</option><option value="plotted">Plotted</option><option value="villa">Villa</option><option value="commercial">Commercial</option></select>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="planning">Planning</option><option value="under_construction">Under construction</option><option value="ready">Ready</option><option value="completed">Completed</option></select>
          <Input placeholder="RERA number" value={reraNumber} onChange={(event) => setReraNumber(event.target.value)} />
          <Input type="date" value={possessionDate} onChange={(event) => setPossessionDate(event.target.value)} />
          <Input type="number" placeholder="Construction budget (₹)" value={constructionBudget} onChange={(event) => setConstructionBudget(event.target.value)} />
          <Input className="sm:col-span-2" placeholder="Site address" value={address} onChange={(event) => setAddress(event.target.value)} />
          <textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm sm:col-span-2" placeholder="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        <DialogFooter><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Create project"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}