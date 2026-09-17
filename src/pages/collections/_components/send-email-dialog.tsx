import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Mail, Loader2, AlertCircle } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";

type Installment = {
  _id: Id<"paymentInstallments">;
  milestone: string;
  amount: number;
  dueDate?: string | null;
  status: "pending" | "demanded" | "paid";
  emailedAt?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookingId: Id<"bookings">;
  buyerEmail?: string;
  buyerName?: string;
  installments: Installment[];
};

type EmailType = "demand_notice" | "reminder" | "booking_confirmation";

const EMAIL_TYPE_OPTIONS: { value: EmailType; label: string; description: string }[] = [
  {
    value: "demand_notice",
    label: "Payment Demand Notice",
    description: "Formal notice for demanded/overdue installments",
  },
  {
    value: "reminder",
    label: "Payment Reminder",
    description: "Friendly reminder for upcoming or pending installments",
  },
  {
    value: "booking_confirmation",
    label: "Booking Confirmation",
    description: "Confirms the booking with the full payment schedule",
  },
];

export default function SendEmailDialog({
  open,
  onOpenChange,
  bookingId,
  buyerEmail,
  buyerName,
  installments,
}: Props) {
  const sendEmail = useMutation(api.emails.sendPaymentReminderEmail);

  const [emailType, setEmailType] = useState<EmailType>("demand_notice");
  const [selectedIds, setSelectedIds] = useState<Set<Id<"paymentInstallments">>>(new Set());
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);

  const unpaidInstallments = installments.filter((i) => i.status !== "paid");

  // Auto-select relevant installments when type changes
  const handleTypeChange = (t: EmailType) => {
    setEmailType(t);
    if (t === "demand_notice") {
      setSelectedIds(new Set(unpaidInstallments.filter((i) => i.status === "demanded").map((i) => i._id)));
    } else if (t === "reminder") {
      setSelectedIds(new Set(unpaidInstallments.map((i) => i._id)));
    } else {
      setSelectedIds(new Set(installments.map((i) => i._id)));
    }
  };

  const toggleInstallment = (id: Id<"paymentInstallments">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (!buyerEmail) {
      toast.error("Buyer has no email address on file");
      return;
    }
    setSending(true);
    try {
      const email = await sendEmail({
        bookingId,
        installmentIds: [...selectedIds],
        emailType,
        customMessage: customMessage.trim() || undefined,
      });
      toast.success(`Email sent to ${email}`);
      onOpenChange(false);
      setCustomMessage("");
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Failed to send email",
      );
    } finally {
      setSending(false);
    }
  };

  const showInstallments = emailType !== "booking_confirmation" as string;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-5 text-primary" />
            Send Email to Buyer
          </DialogTitle>
          <DialogDescription>
            {buyerEmail
              ? `Will be sent to ${buyerName ?? "buyer"} at ${buyerEmail}`
              : "No email address on file for this buyer."}
          </DialogDescription>
        </DialogHeader>

        {!buyerEmail && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <span>Add an email address to the buyer's profile before sending emails.</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Email type */}
          <div className="space-y-1.5">
            <Label>Email type</Label>
            <Select value={emailType} onValueChange={(v) => handleTypeChange(v as EmailType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div>
                      <p className="font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Installment selection */}
          {showInstallments && installments.length > 0 && (
            <div className="space-y-1.5">
              <Label>
                {emailType === "demand_notice" ? "Installments to demand" : "Installments to include"}
              </Label>
              <div className="rounded-lg border divide-y max-h-52 overflow-y-auto">
                {installments.map((inst) => (
                  <label
                    key={inst._id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <input
                      type="checkbox"
                      className="size-4 rounded accent-primary"
                      checked={selectedIds.has(inst._id)}
                      onChange={() => toggleInstallment(inst._id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inst.milestone}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCompactInr(inst.amount)}
                        {inst.dueDate ? ` · Due ${formatDate(inst.dueDate)}` : ""}
                        {inst.emailedAt ? ` · Last emailed ${formatDate(inst.emailedAt)}` : ""}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        inst.status === "demanded"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                          : inst.status === "paid"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {inst.status}
                    </Badge>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedIds.size} selected
              </p>
            </div>
          )}

          {/* Custom message */}
          <div className="space-y-1.5">
            <Label>
              Additional message{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              placeholder="Add a personal note or extra instructions…"
              rows={3}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSend()}
            disabled={sending || !buyerEmail || (showInstallments && selectedIds.size === 0 && emailType !== "booking_confirmation")}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Send email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
