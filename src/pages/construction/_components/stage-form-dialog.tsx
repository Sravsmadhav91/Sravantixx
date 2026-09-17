import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea.tsx";
import { Button } from "@/components/ui/button.tsx";
import { numericString, integerString } from "@/lib/form-schema.ts";

const schema = z.object({
  name: z.string().trim().min(1, "Enter stage name"),
  percentComplete: z
    .string()
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100, {
      message: "Enter 0–100",
    }),
  order: integerString("Enter display order"),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
  completedDate: z.string().optional(),
  notes: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

type StageFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects">;
  stage?: Doc<"constructionStages">;
  nextOrder?: number;
};

export default function StageFormDialog({
  open,
  onOpenChange,
  projectId,
  stage,
  nextOrder = 1,
}: StageFormDialogProps) {
  const addStage = useMutation(api.construction.addStage);
  const updateStage = useMutation(api.construction.updateStage);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      percentComplete: "0",
      order: String(nextOrder),
      startDate: "",
      targetDate: "",
      completedDate: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        stage
          ? {
              name: stage.name,
              percentComplete: String(stage.percentComplete),
              order: String(stage.order),
              startDate: stage.startDate ? stage.startDate.slice(0, 10) : "",
              targetDate: stage.targetDate ? stage.targetDate.slice(0, 10) : "",
              completedDate: stage.completedDate ? stage.completedDate.slice(0, 10) : "",
              notes: stage.notes ?? "",
            }
          : {
              name: "",
              percentComplete: "0",
              order: String(nextOrder),
              startDate: "",
              targetDate: "",
              completedDate: "",
              notes: "",
            },
      );
    }
  }, [open, stage, nextOrder, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        name: values.name,
        percentComplete: Number(values.percentComplete),
        order: Number(values.order),
        startDate: values.startDate
          ? new Date(`${values.startDate}T00:00:00Z`).toISOString()
          : undefined,
        targetDate: values.targetDate
          ? new Date(`${values.targetDate}T00:00:00Z`).toISOString()
          : undefined,
        completedDate: values.completedDate
          ? new Date(`${values.completedDate}T00:00:00Z`).toISOString()
          : undefined,
        notes: values.notes || undefined,
      };
      if (stage) {
        await updateStage({ stageId: stage._id, ...payload });
        toast.success("Stage updated");
      } else {
        await addStage({ projectId, ...payload });
        toast.success("Stage added");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not save stage",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{stage ? "Edit stage" : "Add construction stage"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stage name</FormLabel>
                  <FormControl>
                    <Input placeholder="Foundation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="percentComplete"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>% Complete</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display order</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="targetDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="completedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Completed date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
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
                {stage ? "Save changes" : "Add stage"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
