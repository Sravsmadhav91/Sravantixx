import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { PAYMENT_MODE_LABELS } from "@/lib/payments.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import { downloadReceipt, type ReceiptData } from "@/lib/pdf.ts";

type ReceiptRowProps = {
  receipt: Doc<"receipts">;
  readOnly?: boolean;
  // Optional context for PDF generation
  pdfContext?: Omit<ReceiptData, "receiptNumber" | "receiptDate" | "amount" | "paymentMode" | "chequeRef" | "notes">;
};

export default function ReceiptRow({ receipt, pdfContext, readOnly = false }: ReceiptRowProps) {
  const removeReceipt = useMutation(api.payments.removeReceipt);

  const handleDelete = async () => {
    try {
      await removeReceipt({ receiptId: receipt._id });
      toast.success("Receipt deleted");
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not delete receipt",
      );
    }
  };

  const handleDownload = () => {
    if (!pdfContext) return;
    downloadReceipt({
      receiptNumber: receipt._id.slice(-8).toUpperCase(),
      receiptDate: receipt.paymentDate,
      amount: receipt.amount,
      paymentMode: receipt.paymentMode,
      chequeRef: receipt.referenceNumber,
      notes: receipt.notes,
      ...pdfContext,
    });
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold tabular-nums">
            {formatCompactInr(receipt.amount)}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {PAYMENT_MODE_LABELS[receipt.paymentMode]}
          </span>
          {receipt.referenceNumber && (
            <span className="text-xs text-muted-foreground">
              Ref: {receipt.referenceNumber}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDate(receipt.paymentDate)}
          {receipt.notes ? ` · ${receipt.notes}` : ""}
        </p>
        {!!receipt.gstAmount && receipt.gstAmount > 0 && (
          <p className="text-xs text-muted-foreground">
            Base: {formatCompactInr(receipt.gstBaseAmount ?? 0)} · GST: {formatCompactInr(receipt.gstAmount)}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {pdfContext && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary"
            onClick={handleDownload}
            aria-label="Download receipt PDF"
            title="Download receipt"
          >
            <Download className="size-4" />
          </Button>
        )}
        {!readOnly && <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => void handleDelete()}
          aria-label="Delete receipt"
        >
          <Trash2 className="size-4" />
        </Button>}
      </div>
    </div>
  );
}
