import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Label } from "@/components/ui/label.tsx";
import { cn } from "@/lib/utils.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";

const lineSchema = z.object({
  description: z.string().min(1, "Required"),
  accountId: z.string().optional(),
  quantity: z.string().min(1, "Required"),
  unit: z.string().optional(),
  rate: z.string().min(1, "Required"),
  gstRate: z.string().optional(),
});

const schema = z.object({
  vendorId: z.string().min(1, "Vendor required"),
  invoiceNumber: z.string().min(1, "Invoice number required"),
  date: z.string().min(1, "Date required"),
  dueDate: z.string().optional(),
  projectId: z.string().optional(),
  narration: z.string().optional(),
  lines: z.array(lineSchema).min(1, "At least one line item required"),
  cgst: z.string().optional(),
  sgst: z.string().optional(),
  igst: z.string().optional(),
  tds: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedVendorId?: Id<"vendors">;
};

export default function PurchaseInvoiceDialog({ open, onOpenChange, preselectedVendorId }: Props) {
  const createInvoice = useMutation(api.vendors.createPurchaseInvoice);
  const vendors = useQuery(api.vendors.listVendors, { active: true });
  const accounts = useQuery(api.accounting.listAccounts, { type: "expense" });
  const projects = useQuery(api.projects.list, {});

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vendorId: preselectedVendorId ?? "",
      invoiceNumber: "",
      date: new Date().toISOString().slice(0, 10),
      dueDate: "",
      projectId: "",
      narration: "",
      lines: [{ description: "", accountId: "", quantity: "1", unit: "", rate: "", gstRate: "" }],
      cgst: "0",
      sgst: "0",
      igst: "0",
      tds: "0",
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const watchLines = form.watch("lines");
  const cgst = parseFloat(form.watch("cgst") || "0") || 0;
  const sgst = parseFloat(form.watch("sgst") || "0") || 0;
  const igst = parseFloat(form.watch("igst") || "0") || 0;
  const tds = parseFloat(form.watch("tds") || "0") || 0;

  const subtotal = watchLines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0), 0);
  const total = subtotal + cgst + sgst + igst - tds;

  const onSubmit = async (values: FormValues) => {
    try {
      await createInvoice({
        vendorId: values.vendorId as Id<"vendors">,
        invoiceNumber: values.invoiceNumber,
        date: values.date,
        dueDate: values.dueDate || undefined,
        projectId: values.projectId ? values.projectId as Id<"projects"> : undefined,
        narration: values.narration || undefined,
        lines: values.lines.map((l) => ({
          description: l.description,
          accountId: l.accountId ? l.accountId as Id<"accounts"> : undefined,
          quantity: parseFloat(l.quantity) || 1,
          unit: l.unit || undefined,
          rate: parseFloat(l.rate) || 0,
          amount: (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0),
          gstRate: l.gstRate ? parseFloat(l.gstRate) : undefined,
        })),
        cgst: parseFloat(values.cgst || "0") || 0,
        sgst: parseFloat(values.sgst || "0") || 0,
        igst: parseFloat(values.igst || "0") || 0,
        tds: parseFloat(values.tds || "0") || 0,
      });
      toast.success("Purchase invoice created");
      onOpenChange(false);
      form.reset();
    } catch (err) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error("Failed to create invoice");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Purchase Invoice</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Header */}
            <div className="grid grid-cols-2 gap-3">
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
              <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor Invoice No. *</FormLabel>
                  <FormControl><Input placeholder="INV-001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Date *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dueDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project (optional)</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      options={[
                        { value: "none", label: "None" },
                        ...(projects ?? []).map((p) => ({ value: p._id, label: p.name })),
                      ]}
                      placeholder="Link to project…"
                      searchPlaceholder="Search projects…"
                      allowClear
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="narration" render={({ field }) => (
                <FormItem>
                  <FormLabel>Narration</FormLabel>
                  <FormControl><Input placeholder="Brief description…" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Line Items</Label>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-xs font-medium text-muted-foreground">
                      <th className="px-2 py-1.5 text-left min-w-[160px]">Description</th>
                      <th className="px-2 py-1.5 text-left min-w-[130px]">Account</th>
                      <th className="px-2 py-1.5 text-right w-16">Qty</th>
                      <th className="px-2 py-1.5 text-right w-24">Rate (₹)</th>
                      <th className="px-2 py-1.5 text-right w-24">Amount (₹)</th>
                      <th className="px-2 py-1.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {fields.map((field, idx) => {
                      const qty = parseFloat(form.watch(`lines.${idx}.quantity`) || "0") || 0;
                      const rate = parseFloat(form.watch(`lines.${idx}.rate`) || "0") || 0;
                      return (
                        <tr key={field.id}>
                          <td className="px-2 py-1">
                            <Input className="h-7 text-xs" placeholder="Description…" {...form.register(`lines.${idx}.description`)} />
                          </td>
                          <td className="px-2 py-1">
                            <SearchableSelect
                              value={form.watch(`lines.${idx}.accountId`) ?? ""}
                              onValueChange={(v) => form.setValue(`lines.${idx}.accountId`, v)}
                              options={[
                                { value: "none", label: "Auto" },
                                ...(accounts ?? []).map((a) => ({ value: a._id, label: a.name })),
                              ]}
                              placeholder="Expense acct…"
                              searchPlaceholder="Search accounts…"
                              size="sm"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Input className="h-7 text-xs text-right" type="number" min="0.01" step="0.01" {...form.register(`lines.${idx}.quantity`)} />
                          </td>
                          <td className="px-2 py-1">
                            <Input className="h-7 text-xs text-right" type="number" min="0" step="0.01" {...form.register(`lines.${idx}.rate`)} />
                          </td>
                          <td className="px-2 py-1 text-right font-mono text-xs pr-3 tabular-nums">
                            {formatCompactInr(qty * rate)}
                          </td>
                          <td className="px-1 py-1">
                            {fields.length > 1 && (
                              <button type="button" onClick={() => remove(idx)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Button type="button" size="sm" variant="ghost" className="text-xs"
                onClick={() => append({ description: "", accountId: "", quantity: "1", unit: "", rate: "", gstRate: "" })}>
                <Plus className="size-3.5" /> Add Line
              </Button>
            </div>

            {/* Tax & Totals */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Tax & Deductions</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["cgst", "sgst", "igst", "tds"] as const).map((field) => (
                    <FormField key={field} control={form.control} name={field} render={({ field: f }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs">{field}</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" placeholder="0" {...f} />
                        </FormControl>
                      </FormItem>
                    )} />
                  ))}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm self-start">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono tabular-nums">{formatCompactInr(subtotal)}</span></div>
                {cgst > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>CGST</span><span>+ {formatCompactInr(cgst)}</span></div>}
                {sgst > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>SGST</span><span>+ {formatCompactInr(sgst)}</span></div>}
                {igst > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>IGST</span><span>+ {formatCompactInr(igst)}</span></div>}
                {tds > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>TDS</span><span>- {formatCompactInr(tds)}</span></div>}
                <div className="flex justify-between border-t pt-1.5 font-semibold"><span>Total</span><span className="tabular-nums">{formatCompactInr(total)}</span></div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>Create Invoice</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
