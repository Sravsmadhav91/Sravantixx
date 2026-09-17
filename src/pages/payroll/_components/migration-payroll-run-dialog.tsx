import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createMigrationPayrollRun } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";

export default function MigrationPayrollRunDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setMonth(new Date().toISOString().slice(0, 7));
  }, [open]);

  const submit = async () => {
    setSaving(true);
    try {
      await createMigrationPayrollRun(month);
      toast.success(`Payroll run created for ${month}`);
      onOpenChange(false);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create payroll run");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Payroll Run</DialogTitle>
          <DialogDescription>Generates a draft payslip for every active employee.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2"><label className="text-sm font-medium" htmlFor="migration-payroll-month">Month</label><Input id="migration-payroll-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div>
        <DialogFooter><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Create Run"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}