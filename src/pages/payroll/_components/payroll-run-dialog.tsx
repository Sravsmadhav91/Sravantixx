import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { CheckCircle2, FileText, Landmark } from "lucide-react";
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
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { useRole } from "@/hooks/use-role.ts";

const STATUS_LABELS: Record<string, string> = { draft: "Draft", finalized: "Finalized", paid: "Paid" };
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  finalized: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  paid: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payrollRunId: Id<"payrollRuns"> | null;
};

export default function PayrollRunDialog({ open, onOpenChange, payrollRunId }: Props) {
  const { isOwner } = useRole();
  const data = useQuery(api.payroll.getPayrollRun, payrollRunId ? { payrollRunId } : "skip");
  const updateTds = useMutation(api.payroll.updatePayslipTds);
  const finalize = useMutation(api.payroll.finalizePayrollRun);
  const markPaid = useMutation(api.payroll.markPayrollRunPaid);
  const [tdsDrafts, setTdsDrafts] = useState<Record<string, string>>({});

  const handleTdsBlur = async (payslipId: Id<"payslips">, value: string) => {
    const tds = parseFloat(value) || 0;
    try {
      await updateTds({ payslipId, tds });
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to update TDS");
      }
    }
  };

  const handleFinalize = async () => {
    if (!payrollRunId) return;
    try {
      await finalize({ payrollRunId, date: new Date().toISOString().slice(0, 10) });
      toast.success("Payroll finalized and posted to accounting");
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to finalize payroll");
      }
    }
  };

  const handleMarkPaid = async () => {
    if (!payrollRunId) return;
    try {
      await markPaid({ payrollRunId, date: new Date().toISOString().slice(0, 10) });
      toast.success("Payroll marked as paid");
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to mark payroll paid");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Payroll Run {data?.run.month}
            {data && <Badge className={STATUS_COLORS[data.run.status]}>{STATUS_LABELS[data.run.status]}</Badge>}
          </DialogTitle>
          <DialogDescription>
            {data?.run.status === "draft" ? "Review earnings and edit TDS before finalizing." : "Salary details for this run."}
          </DialogDescription>
        </DialogHeader>

        {data === undefined ? (
          <Skeleton className="h-64 w-full" />
        ) : data === null ? (
          <p className="text-sm text-muted-foreground">Payroll run not found.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">Gross</p>
                <p className="font-semibold tabular-nums">{formatCompactInr(data.run.totalGross)}</p>
              </div>
              <div className="rounded-lg border bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">Deductions</p>
                <p className="font-semibold tabular-nums">{formatCompactInr(data.run.totalDeductions)}</p>
              </div>
              <div className="rounded-lg border bg-primary/5 border-primary/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Net Pay</p>
                <p className="font-semibold tabular-nums text-primary">{formatCompactInr(data.run.totalNetPay)}</p>
              </div>
            </div>

            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase">
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2 text-right">Gross</th>
                    <th className="px-3 py-2 text-right">PF</th>
                    <th className="px-3 py-2 text-right">ESI</th>
                    <th className="px-3 py-2 text-right">PT</th>
                    <th className="px-3 py-2 text-right w-28">TDS</th>
                    <th className="px-3 py-2 text-right">Net Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.payslips.map((p) => (
                    <tr key={p._id} className="hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <span className="font-medium">{p.employeeName}</span>
                        <span className="ml-1.5 font-mono text-xs text-muted-foreground">{p.employeeCode}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{formatCompactInr(p.grossEarnings)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{formatCompactInr(p.pfEmployee)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{formatCompactInr(p.esiEmployee)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{formatCompactInr(p.professionalTax)}</td>
                      <td className="px-2 py-1.5 text-right">
                        {data.run.status === "draft" && isOwner ? (
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            className="h-7 text-xs text-right"
                            defaultValue={p.tds || ""}
                            placeholder="0"
                            onChange={(e) => setTdsDrafts((prev) => ({ ...prev, [p._id]: e.target.value }))}
                            onBlur={(e) => handleTdsBlur(p._id, tdsDrafts[p._id] ?? e.target.value)}
                          />
                        ) : (
                          <span className="tabular-nums text-xs">{formatCompactInr(p.tds)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold">{formatCompactInr(p.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          {data?.run.status === "draft" && isOwner && (
            <Button onClick={handleFinalize}>
              <FileText className="size-4" /> Finalize & Post to Accounting
            </Button>
          )}
          {data?.run.status === "finalized" && isOwner && (
            <Button onClick={handleMarkPaid}>
              <Landmark className="size-4" /> Mark as Paid
            </Button>
          )}
          {data?.run.status === "paid" && (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 gap-1">
              <CheckCircle2 className="size-3.5" /> Paid on {data.run.paidDate}
            </Badge>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
