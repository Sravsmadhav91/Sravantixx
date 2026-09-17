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

type ConvertToPoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: Id<"materialRequests"> | undefined;
  onConverted?: () => void;
};

export default function ConvertToPoDialog({ open, onOpenChange, requestId, onConverted }: ConvertToPoDialogProps) {
  const detail = useQuery(api.materialRequests.getMaterialRequest, requestId ? { requestId } : "skip");
  const vendors = useQuery(api.vendors.listVendors, open ? { active: true } : "skip");
  const convert = useMutation(api.materialRequests.convertToPurchaseOrder);

  const lines: Doc<"materialRequestLines">[] = detail?.lines ?? [];

  const schema = z.object({
    vendorId: z.string().min(1, "Select a vendor"),
    expectedDeliveryDate: z.string().optional(),
    rates: z.array(z.string().min(1, "Required")).length(Math.max(lines.length, 1)),
  });
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { vendorId: "", expectedDeliveryDate: "", rates: lines.map(() => "") },
  });

  useEffect(() => {
    if (open && detail) {
      form.reset({ vendorId: "", expectedDeliveryDate: "", rates: lines.map(() => "") });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, detail?.request._id]);

  const onSubmit = async (values: FormValues) => {
    if (!requestId) return;
    try {
      await convert({
        requestId,
        vendorId: values.vendorId as Id<"vendors">,
        rates: values.rates.map((r) => Number(r)),
        expectedDeliveryDate: values.expectedDeliveryDate || undefined,
      });
      toast.success("Purchase order created");
      onOpenChange(false);
      onConverted?.();
    } catch (error) {
      toast.error(
        error instanceof ConvexError ? (error.data as { message: string }).message : "Could not create purchase order",
      );
    }
  };

  const vendorOptions = (vendors ?? []).map((v) => ({ value: v._id, label: v.name }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert to purchase order</DialogTitle>
        </DialogHeader>
        {!detail ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="vendorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={vendorOptions}
                        value={field.value || "none"}
                        onValueChange={(val: string) => field.onChange(val === "none" ? "" : val)}
                        placeholder="Select vendor…"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expectedDeliveryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected delivery (optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Set a rate per item</p>
                {lines.map((line, idx) => (
                  <div key={line._id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                    <div className="flex-1 text-sm">
                      <p className="font-medium">{lines[idx]?.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {lines[idx]?.quantity} {lines[idx]?.unit}
                      </p>
                    </div>
                    <FormField
                      control={form.control}
                      name={`rates.${idx}`}
                      render={({ field }) => (
                        <FormItem className="w-28">
                          <FormControl>
                            <Input type="number" placeholder="Rate ₹" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Estimated total:{" "}
                <span className="font-semibold text-foreground">
                  {formatCompactInr(
                    lines.reduce(
                      (s, l, i) => s + l.quantity * (Number(form.watch(`rates.${i}`)) || 0),
                      0,
                    ),
                  )}
                </span>
              </p>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  Create purchase order
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
