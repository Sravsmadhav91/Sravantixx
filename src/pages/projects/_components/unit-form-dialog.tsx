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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import {
  UNIT_STATUSES,
  UNIT_STATUS_LABELS,
  formatCompactInr,
} from "@/lib/real-estate.ts";
import {
  numericString,
  optionalIntegerString,
} from "@/lib/form-schema.ts";

const schema = z.object({
  number: z.string().trim().min(1, "Enter the unit number"),
  block: z.string().trim().optional(),
  floor: optionalIntegerString("Enter a whole number"),
  configuration: z.string().trim().optional(),
  superBuiltUpAreaSqft: numericString("Enter the Super Built-Up Area (SBA)"),
  areaSqft: z
    .string()
    .trim()
    .optional()
    .refine((v) => v === "" || v === undefined || (!isNaN(Number(v)) && Number(v) > 0), {
      message: "Enter a positive number",
    }),
  carpetAreaSqft: z
    .string()
    .trim()
    .optional()
    .refine((v) => v === "" || v === undefined || (!isNaN(Number(v)) && Number(v) > 0), {
      message: "Enter a positive number",
    }),
  balconyAreaSqft: z
    .string()
    .trim()
    .optional()
    .refine((v) => v === "" || v === undefined || (!isNaN(Number(v)) && Number(v) > 0), {
      message: "Enter a positive number",
    }),
  undividedShare: z.string().trim().optional(),
  ratePerSqft: numericString("Enter the rate per sq ft"),
  status: z.enum(["available", "on_hold", "booked", "sold"]),
  facing: z.string().trim().optional(),
  buyerId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  number: "",
  block: "",
  floor: "",
  configuration: "",
  superBuiltUpAreaSqft: "",
  areaSqft: "",
  carpetAreaSqft: "",
  balconyAreaSqft: "",
  undividedShare: "",
  ratePerSqft: "",
  status: "available",
  facing: "",
  buyerId: "",
};

type UnitFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects">;
  /** Pass the unit enriched with buyerId from listByProject */
  unit?: Doc<"units"> & { buyerId?: Id<"buyers"> };
};

export default function UnitFormDialog({
  open,
  onOpenChange,
  projectId,
  unit,
}: UnitFormDialogProps) {
  const createUnit = useMutation(api.units.create);
  const updateUnit = useMutation(api.units.update);
  const linkBuyer = useMutation(api.units.linkBuyer);
  const buyers = useQuery(api.buyers.list, {});
  const isEditing = unit !== undefined;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      unit
        ? {
            number: unit.number,
            block: unit.block ?? "",
            floor: unit.floor === undefined ? "" : String(unit.floor),
            configuration: unit.configuration ?? "",
            superBuiltUpAreaSqft:
              unit.superBuiltUpAreaSqft === undefined ? "" : String(unit.superBuiltUpAreaSqft),
            areaSqft: unit.areaSqft === undefined ? "" : String(unit.areaSqft),
            carpetAreaSqft:
              unit.carpetAreaSqft === undefined ? "" : String(unit.carpetAreaSqft),
            balconyAreaSqft:
              unit.balconyAreaSqft === undefined ? "" : String(unit.balconyAreaSqft),
            undividedShare: unit.undividedShare ?? "",
            ratePerSqft: String(unit.ratePerSqft),
            status: unit.status,
            facing: unit.facing ?? "",
            buyerId: unit.buyerId ?? "",
          }
        : DEFAULTS,
    );
  }, [open, unit, form]);

  const sba = Number(form.watch("superBuiltUpAreaSqft")) || 0;
  const rate = Number(form.watch("ratePerSqft")) || 0;
  const price = Math.round(sba * rate);
  const status = form.watch("status");
  const needsBuyer = status === "booked" || status === "sold";

  const onSubmit = async (values: FormValues) => {
    const superBuiltUpAreaSqft = Number(values.superBuiltUpAreaSqft);
    const ratePerSqft = Number(values.ratePerSqft);
    const payload = {
      number: values.number,
      block: values.block || undefined,
      floor: values.floor === "" ? undefined : Number(values.floor),
      configuration: values.configuration || undefined,
      superBuiltUpAreaSqft,
      areaSqft: values.areaSqft && values.areaSqft !== "" ? Number(values.areaSqft) : undefined,
      carpetAreaSqft: values.carpetAreaSqft && values.carpetAreaSqft !== "" ? Number(values.carpetAreaSqft) : undefined,
      balconyAreaSqft: values.balconyAreaSqft && values.balconyAreaSqft !== "" ? Number(values.balconyAreaSqft) : undefined,
      undividedShare: values.undividedShare || undefined,
      ratePerSqft,
      price: Math.round(superBuiltUpAreaSqft * ratePerSqft),
      status: values.status,
      facing: values.facing || undefined,
    };
    try {
      let unitId: Id<"units">;
      if (unit) {
        await updateUnit({ unitId: unit._id, ...payload });
        unitId = unit._id;
        toast.success("Unit updated");
      } else {
        unitId = await createUnit({ projectId, ...payload });
        toast.success("Unit added");
      }

      // Link / unlink buyer when status requires it
      const selectedBuyerId =
        values.buyerId && values.buyerId !== "none" ? (values.buyerId as Id<"buyers">) : undefined;

      if (needsBuyer) {
        await linkBuyer({ unitId, buyerId: selectedBuyerId });
      } else if (unit?.buyerId) {
        // Status changed away from booked/sold — clear the link
        await linkBuyer({ unitId, buyerId: undefined });
      }

      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not save the unit";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit unit" : "Add unit"}</DialogTitle>
          <DialogDescription>
            A unit is one flat, villa or plot in this project.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 sm:grid-cols-2"
          >
            <FormField
              control={form.control}
              name="number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit number</FormLabel>
                  <FormControl>
                    <Input placeholder="A-1203" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="block"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Block or wing</FormLabel>
                  <FormControl>
                    <Input placeholder="A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="floor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Floor</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="12" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="configuration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Configuration</FormLabel>
                  <FormControl>
                    <Input placeholder="2 BHK" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Area fields ── */}
            <FormField
              control={form.control}
              name="superBuiltUpAreaSqft"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Super Built-Up Area — SBA (sq ft) *</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="1200" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="areaSqft"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Built-Up Area (sq ft)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="1050" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="carpetAreaSqft"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Carpet Area — CA (sq ft)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="900" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="balconyAreaSqft"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Balcony Area (sq ft)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="60" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="undividedShare"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Undivided Share — UDS</FormLabel>
                  <FormControl>
                    <Input placeholder="45.5 sq ft or 2.3%" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ratePerSqft"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate per sq ft</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="6500" {...field} />
                  </FormControl>
                  <FormDescription>
                    Base price (SBA × rate): {formatCompactInr(price)}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {UNIT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {UNIT_STATUS_LABELS[s]}
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
              name="facing"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Facing</FormLabel>
                  <FormControl>
                    <Input placeholder="East" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Buyer link — appears only when booked or sold ── */}
            {needsBuyer && (
              <FormField
                control={form.control}
                name="buyerId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Linked Buyer</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        options={[
                          { value: "none", label: "— No buyer linked —" },
                          ...(buyers ?? []).map((b) => ({
                            value: b._id,
                            label: b.name,
                            sub: b.phone,
                            keywords: `${b.name} ${b.phone ?? ""} ${b.email ?? ""}`,
                          })),
                        ]}
                        placeholder="Select a buyer…"
                        searchPlaceholder="Search buyers…"
                        allowClear
                        clearLabel="— No buyer linked —"
                      />
                    </FormControl>
                    <FormDescription>
                      Link an existing buyer to this unit. Agreement value and
                      instalments can be updated in Bookings.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter className="sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {isEditing ? "Save changes" : "Add unit"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
