import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { X } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel";
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
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { numericString } from "@/lib/form-schema.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";

const schema = z.object({
  buyerId: z.string().min(1, "Select a primary buyer"),
  coBuyerIds: z.array(z.string()).optional(),
  bookingDate: z.string().min(1, "Enter the booking date"),
  agreementValue: numericString("Enter the agreement value"),
  bookingAmount: numericString("Enter the booking amount"),
  notes: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

type BookUnitDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: Doc<"units">;
};


export default function BookUnitDialog({
  open,
  onOpenChange,
  unit,
}: BookUnitDialogProps) {
  const createBooking = useMutation(api.bookings.create);
  const buyers = useQuery(api.buyers.list, open ? {} : "skip");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      buyerId: "",
      coBuyerIds: [],
      bookingDate: "",
      agreementValue: String(unit.price),
      bookingAmount: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        buyerId: "",
        coBuyerIds: [],
        bookingDate: "",
        agreementValue: String(unit.price),
        bookingAmount: "",
        notes: "",
      });
    }
  }, [open, unit.price, form]);

  const selectedPrimaryId = form.watch("buyerId");
  const selectedCoBuyerIds = form.watch("coBuyerIds") ?? [];

  const buyerOptions =
    buyers?.map((b) => ({ value: b._id, label: `${b.name}${b.phone ? ` · ${b.phone}` : ""}` })) ?? [];

  // Co-buyer options: all buyers except primary
  const coBuyerOptions = buyerOptions.filter((o) => o.value !== selectedPrimaryId);

  const addCoBuyer = (id: string) => {
    if (!id || id === selectedPrimaryId) return;
    if (selectedCoBuyerIds.includes(id)) return;
    form.setValue("coBuyerIds", [...selectedCoBuyerIds, id]);
  };

  const removeCoBuyer = (id: string) => {
    form.setValue("coBuyerIds", selectedCoBuyerIds.filter((c) => c !== id));
  };

  const onSubmit = async (values: FormValues) => {
    try {
      await createBooking({
        unitId: unit._id,
        buyerId: values.buyerId as Id<"buyers">,
        coBuyerIds: values.coBuyerIds?.map((id) => id as Id<"buyers">) ?? [],
        bookingDate: new Date(`${values.bookingDate}T00:00:00Z`).toISOString(),
        agreementValue: Number(values.agreementValue),
        bookingAmount: Number(values.bookingAmount),
        notes: values.notes || undefined,
      });
      toast.success(`Unit ${unit.number} booked successfully`);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not create the booking",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Book unit {unit.number}</DialogTitle>
          <DialogDescription>
            Base price: {formatCompactInr(unit.price)}
            {unit.configuration ? ` · ${unit.configuration}` : ""}
            {unit.superBuiltUpAreaSqft ? ` · ${unit.superBuiltUpAreaSqft} sq ft SBA` : ""}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Primary buyer */}
            <FormField
              control={form.control}
              name="buyerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Buyer *</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={buyerOptions}
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val);
                        // Remove if accidentally added as co-buyer
                        form.setValue(
                          "coBuyerIds",
                          (form.getValues("coBuyerIds") ?? []).filter((id) => id !== val),
                        );
                      }}
                      placeholder="Select primary buyer"
                      emptyText="No buyers found"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Co-buyers */}
            <FormItem>
              <FormLabel>Co-Buyers / Joint Purchasers</FormLabel>
              {/* Selected co-buyers chips */}
              {selectedCoBuyerIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedCoBuyerIds.map((id) => {
                    const b = buyers?.find((b) => b._id === id);
                    return (
                      <Badge key={id} variant="secondary" className="flex items-center gap-1 pr-1">
                        {b?.name ?? id}
                        <button
                          type="button"
                          onClick={() => removeCoBuyer(id)}
                          className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
              <SearchableSelect
                options={coBuyerOptions.filter((o) => !selectedCoBuyerIds.includes(o.value))}
                value=""
                onValueChange={addCoBuyer}
                placeholder={selectedPrimaryId ? "Add a co-buyer…" : "Select primary buyer first"}
                emptyText="No more buyers to add"
                disabled={!selectedPrimaryId}
              />
              <p className="text-xs text-muted-foreground mt-1">
                All co-buyers will appear on the booking and sale agreement.
              </p>
            </FormItem>

            <FormField
              control={form.control}
              name="bookingDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Booking date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="agreementValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agreement value (₹)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder={String(unit.price)} {...field} />
                  </FormControl>
                  <FormDescription>
                    Final agreed selling price
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bookingAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Booking amount (₹)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="100000" {...field} />
                  </FormControl>
                  <FormDescription>Amount paid at booking</FormDescription>
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
                    <Textarea rows={2} placeholder="Any remarks…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Booking…" : "Confirm booking"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
