import { useEffect } from "react";
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

const today = () => new Date().toISOString().slice(0, 10);

const schema = z.object({
  type: z.enum(["work", "advance", "payment"]),
  date: z.string().min(1, "Required"),
  amount: z.string().min(1, "Required"),
  description: z.string().optional(),
  sourceAccountId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type LedgerEntryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labourerId: Id<"labourers"> | undefined;
  projectId?: Id<"projects"> | null;
};

export default function LedgerEntryDialog({ open, onOpenChange, labourerId, projectId }: LedgerEntryDialogProps) {
  const addEntry = useMutation(api.labour.addLedgerEntry);
  const accounts = useQuery(api.accounting.listAccounts, open ? { group: "bank_and_cash" } : "skip");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "work", date: today(), amount: "", description: "", sourceAccountId: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ type: "work", date: today(), amount: "", description: "", sourceAccountId: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const entryType = form.watch("type");
  const needsSourceAccount = entryType !== "work";

  const onSubmit = async (values: FormValues) => {
    if (!labourerId) return;
    if (needsSourceAccount && !values.sourceAccountId) {
      form.setError("sourceAccountId", { message: "Select the account this was paid from" });
      return;
    }
    try {
      await addEntry({
        labourerId,
        type: values.type,
        date: values.date,
        amount: Number(values.amount),
        projectId: projectId ?? undefined,
        description: values.description || undefined,
        sourceAccountId: needsSourceAccount ? (values.sourceAccountId as Id<"accounts">) : undefined,
      });
      toast.success("Ledger entry added");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ConvexError ? (error.data as { message: string }).message : "Could not add entry",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add ledger entry</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entry type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="work">Work done (amount owed)</SelectItem>
                      <SelectItem value="advance">Advance given</SelectItem>
                      <SelectItem value="payment">Payment made</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
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
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="5000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {needsSourceAccount && (
              <FormField
                control={form.control}
                name="sourceAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paid from</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select bank/cash account…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(accounts ?? []).map((a) => (
                          <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="3 days masonry work — 2nd floor" {...field} />
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
                Add entry
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
