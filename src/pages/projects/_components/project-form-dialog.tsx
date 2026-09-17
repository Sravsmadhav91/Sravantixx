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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
} from "@/lib/real-estate.ts";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the project name"),
  code: z.string().trim().min(1, "Enter a short code"),
  city: z.string().trim().min(2, "Enter the city"),
  address: z.string().trim().optional(),
  type: z.enum(["apartment", "plotted", "villa", "commercial"]),
  status: z.enum(["planning", "under_construction", "ready", "completed"]),
  reraNumber: z.string().trim().optional(),
  possessionDate: z.string().trim().optional(),
  constructionBudget: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  name: "",
  code: "",
  city: "",
  address: "",
  type: "apartment",
  status: "planning",
  reraNumber: "",
  possessionDate: "",
  constructionBudget: "",
  notes: "",
};

type ProjectFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Doc<"projects">;
};

/** Converts a "YYYY-MM-DD" input value into an ISO 8601 UTC instant. */
function toIso(day: string | undefined): string | undefined {
  if (!day) return undefined;
  const parsed = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function toDayInput(iso: string | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export default function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: ProjectFormDialogProps) {
  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);
  const isEditing = project !== undefined;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  // Repopulate whenever the dialog opens for a different project.
  useEffect(() => {
    if (!open) return;
    form.reset(
      project
        ? {
            name: project.name,
            code: project.code,
            city: project.city,
            address: project.address ?? "",
            type: project.type,
            status: project.status,
            reraNumber: project.reraNumber ?? "",
            possessionDate: toDayInput(project.possessionDate),
            constructionBudget: project.constructionBudget
              ? String(project.constructionBudget)
              : "",
            notes: project.notes ?? "",
          }
        : DEFAULTS,
    );
  }, [open, project, form]);

  const onSubmit = async (values: FormValues) => {
    const payload = {
      name: values.name,
      code: values.code.toUpperCase(),
      city: values.city,
      address: values.address || undefined,
      type: values.type,
      status: values.status,
      reraNumber: values.reraNumber || undefined,
      possessionDate: toIso(values.possessionDate),
      constructionBudget: values.constructionBudget
        ? Number(values.constructionBudget)
        : undefined,
      notes: values.notes || undefined,
    };
    try {
      if (project) {
        await updateProject({ projectId: project._id, ...payload });
        toast.success("Project updated");
      } else {
        await createProject(payload);
        toast.success("Project created");
      }
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not save the project";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            A project is one tower, layout or scheme you are selling.
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
                  <FormLabel>Project name</FormLabel>
                  <FormControl>
                    <Input placeholder="Green Meadows Phase 1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short code</FormLabel>
                  <FormControl>
                    <Input placeholder="GM1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="Pune" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PROJECT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {PROJECT_TYPE_LABELS[type]}
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
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stage</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PROJECT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {PROJECT_STATUS_LABELS[status]}
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
              name="reraNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RERA number</FormLabel>
                  <FormControl>
                    <Input placeholder="P52100012345" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="possessionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Possession date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="constructionBudget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Construction budget (₹)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="50000000" {...field} />
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
                  <FormLabel>Site address</FormLabel>
                  <FormControl>
                    <Input placeholder="Survey 42, Wagholi" {...field} />
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
                    <Textarea rows={3} {...field} />
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
                {isEditing ? "Save changes" : "Create project"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
