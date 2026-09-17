import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";

const lineSchema = z.object({
  accountId: z.string().min(1, "Select an account"),
  side: z.enum(["debit", "credit"]),
  amount: z.string().min(1, "Required"),
  narration: z.string().optional(),
  costCenterId: z.string().optional(),
});

const schema = z.object({
  date: z.string().min(1, "Date required"),
  narration: z.string().min(1, "Narration required"),
  reference: z.string().optional(),
  lines: z.array(lineSchema).min(2, "At least 2 lines required"),
  post: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

export default function JournalEntryDialog({ open, onOpenChange }: Props) {
  const accounts = useQuery(api.accounting.listAccounts, { activeOnly: true });
  const costCenters = useQuery(api.accounting.listCostCenters, { activeOnly: true });
  const createEntry = useMutation(api.accounting.createJournalEntry);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      narration: "",
      reference: "",
      post: true,
      lines: [
        { accountId: "", side: "debit" as const, amount: "", narration: "", costCenterId: "" },
        { accountId: "", side: "credit" as const, amount: "", narration: "", costCenterId: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const watchLines = form.watch("lines");
  const totalDebit = watchLines.filter((l) => l.side === "debit").reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const totalCredit = watchLines.filter((l) => l.side === "credit").reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

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
      await createEntry({
        date: values.date,
        narration: values.narration,
        reference: values.reference || undefined,
        lines: values.lines.map((l) => ({
          accountId: l.accountId as Id<"accounts">,
          side: l.side,
          amount: parseFloat(l.amount) || 0,
          narration: l.narration || undefined,
          costCenterId: l.costCenterId ? (l.costCenterId as Id<"costCenters">) : undefined,
        })),
        post: values.post,
      });
      toast.success(values.post ? "Journal entry posted" : "Draft saved");
      form.reset();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to save entry");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Journal Entry</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Header fields */}
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

            {/* Lines */}
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_90px_110px_1fr_36px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>Account</span>
                <span>Dr / Cr</span>
                <span>Amount (₹)</span>
                <span>Narration</span>
                <span />
              </div>

              {fields.map((field, idx) => (
                <div key={field.id} className="space-y-1.5 rounded-md border border-transparent p-1 -m-1">
                  <div className="grid grid-cols-[1fr_90px_110px_1fr_36px] gap-2 items-start">
                    {/* Account — searchable */}
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
                              placeholder="Account…"
                              searchPlaceholder="Search accounts…"
                              size="sm"
                              triggerClassName="w-full"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {/* Dr / Cr */}
                    <FormField
                      control={form.control}
                      name={`lines.${idx}.side`}
                      render={({ field: f }) => (
                        <FormItem>
                          <Select onValueChange={f.onChange} value={f.value}>
                            <FormControl>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="debit">Dr</SelectItem>
                              <SelectItem value="credit">Cr</SelectItem>
                            </SelectContent>
                          </Select>
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
                      onClick={() => fields.length > 2 && remove(idx)}
                      disabled={fields.length <= 2}
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
                onClick={() => append({ accountId: "", side: "credit" as const, amount: "", narration: "", costCenterId: "" })}
              >
                <Plus className="size-3.5" /> Add line
              </Button>
            </div>

            {/* Balance indicator */}
            <div className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${isBalanced ? "border-green-500/30 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
              <div className="flex items-center gap-2">
                {!isBalanced && <AlertCircle className="size-4" />}
                <span>Debit: {formatCompactInr(totalDebit)}</span>
                <span className="text-muted-foreground">|</span>
                <span>Credit: {formatCompactInr(totalCredit)}</span>
              </div>
              <span className="font-medium">{isBalanced ? "Balanced ✓" : `Diff: ${formatCompactInr(Math.abs(totalDebit - totalCredit))}`}</span>
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
                disabled={!isBalanced}
                onClick={() => form.setValue("post", true)}
              >
                Post Entry
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
