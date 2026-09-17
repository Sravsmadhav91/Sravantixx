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
import { INDIAN_STATES, stateCodeFromName } from "@/lib/indian-states.ts";

const schema = z.object({
  gstin: z.string().trim().optional(),
  legalName: z.string().trim().optional(),
  tradeName: z.string().trim().optional(),
  stateName: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings?: Doc<"gstSettings"> | null;
};

export default function GstSettingsDialog({ open, onOpenChange, settings }: Props) {
  const save = useMutation(api.gst.saveGstSettings);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { gstin: "", legalName: "", tradeName: "", stateName: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        gstin: settings?.gstin ?? "",
        legalName: settings?.legalName ?? "",
        tradeName: settings?.tradeName ?? "",
        stateName: settings?.stateName ?? "",
      });
    }
  }, [open, settings, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      await save({
        gstin: values.gstin || undefined,
        legalName: values.legalName || undefined,
        tradeName: values.tradeName || undefined,
        stateName: values.stateName || undefined,
        stateCode: stateCodeFromName(values.stateName),
      });
      toast.success("GST profile saved");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to save GST profile");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Company GST Profile</DialogTitle>
          <DialogDescription>
            Used to determine intra vs inter-state tax split and headers on GSTR-1/3B.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="gstin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GSTIN</FormLabel>
                  <FormControl>
                    <Input placeholder="29AAAAA0000A1Z5" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="legalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Legal Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Mighty Homes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tradeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trade Name (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Trading as…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stateName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registered State</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      options={INDIAN_STATES.map((s) => ({ value: s.name, label: `${s.name} (${s.code})` }))}
                      placeholder="Select state…"
                      searchPlaceholder="Search states…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>Save Profile</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
