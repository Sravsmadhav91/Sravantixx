import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";

const TDS_SECTIONS: { value: string; label: string; rate: number }[] = [
  { value: "192A", label: "192A — Premature EPF withdrawal · 10%", rate: 10 },
  { value: "193", label: "193 — Interest on securities · 10%", rate: 10 },
  { value: "194B", label: "194B — Lottery / gambling · 30%", rate: 30 },
  { value: "194A", label: "194A — Interest other than securities", rate: 10 },
  { value: "194BA", label: "194BA — Online gaming · 30%", rate: 30 },
  { value: "194BB", label: "194BB — Horse racing · 30%", rate: 30 },
  { value: "194C", label: "194C — Contractor payments", rate: 1 },
  { value: "194D", label: "194D — Insurance commission · 2%", rate: 2 },
  { value: "194DA", label: "194DA — Life insurance payout · 2%", rate: 2 },
  { value: "194H", label: "194H — Commission / brokerage · 2%", rate: 2 },
  { value: "194I", label: "194I — Rent", rate: 10 },
  { value: "194J", label: "194J — Professional / technical fees", rate: 10 },
  { value: "194Q", label: "194Q — Purchase of goods", rate: 0.1 },
  { value: "VDA", label: "VDA — Crypto / VDA transactions · 1%", rate: 1 },
  { value: "194T", label: "194T — Partner remuneration · 10%", rate: 10 },
  { value: "195", label: "195 — Payments to non-residents", rate: 30 },
];

const schema = z.object({
  vendorId: z.string().min(1, "Vendor required"),
  section: z.string().min(1, "Section required"),
  date: z.string().min(1, "Date required"),
  grossAmount: z.string().min(1, "Required"),
  rate: z.string().min(1, "Required"),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ManualDeductionDialog({ open, onOpenChange }: Props) {
  const vendors = useQuery(api.vendors.listVendors, { active: true });
  const createDeduction = useMutation(api.tds.createManualDeduction);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vendorId: "",
      section: "194C",
      date: new Date().toISOString().slice(0, 10),
      grossAmount: "",
      rate: "1",
    },
  });

  const grossAmount = parseFloat(form.watch("grossAmount") || "0") || 0;
  const rate = parseFloat(form.watch("rate") || "0") || 0;
  const tdsAmount = useMemo(() => Math.round(grossAmount * (rate / 100)), [grossAmount, rate]);

  const handleSectionChange = (value: string) => {
    form.setValue("section", value);
    const preset = TDS_SECTIONS.find((s) => s.value === value);
    if (preset) form.setValue("rate", String(preset.rate));
  };

  const onSubmit = async (values: FormValues) => {
    try {
      await createDeduction({
        vendorId: values.vendorId as Id<"vendors">,
        section: values.section as "192" | "192A" | "193" | "194A" | "194B" | "194BA" | "194BB" | "194C" | "194D" | "194DA" | "194H" | "194I" | "194J" | "194Q" | "VDA" | "194T" | "195",
        date: values.date,
        grossAmount: parseFloat(values.grossAmount) || 0,
        rate: parseFloat(values.rate) || 0,
      });
      toast.success("TDS deduction recorded");
      onOpenChange(false);
      form.reset({ vendorId: "", section: "194C", date: new Date().toISOString().slice(0, 10), grossAmount: "", rate: "1" });
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to record deduction");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record TDS Deduction</DialogTitle>
          <DialogDescription>Log a manual deduction for a vendor payment (e.g. rent, professional fees).</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="vendorId" render={({ field }) => (
              <FormItem>
                <FormLabel>Vendor *</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    options={(vendors ?? []).map((v) => ({ value: v._id, label: v.name }))}
                    placeholder="Select vendor…"
                    searchPlaceholder="Search vendors…"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="section" render={({ field }) => (
              <FormItem>
                <FormLabel>TDS Section *</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value}
                    onValueChange={handleSectionChange}
                    options={TDS_SECTIONS.map((s) => ({ value: s.value, label: s.label }))}
                    placeholder="Select section…"
                    searchPlaceholder="Search…"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="rate" render={({ field }) => (
                <FormItem><FormLabel>Rate (%) *</FormLabel><FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="grossAmount" render={({ field }) => (
              <FormItem><FormLabel>Gross Amount (₹) *</FormLabel><FormControl><Input type="number" min="0" step="1" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="rounded-lg border bg-muted/30 px-3 py-2 flex justify-between text-sm">
              <span className="text-muted-foreground">TDS to Deduct</span>
              <span className="font-semibold tabular-nums">{formatCompactInr(tdsAmount)}</span>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>Record Deduction</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
