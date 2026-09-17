import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel";
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
import {
  ACCOUNT_GROUPS_BY_TYPE,
  ACCOUNT_GROUP_LABELS,
  ACCOUNT_TYPE_LABELS,
  type AccountType,
} from "@/lib/accounting.ts";

const schema = z.object({
  code: z.string().min(1, "Code required"),
  name: z.string().min(1, "Name required"),
  type: z.enum(["asset", "liability", "income", "expense", "equity"]),
  group: z.string().min(1, "Group required"),
  openingBalance: z.string().optional(),
  openingBalanceDate: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: Doc<"accounts">;
};

export default function AccountFormDialog({ open, onOpenChange, editing }: Props) {
  const createAccount = useMutation(api.accounting.createAccount);
  const updateAccount = useMutation(api.accounting.updateAccount);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: editing?.code ?? "",
      name: editing?.name ?? "",
      type: editing?.type ?? "asset",
      group: editing?.group ?? "bank_and_cash",
      openingBalance: editing?.openingBalance != null ? String(editing.openingBalance) : "",
      openingBalanceDate: editing?.openingBalanceDate ?? "",
      description: editing?.description ?? "",
    },
  });

  const selectedType = form.watch("type") as AccountType;
  const availableGroups = ACCOUNT_GROUPS_BY_TYPE[selectedType];

  const onSubmit = async (values: FormValues) => {
    try {
      const openingBalance = values.openingBalance ? parseFloat(values.openingBalance) : undefined;
      if (editing) {
        await updateAccount({
          accountId: editing._id,
          name: values.name,
          description: values.description || undefined,
          openingBalance,
          openingBalanceDate: values.openingBalanceDate || undefined,
        });
        toast.success("Account updated");
      } else {
        await createAccount({
          code: values.code,
          name: values.name,
          type: values.type as AccountType,
          group: values.group as Doc<"accounts">["group"],
          openingBalance,
          openingBalanceDate: values.openingBalanceDate || undefined,
          description: values.description || undefined,
        });
        toast.success("Account created");
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to save account");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Account" : "New Account"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 1005" disabled={!!editing} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. HDFC Current Account" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!editing && (
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select
                        onValueChange={(v) => {
                          field.onChange(v);
                          // Reset group when type changes
                          form.setValue("group", ACCOUNT_GROUPS_BY_TYPE[v as AccountType][0]);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="group"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableGroups.map((g) => (
                            <SelectItem key={g} value={g}>{ACCOUNT_GROUP_LABELS[g]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="openingBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening Balance (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="openingBalanceDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>As of Date</FormLabel>
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit">{editing ? "Save changes" : "Create account"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
