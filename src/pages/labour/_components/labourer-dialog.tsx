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
import { Textarea } from "@/components/ui/textarea.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { PAN_REGEX } from "@/lib/pan.ts";

const schema = z.object({
  name: z.string().min(1, "Required"),
  type: z.enum(["individual", "group"]),
  memberCount: z.string().min(1, "Required"),
  phone: z.string().optional(),
  skill: z.string().optional(),
  pan: z
    .string()
    .min(1, "PAN is required")
    .regex(PAN_REGEX, "Enter a valid PAN (e.g. ABCDE1234F)"),
  projectId: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type LabourerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Doc<"labourers"> | null;
};

export default function LabourerDialog({ open, onOpenChange, editing }: LabourerDialogProps) {
  const createLabourer = useMutation(api.labour.createLabourer);
  const updateLabourer = useMutation(api.labour.updateLabourer);
  const projects = useQuery(api.projects.list, open ? {} : "skip");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      type: "individual",
      memberCount: "1",
      phone: "",
      skill: "",
      pan: "",
      projectId: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        name: editing.name,
        type: editing.type,
        memberCount: String(editing.memberCount),
        phone: editing.phone ?? "",
        skill: editing.skill ?? "",
        pan: editing.pan ?? "",
        projectId: editing.projectId ?? "",
        notes: editing.notes ?? "",
      });
    } else {
      form.reset({
        name: "",
        type: "individual",
        memberCount: "1",
        phone: "",
        skill: "",
        pan: "",
        projectId: "",
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?._id]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (editing) {
        await updateLabourer({
          labourerId: editing._id,
          name: values.name,
          memberCount: Number(values.memberCount),
          phone: values.phone || undefined,
          skill: values.skill || undefined,
          pan: values.pan,
          projectId: values.projectId ? (values.projectId as Id<"projects">) : undefined,
          notes: values.notes || undefined,
        });
        toast.success("Labourer updated");
      } else {
        await createLabourer({
          name: values.name,
          type: values.type,
          memberCount: Number(values.memberCount),
          phone: values.phone || undefined,
          skill: values.skill || undefined,
          pan: values.pan,
          projectId: values.projectId ? (values.projectId as Id<"projects">) : undefined,
          notes: values.notes || undefined,
        });
        toast.success("Labourer added");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ConvexError ? (error.data as { message: string }).message : "Could not save labourer",
      );
    }
  };

  const projectOptions = (projects ?? []).map((p) => ({ value: p._id, label: p.name }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit labourer" : "Add labourer or group"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={!!editing}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="group">Group</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Ramesh Kumar / Masonry Team A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="memberCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of workers</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="skill"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skill / trade</FormLabel>
                    <FormControl>
                      <Input placeholder="Mason" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="9876543210" {...field} />
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
                  <FormLabel>PAN {form.watch("type") === "group" ? "(group leader)" : ""}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      className="font-mono uppercase"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned project (optional)</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={projectOptions}
                      value={field.value || "none"}
                      onValueChange={(val: string) => field.onChange(val === "none" ? "" : val)}
                      placeholder="Select project…"
                      allowClear
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                {editing ? "Save changes" : "Add labourer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
