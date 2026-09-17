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

const schema = z.object({
  name: z.string().min(1, "Required"),
  address: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Doc<"stockGodowns">;
};

export default function GodownFormDialog({ open, onOpenChange, editing }: Props) {
  const createGodown = useMutation(api.inventory.createGodown);
  const updateGodown = useMutation(api.inventory.updateGodown);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", address: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset(editing ? { name: editing.name, address: editing.address ?? "" } : { name: "", address: "" });
    }
  }, [open, editing, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (editing) {
        await updateGodown({
          godownId: editing._id as Id<"stockGodowns">,
          name: values.name,
          address: values.address || undefined,
        });
        toast.success("Godown updated");
      } else {
        await createGodown({ name: values.name, address: values.address || undefined });
        toast.success("Godown created");
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to save godown");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Godown / Store" : "New Godown / Store"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Site Store — Mighty Yuva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address / Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Optional…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editing ? "Save Changes" : "Create Godown"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
