import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createMigrationEmployee, migrationGet } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";

type CostCenter = { _id: string; name: string };

export default function MigrationEmployeeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [dateOfJoining, setDateOfJoining] = useState(new Date().toISOString().slice(0, 10));
  const [pan, setPan] = useState("");
  const [uan, setUan] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [basic, setBasic] = useState("");
  const [hra, setHra] = useState("0");
  const [conveyance, setConveyance] = useState("0");
  const [specialAllowance, setSpecialAllowance] = useState("0");
  const [otherAllowances, setOtherAllowances] = useState("0");
  const [pfApplicable, setPfApplicable] = useState(true);
  const [esiApplicable, setEsiApplicable] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDesignation("");
    setDateOfJoining(new Date().toISOString().slice(0, 10));
    setPan("");
    setUan("");
    setPhone("");
    setEmail("");
    setBankAccount("");
    setBankIfsc("");
    setCostCenterId("");
    setBasic("");
    setHra("0");
    setConveyance("0");
    setSpecialAllowance("0");
    setOtherAllowances("0");
    setPfApplicable(true);
    setEsiApplicable(false);
    migrationGet<CostCenter[]>("/api/tables/costCenters/records")
      .then((rows) => setCostCenters(rows))
      .catch(() => setCostCenters([]));
  }, [open]);

  const submit = async () => {
    if (!name.trim() || !designation.trim() || !dateOfJoining || !basic) {
      toast.error("Name, designation, joining date, and basic salary are required");
      return;
    }
    setSaving(true);
    try {
      await createMigrationEmployee({
        name: name.trim(),
        designation: designation.trim(),
        dateOfJoining,
        pan: pan.trim().toUpperCase() || undefined,
        uan: uan.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        bankAccount: bankAccount.trim() || undefined,
        bankIfsc: bankIfsc.trim().toUpperCase() || undefined,
        costCenterId: costCenterId || undefined,
        basic: Number(basic),
        hra: Number(hra || 0),
        conveyance: Number(conveyance || 0),
        specialAllowance: Number(specialAllowance || 0),
        otherAllowances: Number(otherAllowances || 0),
        pfApplicable,
        esiApplicable,
      });
      toast.success("Employee added");
      onOpenChange(false);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add employee");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>New employee</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Name *" value={name} onChange={(event) => setName(event.target.value)} />
            <Input placeholder="Designation *" value={designation} onChange={(event) => setDesignation(event.target.value)} />
            <Input type="date" value={dateOfJoining} onChange={(event) => setDateOfJoining(event.target.value)} />
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={costCenterId} onChange={(event) => setCostCenterId(event.target.value)}><option value="">Cost Center</option>{costCenters.map((center) => <option key={center._id} value={center._id}>{center.name}</option>)}</select>
            <Input placeholder="PAN" value={pan} onChange={(event) => setPan(event.target.value.toUpperCase())} />
            <Input placeholder="UAN" value={uan} onChange={(event) => setUan(event.target.value)} />
            <Input placeholder="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
            <Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <Input placeholder="Bank Account No." value={bankAccount} onChange={(event) => setBankAccount(event.target.value)} />
            <Input placeholder="IFSC" value={bankIfsc} onChange={(event) => setBankIfsc(event.target.value.toUpperCase())} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Monthly Salary Structure</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Input type="number" min="0" placeholder="Basic *" value={basic} onChange={(event) => setBasic(event.target.value)} />
              <Input type="number" min="0" placeholder="HRA" value={hra} onChange={(event) => setHra(event.target.value)} />
              <Input type="number" min="0" placeholder="Conveyance" value={conveyance} onChange={(event) => setConveyance(event.target.value)} />
              <Input type="number" min="0" placeholder="Special Allowance" value={specialAllowance} onChange={(event) => setSpecialAllowance(event.target.value)} />
              <Input type="number" min="0" placeholder="Other Allowances" value={otherAllowances} onChange={(event) => setOtherAllowances(event.target.value)} />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={pfApplicable} onCheckedChange={(checked) => setPfApplicable(checked === true)} /> PF Applicable</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={esiApplicable} onCheckedChange={(checked) => setEsiApplicable(checked === true)} /> ESI Applicable</label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Add employee"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}