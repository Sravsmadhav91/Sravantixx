/**
 * Reusable alert panels for overdue and upcoming-due instalments.
 * Used on both the Dashboard and the Collections page.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Calendar,
  ChevronDown,
  ChevronUp,
  Phone,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate, formatDateTime } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";

// ── Types (match listOverdue / listUpcomingDue return shapes) ─────────────────

type InstWithContext = Doc<"paymentInstallments"> & {
  buyerName: string;
  buyerPhone: string;
  unitNumber: string;
  projectName: string;
  bookingId: Id<"bookings">;
};

// ── Mark-reminded button ──────────────────────────────────────────────────────

function RemindButton({ installmentId, remindedAt }: { installmentId: Id<"paymentInstallments">; remindedAt?: string }) {
  const markReminded = useMutation(api.payments.markReminded);
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try {
      await markReminded({ installmentId });
      toast.success("Marked as reminded");
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Could not mark as reminded",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-7 gap-1 text-xs", remindedAt ? "text-muted-foreground" : "text-primary")}
      onClick={handle}
      disabled={loading}
      title={remindedAt ? `Last reminded ${formatDateTime(remindedAt)}` : "Mark as reminded"}
    >
      {remindedAt ? <BellOff className="size-3.5" /> : <Bell className="size-3.5" />}
      {remindedAt ? "Re-remind" : "Remind"}
    </Button>
  );
}

// ── Overdue panel ─────────────────────────────────────────────────────────────

type OverduePanelProps = {
  items: InstWithContext[];
  /** Compact mode collapses to a summary line on ≥5 items */
  compact?: boolean;
  readOnly?: boolean;
};

export function OverduePanel({ items, compact = false, readOnly = false }: OverduePanelProps) {
  const [expanded, setExpanded] = useState(!compact);

  if (items.length === 0) return null;

  const totalOverdue = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5">
      {/* Header */}
      <button
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {items.length} overdue instalment{items.length > 1 ? "s" : ""} —{" "}
            {formatCompactInr(totalOverdue)} pending
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="size-4 shrink-0 text-destructive" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-destructive" />
        )}
      </button>

      {/* Rows */}
      {expanded && (
        <div className="border-t border-destructive/20 divide-y divide-destructive/10">
          {items.map((inst) => (
            <div key={inst._id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-medium truncate">
                  {inst.buyerName}
                  <span className="ml-1 text-muted-foreground font-normal">
                    · {inst.projectName} {inst.unitNumber}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                  <span>{inst.milestone}</span>
                  <span className="text-destructive font-medium">
                    Due {formatDate(inst.dueDate!)}
                  </span>
                  {inst.remindedAt && (
                    <span className="text-muted-foreground">
                      Reminded {formatDate(inst.remindedAt)}
                    </span>
                  )}
                </p>
              </div>
              <span className="font-semibold tabular-nums text-destructive">
                {formatCompactInr(inst.amount)}
              </span>
              <div className="flex items-center gap-1">
                {inst.buyerPhone && (
                  <a
                    href={`tel:${inst.buyerPhone}`}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                    title={inst.buyerPhone}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="size-3" />
                    Call
                  </a>
                )}
                {!readOnly && <RemindButton
                  installmentId={inst._id}
                  remindedAt={inst.remindedAt}
                />}
                <Link
                  to={`/collections/${inst.bookingId}`}
                  className="rounded px-2 py-1 text-xs text-primary hover:bg-muted transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Upcoming due panel ────────────────────────────────────────────────────────

type UpcomingPanelProps = {
  items: InstWithContext[];
  readOnly?: boolean;
};

export function UpcomingDuePanel({ items, readOnly = false }: UpcomingPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (items.length === 0) return null;

  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="rounded-lg border border-amber-400/40 bg-amber-400/5">
      <button
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
          <Calendar className="size-4 shrink-0" />
          <span>
            {items.length} instalment{items.length > 1 ? "s" : ""} due within 7 days —{" "}
            {formatCompactInr(total)}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="size-4 shrink-0 text-amber-600" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-amber-600" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-amber-400/20 divide-y divide-amber-400/10">
          {items.map((inst) => (
            <div key={inst._id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-medium truncate">
                  {inst.buyerName}
                  <span className="ml-1 text-muted-foreground font-normal">
                    · {inst.projectName} {inst.unitNumber}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                  <span>{inst.milestone}</span>
                  <span className="text-amber-700 dark:text-amber-400 font-medium">
                    Due {formatDate(inst.dueDate!)}
                  </span>
                  {inst.remindedAt && (
                    <span>Reminded {formatDate(inst.remindedAt)}</span>
                  )}
                </p>
              </div>
              <span className="font-semibold tabular-nums">
                {formatCompactInr(inst.amount)}
              </span>
              <div className="flex items-center gap-1">
                {inst.buyerPhone && (
                  <a
                    href={`tel:${inst.buyerPhone}`}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                    title={inst.buyerPhone}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="size-3" />
                    Call
                  </a>
                )}
                {!readOnly && <RemindButton
                  installmentId={inst._id}
                  remindedAt={inst.remindedAt}
                />}
                <Link
                  to={`/collections/${inst.bookingId}`}
                  className="rounded px-2 py-1 text-xs text-primary hover:bg-muted transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
