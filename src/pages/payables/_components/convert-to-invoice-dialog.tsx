import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";

const schema = z.object({
  invoiceNumber: z.string().min(1, "Enter the vendor's invoice number"),
  invoiceDate: z.string().min(1, "Required"),
  dueDate: z.string().optional(),
  tds: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type ConvertToInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId: Id<"purchaseOrders">;
  poNumber: string;
  total: number;
  vendorName: string;
  onConverted?: (invoiceId: Id<"purchaseInvoices">) => void;
};

export default function ConvertToInvoiceDialog({
  open,
  onOpenChange,
  poId,
  poNumber,
  total,
  vendorName,
  onConverted,
}: ConvertToInvoiceDialogProps) {
  const convertToInvoice = useMutation(api.purchaseOrders.convertToInvoice);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      invoiceNumber: "",
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: "",
      tds: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const invoiceId = await convertToInvoice({
        poId,
        invoiceNumber: values.invoiceNumber,
        invoiceDate: values.invoiceDate,
        dueDate: values.dueDate || undefined,
        tds: values.tds ? parseFloat(values.tds) : undefined,
      });
      toast.success(`Invoice created from ${poNumber}`);
      onConverted?.(invoiceId);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Could not convert to invoice",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to Purchase Invoice</DialogTitle>
          <DialogDescription>
            {poNumber} · {vendorName} · {formatCompactInr(total)}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="invoiceNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor invoice number</FormLabel>
                  <FormControl>
                    <Input placeholder="INV-2025-0042" {...field} />
                  </FormControl>
                  <FormDescription>The number printed on the vendor's invoice</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="invoiceDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
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
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>TDS deducted (₹)</FormLabel>
                  <FormControl><Input type="number" step="any" placeholder="0" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Create invoice
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
