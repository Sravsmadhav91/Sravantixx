import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel";
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
import { numericString } from "@/lib/form-schema.ts";

const schema = z.object({
  milestone: z.string().trim().min(1, "Enter a milestone name"),
  dueDate: z.string().optional(),
  amount: numericString("Enter the amount"),
  notes: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

type EditInstallmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installment: Doc<"paymentInstallments">;
};

export default function EditInstallmentDialog({
  open,
  onOpenChange,
  installment,
}: EditInstallmentDialogProps) {
  const updateInstallment = useMutation(api.payments.updateInstallment);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      milestone: installment.milestone,
      dueDate: installment.dueDate ? installment.dueDate.slice(0, 10) : "",
      amount: String(installment.amount),
      notes: installment.notes ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        milestone: installment.milestone,
        dueDate: installment.dueDate ? installment.dueDate.slice(0, 10) : "",
        amount: String(installment.amount),
        notes: installment.notes ?? "",
      });
    }
  }, [open, installment, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      await updateInstallment({
        installmentId: installment._id,
        milestone: values.milestone,
        dueDate: values.dueDate
          ? new Date(`${values.dueDate}T00:00:00Z`).toISOString()
          : undefined,
        amount: Number(values.amount),
        notes: values.notes || undefined,
      });
      toast.success("Milestone updated");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not update milestone",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit milestone</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="milestone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Milestone</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (₹)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
