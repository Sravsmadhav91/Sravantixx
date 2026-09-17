import { useEffect } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { VENDOR_CATEGORIES } from "@/lib/vendors.ts";

const lineSchema = z.object({
  description: z.string().min(1, "Required"),
  accountId: z.string().optional(),
  quantity: z.string().min(1, "Required"),
  unit: z.string().optional(),
  rate: z.string().min(1, "Required"),
  gstRate: z.string().optional(),
});

const schema = z.object({
  vendorId: z.string().min(1, "Select a vendor"),
  date: z.string().min(1, "Required"),
  expectedDeliveryDate: z.string().optional(),
  projectId: z.string().optional(),
  narration: z.string().optional(),
  lines: z.array(lineSchema).min(1, "Add at least one line item"),
  cgst: z.string().optional(),
  sgst: z.string().optional(),
  igst: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function num(v: string | undefined): number {
  const n = parseFloat(v ?? "");
  return isNaN(n) ? 0 : n;
}

type PurchaseOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po?: Doc<"purchaseOrders"> & { lines?: Doc<"purchaseOrderLines">[] };
  preselectedVendorId?: Id<"vendors">;
};

export default function PurchaseOrderDialog({
  open,
  onOpenChange,
  po,
  preselectedVendorId,
}: PurchaseOrderDialogProps) {
  const createPO = useMutation(api.purchaseOrders.createPurchaseOrder);
  const updatePO = useMutation(api.purchaseOrders.updatePurchaseOrder);

  const vendors = useQuery(api.vendors.listVendors, open ? { active: true } : "skip");
  const projects = useQuery(api.projects.list, open ? {} : "skip");
  const accounts = useQuery(api.accounting.listAccounts, open ? {} : "skip");

  const expenseAccounts = accounts?.filter(
    (a) => a.type === "expense" || a.code?.startsWith("4") || a.code?.startsWith("5"),
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vendorId: preselectedVendorId ?? "",
      date: todayIso(),
      expectedDeliveryDate: "",
      projectId: "",
      narration: "",
      lines: [{ description: "", quantity: "1", unit: "", rate: "", gstRate: "" }],
      cgst: "",
      sgst: "",
      igst: "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const watched = useWatch({ control: form.control });

  useEffect(() => {
    if (open) {
      if (po) {
        form.reset({
          vendorId: po.vendorId,
          date: po.date,
          expectedDeliveryDate: po.expectedDeliveryDate ?? "",
          projectId: po.projectId ?? "",
          narration: po.narration ?? "",
          lines: (po.lines ?? [{ description: "", quantity: "1", unit: "", rate: "", gstRate: "" }]).map((l) => ({
            description: l.description,
            accountId: "accountId" in l && l.accountId ? String(l.accountId) : "",
            quantity: String(l.quantity),
            unit: l.unit ?? "",
            rate: String(l.rate),
            gstRate: l.gstRate != null ? String(l.gstRate) : "",
          })),
          cgst: String(po.cgst || ""),
          sgst: String(po.sgst || ""),
          igst: String(po.igst || ""),
        });
      } else {
        form.reset({
          vendorId: preselectedVendorId ?? "",
          date: todayIso(),
          expectedDeliveryDate: "",
          projectId: "",
          narration: "",
          lines: [{ description: "", quantity: "1", unit: "", rate: "", gstRate: "" }],
          cgst: "",
          sgst: "",
          igst: "",
        });
      }
    }
  }, [open, po, preselectedVendorId, form]);

  // Compute totals live
  const subtotal = (watched.lines ?? []).reduce((s, l) => s + num(l.quantity) * num(l.rate), 0);
  const cgst = num(watched.cgst);
  const sgst = num(watched.sgst);
  const igst = num(watched.igst);
  const total = subtotal + cgst + sgst + igst;

  const onSubmit = async (values: FormValues) => {
    const lines = values.lines.map((l) => ({
      description: l.description,
      accountId: l.accountId ? (l.accountId as Id<"accounts">) : undefined,
      quantity: num(l.quantity),
      unit: l.unit || undefined,
      rate: num(l.rate),
      amount: Math.round(num(l.quantity) * num(l.rate) * 100) / 100,
      gstRate: l.gstRate ? num(l.gstRate) : undefined,
    }));

    try {
      if (po) {
        await updatePO({
          poId: po._id,
          vendorId: values.vendorId as Id<"vendors">,
          date: values.date,
          expectedDeliveryDate: values.expectedDeliveryDate || undefined,
          projectId: values.projectId ? (values.projectId as Id<"projects">) : undefined,
          narration: values.narration || undefined,
          lines,
          cgst: num(values.cgst),
          sgst: num(values.sgst),
          igst: num(values.igst),
        });
        toast.success("Purchase order updated");
      } else {
        await createPO({
          vendorId: values.vendorId as Id<"vendors">,
          date: values.date,
          expectedDeliveryDate: values.expectedDeliveryDate || undefined,
          projectId: values.projectId ? (values.projectId as Id<"projects">) : undefined,
          narration: values.narration || undefined,
          lines,
          cgst: num(values.cgst),
          sgst: num(values.sgst),
          igst: num(values.igst),
        });
        toast.success("Purchase order created");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Could not save purchase order",
      );
    }
  };

  const vendorOptions =
    vendors?.map((v) => ({
      value: v._id,
      label: `${v.name} (${VENDOR_CATEGORIES.find((c) => c.value === v.category)?.label ?? v.category})`,
    })) ?? [];

  const projectOptions = [
    { value: "none", label: "— No project —" },
    ...(projects?.map((p) => ({ value: p._id, label: p.name })) ?? []),
  ];

  const accountOptions = [
    { value: "none", label: "— Default —" },
    ...(expenseAccounts?.map((a) => ({ value: a._id, label: `${a.code} ${a.name}` })) ?? []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{po ? `Edit ${po.poNumber}` : "New Purchase Order"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Header row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="vendorId"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Vendor</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={vendorOptions}
                        value={field.value || "none"}
                        onValueChange={(val: string) => field.onChange(val === "none" ? "" : val)}
                        placeholder="Select vendor…"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PO date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expectedDeliveryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected delivery</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project (optional)</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={projectOptions}
                        value={field.value || "none"}
                        onValueChange={(val: string) => field.onChange(val === "none" ? "" : val)}
                        placeholder="Select project…"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="narration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Narration / remarks</FormLabel>
                    <FormControl><Input placeholder="e.g. Bricks for Block A" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Line items</p>

            {/* Lines table */}
            <div className="space-y-2">
              {fields.map((field, idx) => {
                const qty = num(watched.lines?.[idx]?.quantity);
                const rate = num(watched.lines?.[idx]?.rate);
                const lineTotal = Math.round(qty * rate * 100) / 100;
                return (
                  <div key={field.id} className="rounded-lg border border-border p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <FormField
                        control={form.control}
                        name={`lines.${idx}.description`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-xs">Description</FormLabel>
                            <FormControl>
                              <Input placeholder="Item description" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-6 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(idx)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <FormField
                        control={form.control}
                        name={`lines.${idx}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Qty</FormLabel>
                            <FormControl><Input type="number" step="any" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lines.${idx}.unit`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Unit</FormLabel>
                            <FormControl><Input placeholder="bags, sqft…" {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lines.${idx}.rate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Rate (₹)</FormLabel>
                            <FormControl><Input type="number" step="any" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lines.${idx}.gstRate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">GST %</FormLabel>
                            <FormControl><Input type="number" step="any" placeholder="18" {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={`lines.${idx}.accountId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Expense account</FormLabel>
                            <FormControl>
                              <SearchableSelect
                                options={accountOptions}
                                value={field.value || "none"}
                                onValueChange={(val: string) => field.onChange(val === "none" ? "" : val)}
                                placeholder="Default"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="flex items-end pb-0.5">
                        <p className="text-sm text-muted-foreground">
                          Amount: <span className="font-semibold text-foreground tabular-nums">{formatCompactInr(lineTotal)}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => append({ description: "", quantity: "1", unit: "", rate: "", gstRate: "", accountId: "" })}
              >
                <Plus className="size-4" />
                Add line
              </Button>
            </div>

            <Separator />

            {/* Tax fields */}
            <div className="grid gap-3 sm:grid-cols-3">
              {(["cgst", "sgst", "igst"] as const).map((field) => (
                <FormField
                  key={field}
                  control={form.control}
                  name={field}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs">{field} (₹)</FormLabel>
                      <FormControl><Input type="number" step="any" placeholder="0" {...f} /></FormControl>
                    </FormItem>
                  )}
                />
              ))}
            </div>

            {/* Summary */}
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCompactInr(subtotal)}</span>
              </div>
              {(cgst > 0 || sgst > 0 || igst > 0) && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax (CGST + SGST + IGST)</span>
                  <span className="tabular-nums">{formatCompactInr(cgst + sgst + igst)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t border-border pt-1.5">
                <span>Total</span>
                <span className="tabular-nums text-primary">{formatCompactInr(total)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {po ? "Save changes" : "Create PO"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
