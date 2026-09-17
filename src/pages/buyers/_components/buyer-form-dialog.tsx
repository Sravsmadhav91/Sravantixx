import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel";
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
import { INDIAN_STATES } from "@/lib/indian-states.ts";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the buyer's full name"),
  phone: z.string().trim().min(7, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v), {
      message: "Enter a valid 10-character PAN",
    }),
  address: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  gstin: z.string().trim().optional(),
  state: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  name: "",
  phone: "",
  email: "",
  pan: "",
  address: "",
  notes: "",
  gstin: "",
  state: "",
};

type BuyerFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyer?: Doc<"buyers">;
};

export default function BuyerFormDialog({
  open,
  onOpenChange,
  buyer,
}: BuyerFormDialogProps) {
  const createBuyer = useMutation(api.buyers.create);
  const updateBuyer = useMutation(api.buyers.update);
  const isEditing = buyer !== undefined;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      buyer
        ? {
            name: buyer.name,
            phone: buyer.phone,
            email: buyer.email ?? "",
            pan: buyer.pan ?? "",
            address: buyer.address ?? "",
            notes: buyer.notes ?? "",
            gstin: buyer.gstin ?? "",
            state: buyer.state ?? "",
          }
        : DEFAULTS,
    );
  }, [open, buyer, form]);

  const onSubmit = async (values: FormValues) => {
    const payload = {
      name: values.name,
      phone: values.phone,
      email: values.email || undefined,
      pan: values.pan || undefined,
      address: values.address || undefined,
      notes: values.notes || undefined,
      gstin: values.gstin || undefined,
      state: values.state || undefined,
    };
    try {
      if (buyer) {
        await updateBuyer({ buyerId: buyer._id, ...payload });
        toast.success("Buyer updated");
      } else {
        await createBuyer(payload);
        toast.success("Buyer added");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not save the buyer",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit buyer" : "Add buyer"}</DialogTitle>
          <DialogDescription>
            Keep contact, PAN and address details for this buyer.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 sm:grid-cols-2"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="Arjun Sharma" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+91 98765 43210" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="arjun@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PAN</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ABCDE1234F"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value.toUpperCase())
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gstin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GSTIN <span className="text-muted-foreground font-normal">(if a business buyer)</span></FormLabel>
                  <FormControl>
                    <Input
                      placeholder="29AAAAA0000A1Z5"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State <span className="text-muted-foreground font-normal">(for GST place of supply)</span></FormLabel>
                  <FormControl>
                    <SearchableSelect
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      options={INDIAN_STATES.map((s) => ({ value: s.name, label: s.name }))}
                      placeholder="Select state…"
                      searchPlaceholder="Search states…"
                      allowClear
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Flat 4B, Green Residency, Pune 411001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {isEditing ? "Save changes" : "Add buyer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
