import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
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
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { COMMON_STOCK_UNITS } from "@/lib/inventory.ts";

const schema = z.object({
  sku: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  unit: z.string().min(1, "Required"),
  category: z.string().optional(),
  reorderLevel: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Doc<"stockItems">;
};

export default function ItemFormDialog({ open, onOpenChange, editing }: Props) {
  const createItem = useMutation(api.inventory.createItem);
  const updateItem = useMutation(api.inventory.updateItem);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { sku: "", name: "", unit: "", category: "", reorderLevel: "", notes: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              sku: editing.sku,
              name: editing.name,
              unit: editing.unit,
              category: editing.category ?? "",
              reorderLevel: editing.reorderLevel != null ? String(editing.reorderLevel) : "",
              notes: editing.notes ?? "",
            }
          : { sku: "", name: "", unit: "", category: "", reorderLevel: "", notes: "" },
      );
    }
  }, [open, editing, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        sku: values.sku,
        name: values.name,
        unit: values.unit,
        category: values.category || undefined,
        reorderLevel: values.reorderLevel ? parseFloat(values.reorderLevel) : undefined,
        notes: values.notes || undefined,
      };
      if (editing) {
        await updateItem({ itemId: editing._id as Id<"stockItems">, ...payload });
        toast.success("Item updated");
      } else {
        await createItem(payload);
        toast.success("Item created");
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to save item");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Item" : "New Stock Item"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU / Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="CEM-OPC53" {...field} disabled={!!editing} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit *</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        value={field.value}
                        onValueChange={field.onChange}
                        options={COMMON_STOCK_UNITS.map((u) => ({ value: u, label: u }))}
                        placeholder="Bags…"
                        searchPlaceholder="Search units…"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="OPC 53 Grade Cement" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="Cement, Steel, Sand…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reorderLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reorder Level</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" placeholder="Optional" {...field} />
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
                    <Textarea rows={2} placeholder="Optional…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editing ? "Save Changes" : "Create Item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
