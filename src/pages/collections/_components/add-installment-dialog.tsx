import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
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
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { numericString } from "@/lib/form-schema.ts";

const schema = z.object({
  milestone: z.string().trim().min(1, "Enter a milestone name"),
  dueDate: z.string().optional(),
  amount: numericString("Enter the amount"),
  notes: z.string().trim().optional(),
  triggerStageId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type AddInstallmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: Id<"bookings">;
  /** Project the booking's unit belongs to — used to offer construction-stage triggers. */
  projectId?: Id<"projects">;
};

const COMMON_MILESTONES = [
  "On Booking",
  "On Agreement",
  "On Slab 1",
  "On Slab 2",
  "On Slab 3",
  "On Terrace",
  "On Possession",
];

export default function AddInstallmentDialog({
  open,
  onOpenChange,
  bookingId,
  projectId,
}: AddInstallmentDialogProps) {
  const addInstallment = useMutation(api.payments.addInstallment);
  const stages = useQuery(
    api.construction.listStages,
    projectId && open ? { projectId } : "skip",
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { milestone: "", dueDate: "", amount: "", notes: "", triggerStageId: "" },
  });

  const stageOptions =
    stages?.map((s) => ({ value: s._id, label: `${s.name} (${s.percentComplete}%)` })) ?? [];

  const onSubmit = async (values: FormValues) => {
    try {
      await addInstallment({
        bookingId,
        milestone: values.milestone,
        dueDate: values.dueDate
          ? new Date(`${values.dueDate}T00:00:00Z`).toISOString()
          : undefined,
        amount: Number(values.amount),
        notes: values.notes || undefined,
        triggerStageId: values.triggerStageId
          ? (values.triggerStageId as Id<"constructionStages">)
          : undefined,
      });
      toast.success("Milestone added");
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not add milestone",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add payment milestone</DialogTitle>
          <DialogDescription>
            Define when a portion of the agreement value is due.
          </DialogDescription>
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
                    <Input placeholder="On Possession" {...field} />
                  </FormControl>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {COMMON_MILESTONES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => form.setValue("milestone", m)}
                        className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted cursor-pointer"
                      >
                        {m}
                      </button>
                    ))}
                  </div>
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
                    <Input type="number" placeholder="500000" {...field} />
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
                  <FormLabel>Due date (optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {projectId && stageOptions.length > 0 && (
              <FormField
                control={form.control}
                name="triggerStageId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Auto-demand on construction stage (optional)</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={stageOptions}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder="No trigger — demand manually"
                        emptyText="No stages found"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      This installment is automatically demanded once the selected stage reaches 100%.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
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
                Add milestone
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
