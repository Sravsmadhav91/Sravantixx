import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Button } from "@/components/ui/button.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { VOUCHER_CONFIG, type VoucherType } from "@/lib/accounting.ts";

const lineSchema = z.object({
  accountId: z.string().min(1, "Select an account"),
  amount: z.string().min(1, "Required"),
  narration: z.string().optional(),
  costCenterId: z.string().optional(),
});

const schema = z.object({
  date: z.string().min(1, "Date required"),
  primaryAccountId: z.string().min(1, "Select an account"),
  narration: z.string().min(1, "Narration required"),
  reference: z.string().optional(),
  lines: z.array(lineSchema).min(1, "At least 1 line required"),
  post: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  voucherType: VoucherType;
};

export default function VoucherDialog({ open, onOpenChange, voucherType }: Props) {
  const config = VOUCHER_CONFIG[voucherType];
  const accounts = useQuery(api.accounting.listAccounts, { activeOnly: true });
  const costCenters = useQuery(api.accounting.listCostCenters, { activeOnly: true });
  const createVoucher = useMutation(api.accounting.createVoucher);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      primaryAccountId: "",
      narration: "",
      reference: "",
      post: true,
      lines: [{ accountId: "", amount: "", narration: "", costCenterId: "" }],
    },
  });

  // Reset the form whenever a different voucher type dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        date: new Date().toISOString().slice(0, 10),
        primaryAccountId: "",
        narration: "",
        reference: "",
        post: true,
        lines: [{ accountId: "", amount: "", narration: "", costCenterId: "" }],
      });
    }
  }, [open, voucherType]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const watchLines = form.watch("lines");
  const totalLines = watchLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

  const accountOptions = (accounts ?? []).map((a) => ({
    value: a._id,
    label: `${a.code} — ${a.name}`,
    keywords: `${a.code} ${a.name} ${a.type}`,
  }));

  const costCenterOptions = (costCenters ?? []).map((c) => ({
    value: c._id,
    label: `${c.code} — ${c.name}`,
    keywords: `${c.code} ${c.name}`,
  }));

  const onSubmit = async (values: FormValues) => {
    try {
      const lineEntries = values.lines.map((l) => ({
        accountId: l.accountId as Id<"accounts">,
        side: config.lineSide,
        amount: parseFloat(l.amount) || 0,
        narration: l.narration || undefined,
        costCenterId: l.costCenterId ? (l.costCenterId as Id<"costCenters">) : undefined,
      }));
      await createVoucher({
        voucherType,
        date: values.date,
        narration: values.narration,
        reference: values.reference || undefined,
        primaryAccountId: values.primaryAccountId as Id<"accounts">,
        lines: [
          {
            accountId: values.primaryAccountId as Id<"accounts">,
            side: config.primarySide,
            amount: totalLines,
          },
          ...lineEntries,
        ],
        post: values.post,
      });
      toast.success(values.post ? `${config.label} posted` : "Draft saved");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error(`Failed to save ${config.label.toLowerCase()}`);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New {config.label}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference</FormLabel>
                    <FormControl>
                      <Input placeholder="Cheque no, UTR…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="primaryAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{config.primaryLabel}</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      value={field.value}
                      onValueChange={field.onChange}
                      options={accountOptions}
                      placeholder={config.primaryPlaceholder}
                      searchPlaceholder="Search accounts…"
                      triggerClassName="w-full"
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
                  <FormLabel>Narration</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Being amount paid/received for…" rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_110px_1fr_36px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>{config.lineLabel}</span>
                <span>Amount (₹)</span>
                <span>Narration</span>
                <span />
              </div>

              {fields.map((field, idx) => (
                <div key={field.id} className="space-y-1.5 rounded-md border border-transparent p-1 -m-1">
                  <div className="grid grid-cols-[1fr_110px_1fr_36px] gap-2 items-start">
                    <FormField
                      control={form.control}
                      name={`lines.${idx}.accountId`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormControl>
                            <SearchableSelect
                              value={f.value}
                              onValueChange={f.onChange}
                              options={accountOptions}
                              placeholder={config.linePlaceholder}
                              searchPlaceholder="Search accounts…"
                              size="sm"
                              triggerClassName="w-full"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lines.${idx}.amount`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="h-8 text-xs"
                              placeholder="0.00"
                              {...f}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lines.${idx}.narration`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormControl>
                            <Input className="h-8 text-xs" placeholder="Optional…" {...f} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => fields.length > 1 && remove(idx)}
                      disabled={fields.length <= 1}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  {costCenterOptions.length > 0 && (
                    <FormField
                      control={form.control}
                      name={`lines.${idx}.costCenterId`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormControl>
                            <SearchableSelect
                              value={f.value ?? ""}
                              onValueChange={f.onChange}
                              options={costCenterOptions}
                              placeholder="Cost center (optional)…"
                              searchPlaceholder="Search cost centers…"
                              size="sm"
                              triggerClassName="w-full max-w-xs"
                              allowClear
                              clearLabel="No cost center"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => append({ accountId: "", amount: "", narration: "", costCenterId: "" })}
              >
                <Plus className="size-3.5" /> Add line
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                {totalLines <= 0 && <AlertCircle className="size-4 text-muted-foreground" />}
                <span>Total: {formatCompactInr(totalLines)}</span>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="submit"
                variant="secondary"
                onClick={() => form.setValue("post", false)}
              >
                Save as Draft
              </Button>
              <Button
                type="submit"
                disabled={totalLines <= 0}
                onClick={() => form.setValue("post", true)}
              >
                Post {config.label}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
