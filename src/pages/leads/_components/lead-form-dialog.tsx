import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { LEAD_SOURCE_LABELS } from "@/lib/leads.ts";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(7, "Enter a valid phone number"),
  email: z.string().email().optional().or(z.literal("")),
  projectInterest: z.string().optional(),
  source: z.enum([
    "walk_in",
    "referral",
    "advertisement",
    "website",
    "social_media",
    "other",
  ]),
  budget: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Doc<"leads"> | null;
};

export default function LeadFormDialog({ open, onOpenChange, lead }: Props) {
  const createLead = useMutation(api.leads.create);
  const updateLead = useMutation(api.leads.update);
  const isEdit = !!lead;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: lead?.name ?? "",
      phone: lead?.phone ?? "",
      email: lead?.email ?? "",
      projectInterest: lead?.projectInterest ?? "",
      source: lead?.source ?? "walk_in",
      budget: lead?.budget ? String(lead.budget) : "",
      notes: lead?.notes ?? "",
    },
  });

  // Reset when lead changes
  useState(() => {
    if (open) {
      form.reset({
        name: lead?.name ?? "",
        phone: lead?.phone ?? "",
        email: lead?.email ?? "",
        projectInterest: lead?.projectInterest ?? "",
        source: lead?.source ?? "walk_in",
        budget: lead?.budget ? String(lead.budget) : "",
        notes: lead?.notes ?? "",
      });
    }
  });

  const onSubmit = async (values: FormValues) => {
    const payload = {
      name: values.name,
      phone: values.phone,
      email: values.email || undefined,
      projectInterest: values.projectInterest || undefined,
      source: values.source,
      budget: values.budget ? Number(values.budget) : undefined,
      notes: values.notes || undefined,
    };

    try {
      if (isEdit && lead) {
        await updateLead({ leadId: lead._id, ...payload });
        toast.success("Lead updated");
      } else {
        await createLead(payload);
        toast.success("Lead added");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not save lead",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit lead" : "Add new lead"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ramesh Sharma" {...field} />
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
                    <FormLabel>Phone *</FormLabel>
                    <FormControl>
                      <Input placeholder="98765 43210" {...field} />
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
                      <Input placeholder="ramesh@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(LEAD_SOURCE_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>
                            {l}
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
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget (₹)</FormLabel>
                    <FormControl>
                      <Input placeholder="5000000" type="number" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="projectInterest"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Project interest</FormLabel>
                    <FormControl>
                      <Input placeholder="Skyline Towers – 2 BHK" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Any relevant details…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Add lead"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
