import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import { TDS_SECTION_OPTIONS } from "../_lib/quarters.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultQuarter: string;
  quarterOptions: string[];
};

export default function CreateChallanDialog({ open, onOpenChange, defaultQuarter, quarterOptions }: Props) {
  const [quarter, setQuarter] = useState(defaultQuarter);
  const [section, setSection] = useState("194C");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [bsrCode, setBsrCode] = useState("");
  const [challanSerial, setChallanSerial] = useState("");
  const [selected, setSelected] = useState<Set<Id<"tdsDeductions">>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const deductions = useQuery(
    api.tds.listUnpaidDeductions,
    open ? { quarter, section: section as "192" | "192A" | "193" | "194A" | "194B" | "194BA" | "194BB" | "194C" | "194D" | "194DA" | "194H" | "194I" | "194J" | "194Q" | "VDA" | "194T" | "195" } : "skip",
  );
  const createChallan = useMutation(api.tds.createChallan);

  const toggle = (id: Id<"tdsDeductions">) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalAmount = (deductions ?? []).filter((d) => selected.has(d._id)).reduce((s, d) => s + d.tdsAmount, 0);

  const handleCreate = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one deduction");
      return;
    }
    setSubmitting(true);
    try {
      await createChallan({
        quarter,
        section: section as "192" | "192A" | "193" | "194A" | "194B" | "194BA" | "194BB" | "194C" | "194D" | "194DA" | "194H" | "194I" | "194J" | "194Q" | "VDA" | "194T" | "195",
        paymentDate,
        bsrCode: bsrCode || undefined,
        challanSerialNumber: challanSerial || undefined,
        deductionIds: [...selected],
      });
      toast.success("Challan recorded and posted to accounting");
      onOpenChange(false);
      setSelected(new Set());
      setBsrCode("");
      setChallanSerial("");
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to record challan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record TDS Challan (Form 281)</DialogTitle>
          <DialogDescription>Group unpaid deductions for one quarter and section, then record the deposit.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Quarter</Label>
            <SearchableSelect
              value={quarter}
              onValueChange={setQuarter}
              options={quarterOptions.map((q) => ({ value: q, label: q }))}
              placeholder="Select quarter…"
              searchPlaceholder="Search…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Section</Label>
            <SearchableSelect
              value={section}
              onValueChange={setSection}
              options={TDS_SECTION_OPTIONS}
              placeholder="Select section…"
              searchPlaceholder="Search…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Payment Date</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>BSR Code</Label>
            <Input value={bsrCode} onChange={(e) => setBsrCode(e.target.value)} placeholder="Bank BSR code" />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Challan Serial No.</Label>
            <Input value={challanSerial} onChange={(e) => setChallanSerial(e.target.value)} placeholder="Issued by the bank on payment" />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">Unpaid Deductions</Label>
          {deductions === undefined ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : deductions.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1">No unpaid deductions for this quarter and section.</p>
          ) : (
            <div className="rounded-lg border divide-y max-h-64 overflow-y-auto">
              {deductions.map((d) => (
                <label key={d._id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer">
                  <Checkbox checked={selected.has(d._id)} onCheckedChange={() => toggle(d._id)} />
                  <div className="flex-1 min-w-0 text-sm">
                    <span className="font-medium">{formatDate(d.date)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{formatCompactInr(d.grossAmount)} @ {d.rate}%</span>
                  </div>
                  <span className="font-mono text-xs font-semibold tabular-nums">{formatCompactInr(d.tdsAmount)}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-primary/5 border-primary/30 px-3 py-2 flex justify-between text-sm">
          <span className="text-muted-foreground">Total Challan Amount</span>
          <span className="font-semibold tabular-nums text-primary">{formatCompactInr(totalAmount)}</span>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={submitting || selected.size === 0}>Record Challan Payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
