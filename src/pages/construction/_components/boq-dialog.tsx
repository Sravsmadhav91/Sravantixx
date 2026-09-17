import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Plus, Trash2, ClipboardList } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";

type BoqDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageId: Id<"constructionStages"> | undefined;
  stageName: string;
};

type DraftLine = {
  description: string;
  unit: string;
  quantity: string;
  rate: string;
};

const emptyDraft: DraftLine = { description: "", unit: "", quantity: "", rate: "" };

export default function BoqDialog({ open, onOpenChange, stageId, stageName }: BoqDialogProps) {
  const items = useQuery(api.construction.listBoqItems, stageId ? { stageId } : "skip");
  const addItem = useMutation(api.construction.addBoqItem);
  const updateItem = useMutation(api.construction.updateBoqItem);
  const removeItem = useMutation(api.construction.removeBoqItem);

  const [draft, setDraft] = useState<DraftLine>(emptyDraft);
  const [editingId, setEditingId] = useState<Id<"boqItems"> | null>(null);

  const total = (items ?? []).reduce((s, i) => s + i.amount, 0);

  const resetDraft = () => {
    setDraft(emptyDraft);
    setEditingId(null);
  };

  const startEdit = (item: Doc<"boqItems">) => {
    setEditingId(item._id);
    setDraft({
      description: item.description,
      unit: item.unit,
      quantity: String(item.quantity),
      rate: String(item.rate),
    });
  };

  const submitDraft = async () => {
    if (!stageId) return;
    const quantity = Number(draft.quantity);
    const rate = Number(draft.rate);
    if (!draft.description.trim() || !draft.unit.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(rate) || rate < 0) {
      toast.error("Enter a description, unit, quantity, and rate");
      return;
    }
    try {
      if (editingId) {
        await updateItem({
          itemId: editingId,
          description: draft.description.trim(),
          unit: draft.unit.trim(),
          quantity,
          rate,
        });
        toast.success("BOQ item updated");
      } else {
        await addItem({
          stageId,
          order: (items?.length ?? 0) + 1,
          description: draft.description.trim(),
          unit: draft.unit.trim(),
          quantity,
          rate,
        });
        toast.success("BOQ item added");
      }
      resetDraft();
    } catch (error) {
      toast.error(
        error instanceof ConvexError ? (error.data as { message: string }).message : "Could not save BOQ item",
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetDraft();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bill of Quantities — {stageName}</DialogTitle>
        </DialogHeader>

        {items === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClipboardList />
              </EmptyMedia>
              <EmptyTitle>No BOQ items yet</EmptyTitle>
              <EmptyDescription>Add line items to estimate the cost of this stage.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase">
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.unit}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(item.rate)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCompactInr(item.amount)}</td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => startEdit(item)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            try {
                              await removeItem({ itemId: item._id });
                              toast.success("BOQ item removed");
                            } catch {
                              toast.error("Could not remove item");
                            }
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/40">
                  <td className="px-3 py-2 font-medium" colSpan={4}>
                    Estimated total
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCompactInr(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Inline add/edit row */}
        <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            {editingId ? "Edit item" : "Add line item"}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Input
              placeholder="Description"
              className="sm:col-span-2"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
            <Input
              placeholder="Unit (Bags, Cum…)"
              value={draft.unit}
              onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
            />
            <Input
              type="number"
              placeholder="Qty"
              value={draft.quantity}
              onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
            />
            <Input
              type="number"
              placeholder="Rate (₹)"
              value={draft.rate}
              onChange={(e) => setDraft((d) => ({ ...d, rate: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            {editingId && (
              <Button type="button" variant="ghost" size="sm" onClick={resetDraft}>
                Cancel
              </Button>
            )}
            <Button type="button" size="sm" onClick={submitDraft}>
              <Plus className="size-3.5" /> {editingId ? "Save changes" : "Add item"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
