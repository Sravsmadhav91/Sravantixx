import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel";
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
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { numericString } from "@/lib/form-schema.ts";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
} from "@/lib/construction.ts";

const schema = z.object({
  description: z.string().trim().min(1, "Enter description"),
  category: z.enum([
    "material",
    "labour",
    "approvals",
    "legal",
    "marketing",
    "other",
  ]),
  vendor: z.string().trim().optional(),
  amount: numericString("Enter amount"),
  expenseDate: z.string().min(1, "Enter date"),
  stageId: z.string().optional(),
  notes: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

type ExpenseFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects">;
  expense?: Doc<"projectExpenses">;
  stages?: Doc<"constructionStages">[];
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpenseFormDialog({
  open,
  onOpenChange,
  projectId,
  expense,
  stages = [],
}: ExpenseFormDialogProps) {
  const addExpense = useMutation(api.construction.addExpense);
  const updateExpense = useMutation(api.construction.updateExpense);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: "",
      category: "material",
      vendor: "",
      amount: "",
      expenseDate: todayIso(),
      stageId: "none",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        expense
          ? {
              description: expense.description,
              category: expense.category,
              vendor: expense.vendor ?? "",
              amount: String(expense.amount),
              expenseDate: expense.expenseDate.slice(0, 10),
              stageId: expense.stageId ?? "none",
              notes: expense.notes ?? "",
            }
          : {
              description: "",
              category: "material",
              vendor: "",
              amount: "",
              expenseDate: todayIso(),
              stageId: "none",
              notes: "",
            },
      );
    }
  }, [open, expense, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        description: values.description,
        category: values.category,
        vendor: values.vendor || undefined,
        amount: Number(values.amount),
        expenseDate: new Date(`${values.expenseDate}T00:00:00Z`).toISOString(),
        stageId:
          values.stageId && values.stageId !== "none"
            ? (values.stageId as Id<"constructionStages">)
            : undefined,
        notes: values.notes || undefined,
      };
      if (expense) {
        await updateExpense({ expenseId: expense._id, ...payload });
        toast.success("Expense updated");
      } else {
        await addExpense({ projectId, ...payload });
        toast.success("Expense recorded");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not save expense",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "Record expense"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="TMT steel bars — lot 3" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {stages.length > 0 && (
              <FormField
                control={form.control}
                name="stageId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Construction stage (optional)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No stage</SelectItem>
                        {stages.map((s) => (
                          <SelectItem key={s._id} value={s._id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {EXPENSE_CATEGORY_LABELS[c]}
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
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="250000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="vendor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Shree Steel Co." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expenseDate"
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
            </div>
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
                {expense ? "Save changes" : "Record expense"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
