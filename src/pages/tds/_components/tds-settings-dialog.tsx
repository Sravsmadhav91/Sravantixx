import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Doc } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api.js";
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
import { Button } from "@/components/ui/button.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { INDIAN_STATES } from "@/lib/indian-states.ts";

const schema = z.object({
  tan: z.string().trim().optional(),
  deductorName: z.string().trim().optional(),
  deductorType: z.string().optional(),
  address: z.string().trim().optional(),
  stateName: z.string().optional(),
  pincode: z.string().trim().optional(),
  responsiblePersonName: z.string().trim().optional(),
  responsiblePersonDesignation: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings?: Doc<"tdsSettings"> | null;
};

const DEDUCTOR_TYPES = ["Company", "Individual", "Partnership Firm", "HUF", "Trust", "Other"];

export default function TdsSettingsDialog({ open, onOpenChange, settings }: Props) {
  const save = useMutation(api.tds.saveTdsSettings);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  useEffect(() => {
    if (open) {
      form.reset({
        tan: settings?.tan ?? "",
        deductorName: settings?.deductorName ?? "",
        deductorType: settings?.deductorType ?? "",
        address: settings?.address ?? "",
        stateName: settings?.stateName ?? "",
        pincode: settings?.pincode ?? "",
        responsiblePersonName: settings?.responsiblePersonName ?? "",
        responsiblePersonDesignation: settings?.responsiblePersonDesignation ?? "",
      });
    }
  }, [open, settings, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      await save({
        tan: values.tan || undefined,
        deductorName: values.deductorName || undefined,
        deductorType: values.deductorType || undefined,
        address: values.address || undefined,
        stateName: values.stateName || undefined,
        pincode: values.pincode || undefined,
        responsiblePersonName: values.responsiblePersonName || undefined,
        responsiblePersonDesignation: values.responsiblePersonDesignation || undefined,
      });
      toast.success("Deductor profile saved");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to save deductor profile");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Deductor (TAN) Profile</DialogTitle>
          <DialogDescription>Used on challans, Form 16/16A, and quarterly e-TDS returns.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="tan" render={({ field }) => (
                <FormItem>
                  <FormLabel>TAN</FormLabel>
                  <FormControl><Input placeholder="BLRM12345C" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="deductorType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Deductor Type</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      options={DEDUCTOR_TYPES.map((t) => ({ value: t, label: t }))}
                      placeholder="Select…"
                      searchPlaceholder="Search…"
                    />
                  </FormControl>
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="deductorName" render={({ field }) => (
              <FormItem><FormLabel>Deductor Name</FormLabel><FormControl><Input placeholder="e.g. Mighty Homes" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="stateName" render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      options={INDIAN_STATES.map((s) => ({ value: s.name, label: s.name }))}
                      placeholder="Select state…"
                      searchPlaceholder="Search states…"
                    />
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="pincode" render={({ field }) => (
                <FormItem><FormLabel>Pincode</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="responsiblePersonName" render={({ field }) => (
                <FormItem><FormLabel>Responsible Person</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="responsiblePersonDesignation" render={({ field }) => (
                <FormItem><FormLabel>Designation</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>Save Profile</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
