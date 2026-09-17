import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
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
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";

type MovementKind = "receive" | "issue" | "opening" | "adjust_in" | "adjust_out" | "transfer";

const schema = z.object({
  itemId: z.string().min(1, "Required"),
  godownId: z.string().min(1, "Required"),
  toGodownId: z.string().optional(),
  projectId: z.string().optional(),
  date: z.string().min(1, "Required"),
  quantity: z.string().min(1, "Required"),
  rate: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const KIND_LABELS: Record<MovementKind, string> = {
  receive: "Receive",
  issue: "Issue",
  opening: "Opening",
  adjust_in: "Adjust In",
  adjust_out: "Adjust Out",
  transfer: "Transfer",
};

export default function StockMovementDialog({ open, onOpenChange }: Props) {
  const [kind, setKind] = useState<MovementKind>("receive");

  const items = useQuery(api.inventory.listItems, { activeOnly: true });
  const godowns = useQuery(api.inventory.listGodowns, { activeOnly: true });
  const projects = useQuery(api.projects.list, {});

  const recordOpening = useMutation(api.inventory.recordOpeningStock);
  const receiveStock = useMutation(api.inventory.receiveStock);
  const issueStock = useMutation(api.inventory.issueStock);
  const adjustStock = useMutation(api.inventory.adjustStock);
  const transferStock = useMutation(api.inventory.transferStock);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      itemId: "",
      godownId: "",
      toGodownId: "",
      projectId: "",
      date: new Date().toISOString().slice(0, 10),
      quantity: "",
      rate: "",
      notes: "",
    },
  });

  const itemOptions = (items ?? []).map((i) => ({
    value: i._id,
    label: `${i.sku} — ${i.name}`,
    sub: `${i.totalQuantity} ${i.unit}`,
    keywords: `${i.sku} ${i.name}`,
  }));
  const godownOptions = (godowns ?? []).map((g) => ({ value: g._id, label: g.name }));
  const projectOptions = [
    { value: "none", label: "None" },
    ...(projects ?? []).map((p) => ({ value: p._id, label: p.name })),
  ];

  const needsRate = kind === "receive" || kind === "opening" || kind === "adjust_in";
  const needsProject = kind === "receive" || kind === "issue";

  const handleClose = (o: boolean) => {
    if (!o) {
      form.reset({
        itemId: "",
        godownId: "",
        toGodownId: "",
        projectId: "",
        date: new Date().toISOString().slice(0, 10),
        quantity: "",
        rate: "",
        notes: "",
      });
      setKind("receive");
    }
    onOpenChange(o);
  };

  const onSubmit = async (values: FormValues) => {
    const common = {
      itemId: values.itemId as Id<"stockItems">,
      godownId: values.godownId as Id<"stockGodowns">,
      date: values.date,
      quantity: parseFloat(values.quantity) || 0,
      notes: values.notes || undefined,
    };
    try {
      switch (kind) {
        case "opening":
          await recordOpening({ ...common, rate: parseFloat(values.rate || "0") || 0 });
          break;
        case "receive":
          await receiveStock({
            ...common,
            rate: parseFloat(values.rate || "0") || 0,
            projectId: values.projectId && values.projectId !== "none" ? (values.projectId as Id<"projects">) : undefined,
          });
          break;
        case "issue":
          await issueStock({
            ...common,
            projectId: values.projectId && values.projectId !== "none" ? (values.projectId as Id<"projects">) : undefined,
          });
          break;
        case "adjust_in":
          await adjustStock({ ...common, direction: "in", rate: values.rate ? parseFloat(values.rate) : undefined });
          break;
        case "adjust_out":
          await adjustStock({ ...common, direction: "out" });
          break;
        case "transfer":
          if (!values.toGodownId) {
            toast.error("Select a destination godown");
            return;
          }
          await transferStock({
            itemId: common.itemId,
            fromGodownId: common.godownId,
            toGodownId: values.toGodownId as Id<"stockGodowns">,
            date: common.date,
            quantity: common.quantity,
            notes: common.notes,
          });
          break;
      }
      toast.success("Stock movement recorded");
      handleClose(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to record movement");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Stock Movement</DialogTitle>
        </DialogHeader>
        <Tabs value={kind} onValueChange={(v) => setKind(v as MovementKind)}>
          <TabsList className="grid grid-cols-3 gap-1 h-auto">
            {(Object.keys(KIND_LABELS) as MovementKind[]).map((k) => (
              <TabsTrigger key={k} value={k} className="text-xs">
                {KIND_LABELS[k]}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={kind} className="mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="itemId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item *</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value}
                          onValueChange={field.onChange}
                          options={itemOptions}
                          placeholder="Select item…"
                          searchPlaceholder="Search items…"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="godownId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{kind === "transfer" ? "From Godown *" : "Godown *"}</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            value={field.value}
                            onValueChange={field.onChange}
                            options={godownOptions}
                            placeholder="Select godown…"
                            searchPlaceholder="Search…"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {kind === "transfer" ? (
                    <FormField
                      control={form.control}
                      name="toGodownId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>To Godown *</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              value={field.value ?? ""}
                              onValueChange={field.onChange}
                              options={godownOptions}
                              placeholder="Select godown…"
                              searchPlaceholder="Search…"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                {kind === "transfer" && (
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity *</FormLabel>
                        <FormControl>
                          <Input type="number" min={0.01} step="0.01" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {needsRate && (
                    <FormField
                      control={form.control}
                      name="rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rate per unit (₹){kind === "adjust_in" ? " (optional)" : " *"}</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                {needsProject && (
                  <FormField
                    control={form.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project (optional)</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            value={field.value ?? "none"}
                            onValueChange={field.onChange}
                            options={projectOptions}
                            placeholder="Link to project…"
                            searchPlaceholder="Search projects…"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea rows={2} placeholder="Optional…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    Record {KIND_LABELS[kind]}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
