import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Receipt } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { numericString } from "@/lib/form-schema.ts";
import { PAYMENT_MODE_LABELS } from "@/lib/payments.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { splitGstInclusive } from "@/lib/gst.ts";

const PAYMENT_MODES = Object.keys(PAYMENT_MODE_LABELS) as Doc<"receipts">["paymentMode"][];

const schema = z.object({
  installmentId: z.string().optional(),
  amount: numericString("Enter the amount"),
  paymentDate: z.string().min(1, "Enter the payment date"),
  paymentMode: z.enum(["cheque", "neft", "rtgs", "upi", "cash"]),
  referenceNumber: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

type RecordReceiptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: Id<"bookings">;
  installments: Doc<"paymentInstallments">[];
  gstPercent?: number;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RecordReceiptDialog({
  open,
  onOpenChange,
  bookingId,
  installments,
  gstPercent,
}: RecordReceiptDialogProps) {
  const recordReceipt = useMutation(api.payments.recordReceipt);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      installmentId: "none",
      amount: "",
      paymentDate: todayIso(),
      paymentMode: "neft",
      referenceNumber: "",
      notes: "",
    },
  });

  const selectedInstId = form.watch("installmentId");
  const watchAmount = form.watch("amount");
  const unpaidInstallments = installments.filter((i) => i.status !== "paid");
  const gstSplit = splitGstInclusive(Number(watchAmount) || 0, gstPercent);

  // Auto-fill amount when installment selected
  const handleInstallmentChange = (val: string) => {
    form.setValue("installmentId", val);
    if (val !== "none") {
      const inst = installments.find((i) => i._id === val);
      if (inst) form.setValue("amount", String(inst.amount));
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      await recordReceipt({
        bookingId,
        installmentId:
          values.installmentId && values.installmentId !== "none"
            ? (values.installmentId as Id<"paymentInstallments">)
            : undefined,
        amount: Number(values.amount),
        paymentDate: new Date(`${values.paymentDate}T00:00:00Z`).toISOString(),
        paymentMode: values.paymentMode,
        referenceNumber: values.referenceNumber || undefined,
        notes: values.notes || undefined,
      });
      toast.success("Receipt recorded");
      form.reset({
        installmentId: "none",
        amount: "",
        paymentDate: todayIso(),
        paymentMode: "neft",
        referenceNumber: "",
        notes: "",
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not record receipt",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record receipt</DialogTitle>
          <DialogDescription>
            Attach payment to an installment, or record as a standalone receipt.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {unpaidInstallments.length > 0 && (
              <FormField
                control={form.control}
                name="installmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link to milestone (optional)</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        value={field.value ?? "none"}
                        onValueChange={handleInstallmentChange}
                        options={[
                          { value: "none", label: "None" },
                          ...unpaidInstallments.map((i) => ({
                            value: i._id,
                            label: `${i.milestone} — ₹${i.amount.toLocaleString("en-IN")}`,
                            keywords: i.milestone,
                          })),
                        ]}
                        placeholder="None"
                        searchPlaceholder="Search milestones…"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount received (₹)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="100000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {gstSplit.gstPercent > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Receipt className="size-3.5" />
                  GST split ({gstSplit.gstPercent}%, inclusive)
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Base amount</span>
                  <span className="font-medium tabular-nums">{formatCompactInr(gstSplit.baseAmount)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">GST amount</span>
                  <span className="font-medium tabular-nums">{formatCompactInr(gstSplit.gstAmount)}</span>
                </div>
              </div>
            )}
            <FormField
              control={form.control}
              name="paymentDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paymentMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment mode</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {PAYMENT_MODE_LABELS[mode]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="referenceNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference / cheque number</FormLabel>
                  <FormControl>
                    <Input placeholder="UTR123456" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Record
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
