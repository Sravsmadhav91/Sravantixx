/**
 * Notification panel for owners: bookings staff submitted that are waiting for approval.
 * Reused on the Dashboard and Bookings pages.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { Building2, ChevronDown, ChevronUp, ClipboardCheck, User } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDateTime } from "@/lib/format.ts";
import { useRole } from "@/hooks/use-role.ts";

export default function ApprovalNotificationsPanel() {
  const [expanded, setExpanded] = useState(true);
  const { isOwner } = useRole();
  const pending = useQuery(api.bookings.listPendingApprovals, isOwner ? {} : "skip");

  if (!isOwner || !pending || pending.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-400/40 bg-amber-400/5">
      <button
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
          <ClipboardCheck className="size-4 shrink-0" />
          <span>
            {pending.length} booking{pending.length > 1 ? "s" : ""} waiting for your approval
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
          {pending.map((booking) => (
            <div key={booking._id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="flex items-center gap-1.5 font-medium truncate">
                  <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                  {booking.unit.projectName} · {booking.unit.number}
                </p>
                <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3">
                  <span className="flex items-center gap-1">
                    <User className="size-3" />
                    {booking.buyer.name}
                  </span>
                  {booking.submittedAt && <span>Submitted {formatDateTime(booking.submittedAt)}</span>}
                </p>
              </div>
              <span className="font-semibold tabular-nums">
                {formatCompactInr(booking.agreementValue)}
              </span>
              <Link
                to="/bookings"
                className="rounded px-2 py-1 text-xs text-primary hover:bg-muted transition-colors"
              >
                Review
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
