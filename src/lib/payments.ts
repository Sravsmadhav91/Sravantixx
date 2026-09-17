import type { Doc } from "@/convex/_generated/dataModel";

export const PAYMENT_MODE_LABELS: Record<Doc<"receipts">["paymentMode"], string> = {
  cheque: "Cheque",
  neft: "NEFT",
  rtgs: "RTGS",
  upi: "UPI",
  cash: "Cash",
};

export const INSTALLMENT_STATUS_LABELS: Record<
  Doc<"paymentInstallments">["status"],
  string
> = {
  pending: "Pending",
  demanded: "Demanded",
  paid: "Paid",
};

export const INSTALLMENT_STATUS_CLASSES: Record<
  Doc<"paymentInstallments">["status"],
  string
> = {
  pending: "bg-muted text-muted-foreground",
  demanded: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

export type BookingApprovalStatus = NonNullable<Doc<"bookings">["approvalStatus"]>;

export const APPROVAL_STATUS_LABELS: Record<BookingApprovalStatus, string> = {
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
};

export const APPROVAL_STATUS_CLASSES: Record<BookingApprovalStatus, string> = {
  pending_approval: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-destructive/10 text-destructive",
};
