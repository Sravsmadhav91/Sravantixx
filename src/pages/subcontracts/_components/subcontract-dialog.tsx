import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
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
import { PAN_REGEX } from "@/lib/pan.ts";

const schema = z.object({
  projectId: z.string().min(1, "Select a project"),
  vendorId: z.string().min(1, "Select a vendor"),
  title: z.string().min(1, "Required"),
  contractValue: z.string().min(1, "Required"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type SubcontractDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Doc<"subcontracts"> | null;
};

export default function SubcontractDialog({ open, onOpenChange, editing }: SubcontractDialogProps) {
  const createSubcontract = useMutation(api.subcontracts.createSubcontract);
  const updateSubcontract = useMutation(api.subcontracts.updateSubcontract);
  const projects = useQuery(api.projects.list, open ? {} : "skip");
  const vendors = useQuery(api.vendors.listVendors, open ? { active: true } : "skip");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      projectId: "",
      vendorId: "",
      title: "",
      contractValue: "",
      startDate: "",
      endDate: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        projectId: editing.projectId,
        vendorId: editing.vendorId,
        title: editing.title,
        contractValue: String(editing.contractValue),
        startDate: editing.startDate ?? "",
        endDate: editing.endDate ?? "",
        notes: editing.notes ?? "",
      });
    } else {
      form.reset({
        projectId: "",
        vendorId: "",
        title: "",
        contractValue: "",
        startDate: "",
        endDate: "",
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?._id]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (editing) {
        await updateSubcontract({
          subcontractId: editing._id,
          title: values.title,
          contractValue: Number(values.contractValue),
          startDate: values.startDate || undefined,
          endDate: values.endDate || undefined,
          notes: values.notes || undefined,
        });
        toast.success("Subcontract updated");
      } else {
        await createSubcontract({
          projectId: values.projectId as Id<"projects">,
          vendorId: values.vendorId as Id<"vendors">,
          title: values.title,
          contractValue: Number(values.contractValue),
          startDate: values.startDate || undefined,
          endDate: values.endDate || undefined,
          notes: values.notes || undefined,
        });
        toast.success("Subcontract created");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ConvexError ? (error.data as { message: string }).message : "Could not save subcontract",
      );
    }
  };

  const projectOptions = (projects ?? []).map((p) => ({ value: p._id, label: p.name }));
  const vendorOptions = (vendors ?? []).map((v) => ({ value: v._id, label: v.name }));

  const selectedVendorId = form.watch("vendorId");
  const selectedVendor = vendors?.find((v) => v._id === selectedVendorId);
  const selectedVendorMissingPan = !!selectedVendor && !(selectedVendor.pan && PAN_REGEX.test(selectedVendor.pan));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit subcontract" : "New subcontract"}</DialogTitle>
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
                      disabled={!!editing}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vendorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subcontractor / Vendor</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={vendorOptions}
                      value={field.value || "none"}
                      onValueChange={(val: string) => field.onChange(val === "none" ? "" : val)}
                      placeholder="Select vendor…"
                      disabled={!!editing}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {selectedVendorMissingPan && !editing && (
              <div className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  This vendor has no PAN on file. Add a valid PAN to their vendor record in Payables before creating this contract.
                </span>
              </div>
            )}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contract title</FormLabel>
                  <FormControl>
                    <Input placeholder="Plumbing works — Tower A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contractValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contract value (₹)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="500000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
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
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End date</FormLabel>
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
              <Button
                type="submit"
                disabled={form.formState.isSubmitting || (!editing && selectedVendorMissingPan)}
              >
                {editing ? "Save changes" : "Create subcontract"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
