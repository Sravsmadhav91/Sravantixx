import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createMigrationUnit, listMigrationBuyers, updateMigrationUnit } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import MigrationQuickCreateBuyerDialog from "@/pages/banking/_components/migration-quick-create-buyer-dialog.tsx";

type MigrationUnit = { _id: string; number: string; block?: string; floor?: number; configuration?: string; superBuiltUpAreaSqft?: number; areaSqft?: number; carpetAreaSqft?: number; balconyAreaSqft?: number; undividedShare?: string; ratePerSqft?: number; price?: number; status: string; facing?: string; buyerId?: string };

export default function MigrationUnitFormDialog({ open, onOpenChange, projectId, editing }: { open: boolean; onOpenChange: (open: boolean) => void; projectId: string; editing?: MigrationUnit }) {
  const [number, setNumber] = useState("");
  const [block, setBlock] = useState("");
  const [floor, setFloor] = useState("");
  const [configuration, setConfiguration] = useState("");
  const [area, setArea] = useState("");
  const [builtUpArea, setBuiltUpArea] = useState("");
  const [carpetArea, setCarpetArea] = useState("");
  const [balconyArea, setBalconyArea] = useState("");
  const [undividedShare, setUndividedShare] = useState("");
  const [rate, setRate] = useState("");
  const [status, setStatus] = useState("available");
  const [facing, setFacing] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [buyers, setBuyers] = useState<Array<{ _id: string; name: string; phone?: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [createBuyerOpen, setCreateBuyerOpen] = useState(false);
  const price = Math.round((Number(area) || 0) * (Number(rate) || 0));

  useEffect(() => {
    if (!open) return;
    setNumber(editing?.number ?? ""); setBlock(editing?.block ?? ""); setFloor(editing?.floor?.toString() ?? ""); setConfiguration(editing?.configuration ?? "");
    setArea(editing?.superBuiltUpAreaSqft?.toString() ?? ""); setBuiltUpArea(editing?.areaSqft?.toString() ?? ""); setCarpetArea(editing?.carpetAreaSqft?.toString() ?? ""); setBalconyArea(editing?.balconyAreaSqft?.toString() ?? ""); setUndividedShare(editing?.undividedShare ?? ""); setRate(editing?.ratePerSqft?.toString() ?? ""); setStatus(editing?.status ?? "available"); setFacing(editing?.facing ?? ""); setBuyerId(editing?.buyerId ?? "");
    listMigrationBuyers().then(setBuyers).catch(() => setBuyers([]));
  }, [open, editing]);

  const submit = async () => {
    if (!number.trim() || !area || !rate) { toast.error("Unit number, area, and rate are required"); return; }
    setSaving(true);
    try {
      const payload = {
        number, block: block || undefined, floor: floor ? Number(floor) : undefined,
        configuration: configuration || undefined, superBuiltUpAreaSqft: Number(area),
        areaSqft: builtUpArea ? Number(builtUpArea) : undefined,
        carpetAreaSqft: carpetArea ? Number(carpetArea) : undefined,
        balconyAreaSqft: balconyArea ? Number(balconyArea) : undefined,
        undividedShare: undividedShare || undefined, ratePerSqft: Number(rate), price,
        status, facing: facing || undefined, buyerId: status === "booked" ? buyerId : undefined,
      };
      if (editing) await updateMigrationUnit(projectId, editing._id, payload);
      else await createMigrationUnit(projectId, payload);
      toast.success(editing ? "Unit updated" : "Unit created");
      onOpenChange(false); window.location.reload();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create unit"); } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl"><DialogHeader><DialogTitle>{editing ? "Edit unit" : "Add unit"}</DialogTitle></DialogHeader><div className="min-h-0 flex-1 overflow-y-auto py-1 pr-1"><div className="grid gap-3 sm:grid-cols-2">
    <Input placeholder="Unit number *" value={number} onChange={(e) => setNumber(e.target.value)} />
    <Input placeholder="Block or wing" value={block} onChange={(e) => setBlock(e.target.value)} />
    <Input type="number" placeholder="Floor" value={floor} onChange={(e) => setFloor(e.target.value)} />
    <Input placeholder="Configuration" value={configuration} onChange={(e) => setConfiguration(e.target.value)} />
    <Input type="number" placeholder="Super Built-Up Area - SBA (sq ft) *" value={area} onChange={(e) => setArea(e.target.value)} />
    <Input type="number" placeholder="Built-Up Area (sq ft)" value={builtUpArea} onChange={(e) => setBuiltUpArea(e.target.value)} />
    <Input type="number" placeholder="Carpet Area - CA (sq ft)" value={carpetArea} onChange={(e) => setCarpetArea(e.target.value)} />
    <Input type="number" placeholder="Balcony Area (sq ft)" value={balconyArea} onChange={(e) => setBalconyArea(e.target.value)} />
    <Input placeholder="Undivided Share - UDS" value={undividedShare} onChange={(e) => setUndividedShare(e.target.value)} />
    <div><Input type="number" placeholder="Rate per sq ft *" value={rate} onChange={(e) => setRate(e.target.value)} /><p className="mt-1 text-xs text-muted-foreground">Base price (SBA × rate): ₹{price.toLocaleString("en-IN")}</p></div>
    <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="available">Available</option><option value="on_hold">On hold</option><option value="booked">Booked</option><option value="sold">Sold</option></select>
    <Input placeholder="Facing" value={facing} onChange={(e) => setFacing(e.target.value)} />
    {status === "booked" && <div className="sm:col-span-2"><p className="mb-1.5 text-sm font-medium">Linked buyer *</p><SearchableSelect options={buyers.map((buyer) => ({ value: buyer._id, label: `${buyer.name}${buyer.phone ? ` · ${buyer.phone}` : ""}` }))} value={buyerId} onValueChange={setBuyerId} placeholder="Search buyer..." searchPlaceholder="Search buyers..." onCreateNew={() => setCreateBuyerOpen(true)} createNewLabel="+ Create new buyer" /><MigrationQuickCreateBuyerDialog open={createBuyerOpen} onOpenChange={setCreateBuyerOpen} onCreated={(buyer) => { setBuyers((current) => [...current, buyer]); setBuyerId(buyer._id); }} /></div>}
  </div></div><DialogFooter className="border-t bg-background pt-3"><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void submit()} disabled={saving || (status === "booked" && !buyerId)}>{saving ? "Saving..." : editing ? "Save changes" : "Add unit"}</Button></DialogFooter></DialogContent></Dialog>;
}