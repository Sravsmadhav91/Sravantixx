import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";

const schema = z.object({
  amount: z.string().min(1, "Required"),
  date: z.string().min(1, "Required"),
  reference: z.string().optional(),
  paymentAccountId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: Id<"purchaseInvoices">;
  outstanding: number;
  vendorName: string;
};

export default function RecordPaymentDialog({ open, onOpenChange, invoiceId, outstanding, vendorName }: Props) {
  const recordPayment = useMutation(api.vendors.recordPayment);
  const bankAccounts = useQuery(api.accounting.listAccounts, { group: "bank_and_cash" });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: String(outstanding),
      date: new Date().toISOString().slice(0, 10),
      reference: "",
      paymentAccountId: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await recordPayment({
        invoiceId,
        amount: parseFloat(values.amount) || 0,
        date: values.date,
        reference: values.reference || undefined,
        paymentAccountId: values.paymentAccountId ? values.paymentAccountId as Id<"accounts"> : undefined,
      });
      toast.success("Payment recorded");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error("Failed to record payment");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment — {vendorName}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground mb-2">
          Outstanding: <span className="font-semibold text-foreground">{formatCompactInr(outstanding)}</span>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (₹) *</FormLabel>
                <FormControl><Input type="number" min="1" step="0.01" placeholder="0.00" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Date *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="paymentAccountId" render={({ field }) => (
              <FormItem>
                <FormLabel>Paid From (Bank / Cash)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Default: Bank Account – Primary" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="default">Default (Bank Account – Primary)</SelectItem>
                    {bankAccounts?.map((a) => <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="reference" render={({ field }) => (
              <FormItem>
                <FormLabel>Reference (UTR / Cheque No.)</FormLabel>
                <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>Record Payment</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
