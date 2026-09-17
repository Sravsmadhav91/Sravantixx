import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: Id<"payrollRuns">) => void;
};

export default function NewPayrollRunDialog({ open, onOpenChange, onCreated }: Props) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const createRun = useMutation(api.payroll.createPayrollRun);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const id = await createRun({ month });
      toast.success(`Payroll run created for ${month}`);
      onOpenChange(false);
      onCreated(id);
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to create payroll run");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Payroll Run</DialogTitle>
          <DialogDescription>Generates a draft payslip for every active employee.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Month</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={submitting}>Create Run</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
