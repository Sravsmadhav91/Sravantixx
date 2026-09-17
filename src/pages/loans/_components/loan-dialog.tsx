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
  FormDescription,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";

const today = () => new Date().toISOString().slice(0, 10);

const schema = z.object({
  lenderName: z.string().min(1, "Required"),
  accountNumber: z.string().optional(),
  projectId: z.string().optional(),
  principal: z.string().min(1, "Required"),
  interestRatePercent: z.string().min(1, "Required"),
  tenureMonths: z.string().min(1, "Required"),
  emiFrequency: z.enum(["monthly", "quarterly"]),
  startDate: z.string().min(1, "Required"),
  liabilityAccountId: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type LoanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function LoanDialog({ open, onOpenChange }: LoanDialogProps) {
  const createLoan = useMutation(api.loans.createLoan);
  const projects = useQuery(api.projects.list, open ? {} : "skip");
  const accounts = useQuery(api.accounting.listAccounts, open ? { type: "liability" } : "skip");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      lenderName: "",
      accountNumber: "",
      projectId: "",
      principal: "",
      interestRatePercent: "",
      tenureMonths: "",
      emiFrequency: "monthly",
      startDate: today(),
      liabilityAccountId: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        lenderName: "",
        accountNumber: "",
        projectId: "",
        principal: "",
        interestRatePercent: "",
        tenureMonths: "",
        emiFrequency: "monthly",
        startDate: today(),
        liabilityAccountId: "",
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = async (values: FormValues) => {
    try {
      await createLoan({
        lenderName: values.lenderName,
        accountNumber: values.accountNumber || undefined,
        projectId: values.projectId ? (values.projectId as Id<"projects">) : undefined,
        principal: Number(values.principal),
        interestRatePercent: Number(values.interestRatePercent),
        tenureMonths: Number(values.tenureMonths),
        emiFrequency: values.emiFrequency,
        startDate: values.startDate,
        liabilityAccountId: values.liabilityAccountId ? (values.liabilityAccountId as Id<"accounts">) : undefined,
        notes: values.notes || undefined,
      });
      toast.success("Loan created with repayment schedule");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ConvexError ? (error.data as { message: string }).message : "Could not create loan",
      );
    }
  };

  const projectOptions = (projects ?? []).map((p) => ({ value: p._id, label: p.name }));
  const accountOptions = (accounts ?? []).map((a) => ({ value: a._id, label: `${a.code} — ${a.name}` }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New business loan</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="lenderName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lender</FormLabel>
                  <FormControl>
                    <Input placeholder="HDFC Bank — Project Finance" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="accountNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan / sanction no. (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="LN-00123" {...field} />
                    </FormControl>
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
                        allowClear
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="principal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Principal (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="5000000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="interestRatePercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interest rate % p.a.</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="9.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tenureMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Installments</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="60" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="emiFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EMI frequency</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date</FormLabel>
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
              name="liabilityAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Liability account (optional)</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={accountOptions}
                      value={field.value || "none"}
                      onValueChange={(val: string) => field.onChange(val === "none" ? "" : val)}
                      placeholder="Select account…"
                      allowClear
                    />
                  </FormControl>
                  <FormDescription>Required to post repayment journal entries when recording EMI payments.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
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
                Create loan
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
