import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createMigrationLoan } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";

const today = () => new Date().toISOString().slice(0, 10);

export default function MigrationLoanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [lenderName, setLenderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [principal, setPrincipal] = useState("");
  const [interestRatePercent, setInterestRatePercent] = useState("");
  const [tenureMonths, setTenureMonths] = useState("");
  const [emiFrequency, setEmiFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLenderName("");
    setAccountNumber("");
    setPrincipal("");
    setInterestRatePercent("");
    setTenureMonths("");
    setEmiFrequency("monthly");
    setStartDate(today());
    setNotes("");
  }, [open]);

  const submit = async () => {
    if (!lenderName.trim() || !principal || !interestRatePercent || !tenureMonths || !startDate) {
      toast.error("Lender, principal, interest rate, tenure, and start date are required");
      return;
    }
    setSaving(true);
    try {
      await createMigrationLoan({
        lenderName: lenderName.trim(),
        accountNumber: accountNumber.trim() || undefined,
        principal: Number(principal),
        interestRatePercent: Number(interestRatePercent),
        tenureMonths: Number(tenureMonths),
        emiFrequency,
        startDate,
        notes: notes.trim() || undefined,
      });
      toast.success("Loan created with repayment schedule");
      onOpenChange(false);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create loan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>New business loan</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Lender *" value={lenderName} onChange={(event) => setLenderName(event.target.value)} />
          <Input placeholder="Loan / sanction no. (optional)" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} />
          <div className="grid grid-cols-3 gap-3">
            <Input type="number" placeholder="Principal *" value={principal} onChange={(event) => setPrincipal(event.target.value)} />
            <Input type="number" placeholder="Interest % *" value={interestRatePercent} onChange={(event) => setInterestRatePercent(event.target.value)} />
            <Input type="number" placeholder="Installments *" value={tenureMonths} onChange={(event) => setTenureMonths(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={emiFrequency} onChange={(event) => setEmiFrequency(event.target.value)}>
              <option value="monthly">Monthly EMI</option>
              <option value="quarterly">Quarterly EMI</option>
            </select>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Create loan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}