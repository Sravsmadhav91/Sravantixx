import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
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
import { Textarea } from "@/components/ui/textarea.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";

const lineSchema = z.object({
  description: z.string().min(1, "Required"),
  unit: z.string().min(1, "Required"),
  quantity: z.string().min(1, "Required"),
  rate: z.string().optional(),
});

const schema = z.object({
  projectId: z.string().min(1, "Select a project"),
  neededByDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1, "Add at least one material line"),
});

type FormValues = z.infer<typeof schema>;

type MaterialRequestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function MaterialRequestDialog({ open, onOpenChange }: MaterialRequestDialogProps) {
  const createRequest = useMutation(api.materialRequests.createMaterialRequest);
  const projects = useQuery(api.projects.list, open ? {} : "skip");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      projectId: "",
      neededByDate: "",
      notes: "",
      lines: [{ description: "", unit: "", quantity: "", rate: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

  useEffect(() => {
    if (open) {
      form.reset({
        projectId: "",
        neededByDate: "",
        notes: "",
        lines: [{ description: "", unit: "", quantity: "", rate: "" }],
      });
    }
  }, [open, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      await createRequest({
        projectId: values.projectId as Id<"projects">,
        neededByDate: values.neededByDate || undefined,
        notes: values.notes || undefined,
        lines: values.lines.map((l) => ({
          description: l.description,
          unit: l.unit,
          quantity: Number(l.quantity),
          rate: l.rate ? Number(l.rate) : undefined,
        })),
      });
      toast.success("Material request submitted");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ConvexError ? (error.data as { message: string }).message : "Could not submit request",
      );
    }
  };

  const projectOptions = (projects ?? []).map((p) => ({ value: p._id, label: p.name }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New material request</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={projectOptions}
                      value={field.value || "none"}
                      onValueChange={(val: string) => field.onChange(val === "none" ? "" : val)}
                      placeholder="Select project…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="neededByDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Needed by (optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Materials needed</p>
              {fields.map((field, idx) => (
                <div key={field.id} className="flex items-start gap-2">
                  <FormField
                    control={form.control}
                    name={`lines.${idx}.description`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder="TMT bars 12mm" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name={`lines.${idx}.rate`} render={({ field }) => (<FormItem className="w-24"><FormControl><Input type="number" min="0" placeholder="Rate" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField
                    control={form.control}
                    name={`lines.${idx}.quantity`}
                    render={({ field }) => (
                      <FormItem className="w-20">
                        <FormControl>
                          <Input type="number" placeholder="Qty" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`lines.${idx}.unit`}
                    render={({ field }) => (
                      <FormItem className="w-24">
                        <FormControl>
                          <Input placeholder="Unit" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(idx)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => append({ description: "", unit: "", quantity: "", rate: "" })}
              >
                <Plus className="size-4" /> Add material
              </Button>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Submit request
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
