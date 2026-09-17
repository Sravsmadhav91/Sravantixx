import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
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
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";

const today = () => new Date().toISOString().slice(0, 10);

const schema = z.object({
  paidDate: z.string().min(1, "Required"),
  bankAccountId: z.string().min(1, "Select a bank account"),
  interestExpenseAccountId: z.string().min(1, "Select an interest expense account"),
});

type FormValues = z.infer<typeof schema>;

type RecordEmiDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installment: Doc<"loanInstallments"> | null;
};

export default function RecordEmiDialog({ open, onOpenChange, installment }: RecordEmiDialogProps) {
  const recordPayment = useMutation(api.loans.recordInstallmentPayment);
  const bankAccounts = useQuery(api.accounting.listAccounts, open ? { group: "bank_and_cash" } : "skip");
  const expenseAccounts = useQuery(api.accounting.listAccounts, open ? { type: "expense" } : "skip");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { paidDate: today(), bankAccountId: "", interestExpenseAccountId: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ paidDate: today(), bankAccountId: "", interestExpenseAccountId: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, installment?._id]);

  const onSubmit = async (values: FormValues) => {
    if (!installment) return;
    try {
      await recordPayment({
        installmentId: installment._id,
        paidDate: values.paidDate,
        bankAccountId: values.bankAccountId as Id<"accounts">,
        interestExpenseAccountId: values.interestExpenseAccountId as Id<"accounts">,
      });
      toast.success("EMI payment recorded");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ConvexError ? (error.data as { message: string }).message : "Could not record payment",
      );
    }
  };

  const bankOptions = (bankAccounts ?? []).map((a) => ({ value: a._id, label: `${a.code} — ${a.name}` }));
  const expenseOptions = (expenseAccounts ?? []).map((a) => ({ value: a._id, label: `${a.code} — ${a.name}` }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record EMI #{installment?.installmentNumber}</DialogTitle>
        </DialogHeader>
        {installment && (
          <p className="text-sm text-muted-foreground">
            Total {formatCompactInr(installment.totalAmount)} — Principal {formatCompactInr(installment.principalComponent)}, Interest {formatCompactInr(installment.interestComponent)}
          </p>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="paidDate"
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
              name="bankAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pay from</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={bankOptions}
                      value={field.value || "none"}
                      onValueChange={(val: string) => field.onChange(val === "none" ? "" : val)}
                      placeholder="Select bank/cash account…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="interestExpenseAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Interest expense account</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={expenseOptions}
                      value={field.value || "none"}
                      onValueChange={(val: string) => field.onChange(val === "none" ? "" : val)}
                      placeholder="Select expense account…"
                    />
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
                Record payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
