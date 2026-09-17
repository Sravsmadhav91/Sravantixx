import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Bell, BellOff, Pencil, Trash2, AlertTriangle, ChevronUp, HardHat } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  INSTALLMENT_STATUS_CLASSES,
  INSTALLMENT_STATUS_LABELS,
} from "@/lib/payments.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate, formatDateTime } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";
import { MoreHorizontal, Receipt } from "lucide-react";
import EditInstallmentDialog from "./edit-installment-dialog.tsx";

type InstallmentRowProps = {
  installment: Doc<"paymentInstallments">;
  bookingId: Id<"bookings">;
  onRecordReceipt: () => void;
  readOnly?: boolean;
};

export default function InstallmentRow({
  installment,
  bookingId,
  onRecordReceipt,
  readOnly = false,
}: InstallmentRowProps) {
  const [editOpen, setEditOpen] = useState(false);
  const removeInst = useMutation(api.payments.removeInstallment);
  const raiseDemand = useMutation(api.payments.raiseDemandsForInstallments);
  const markReminded = useMutation(api.payments.markReminded);

  const now = new Date().toISOString();
  const isOverdue =
    installment.status !== "paid" &&
    installment.dueDate !== undefined &&
    installment.dueDate < now;

  const handleDelete = async () => {
    try {
      await removeInst({ installmentId: installment._id });
      toast.success("Milestone removed");
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not remove milestone",
      );
    }
  };

  const handleRaiseDemand = async () => {
    try {
      await raiseDemand({ installmentIds: [installment._id] });
      toast.success(`Demand raised for ${installment.milestone}`);
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not raise demand",
      );
    }
  };

  const handleMarkReminded = async () => {
    try {
      await markReminded({ installmentId: installment._id });
      toast.success("Marked as reminded");
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not mark as reminded",
      );
    }
  };

  return (
    <>
      <tr className="border-b border-border last:border-0">
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {isOverdue && (
              <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
            )}
            <span className={cn("font-medium", isOverdue && "text-destructive")}>
              {installment.milestone}
            </span>
            {installment.triggerStageId && (
              <span
                title={
                  installment.autoTriggeredAt
                    ? `Auto-demanded when stage hit 100%`
                    : "Auto-demands when linked construction stage hits 100%"
                }
              >
                <HardHat className="size-3.5 shrink-0 text-muted-foreground" />
              </span>
            )}
          </div>
          {installment.notes && (
            <p className="text-xs text-muted-foreground">{installment.notes}</p>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">
          {installment.dueDate ? formatDate(installment.dueDate) : "—"}
        </td>
        <td className="px-4 py-3 text-right font-semibold tabular-nums">
          {formatCompactInr(installment.amount)}
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
              INSTALLMENT_STATUS_CLASSES[installment.status],
            )}
          >
            {INSTALLMENT_STATUS_LABELS[installment.status]}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          {!readOnly && <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {installment.status === "pending" && (
                <DropdownMenuItem onClick={() => void handleRaiseDemand()}>
                  <ChevronUp className="size-4" />
                  Raise demand
                </DropdownMenuItem>
              )}
              {installment.status !== "paid" && (
                <DropdownMenuItem onClick={onRecordReceipt}>
                  <Receipt className="size-4" />
                  Record receipt
                </DropdownMenuItem>
              )}
              {installment.status !== "paid" && (
                <DropdownMenuItem onClick={() => void handleMarkReminded()} className="cursor-pointer">
                  {installment.remindedAt ? (
                    <BellOff className="size-4" />
                  ) : (
                    <Bell className="size-4" />
                  )}
                  {installment.remindedAt
                    ? `Re-remind (last: ${formatDate(installment.remindedAt)})`
                    : "Mark as reminded"}
                </DropdownMenuItem>
              )}
              {installment.status !== "paid" && (
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => void handleDelete()}
                disabled={installment.status === "paid"}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>}
        </td>
      </tr>

      <EditInstallmentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        installment={installment}
      />
    </>
  );
}
