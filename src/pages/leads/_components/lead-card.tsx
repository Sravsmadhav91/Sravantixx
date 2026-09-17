import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  UserCheck,
  UserCog,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { cn } from "@/lib/utils.ts";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_CLASSES,
  LEAD_SOURCE_LABELS,
  ALL_STATUSES,
  type LeadStatus,
} from "@/lib/leads.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import LeadFormDialog from "./lead-form-dialog.tsx";
import LeadDetailPanel from "./lead-detail-panel.tsx";

type Props = { lead: Doc<"leads"> };

export default function LeadCard({ lead }: Props) {
  const navigate = useNavigate();
  const updateStatus = useMutation(api.leads.updateStatus);
  const convertToBuyer = useMutation(api.leads.convertToBuyer);
  const removeLead = useMutation(api.leads.remove);
  const assignLead = useMutation(api.leads.assign);
  const assignable = useQuery(api.team.listAssignable);

  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [converting, setConverting] = useState(false);

  const isConverted = !!lead.convertedBuyerId;
  const isTerminal = lead.status === "won" || lead.status === "lost";

  const handleAssign = async (userId: string | null) => {
    try {
      await assignLead({ leadId: lead._id, userId: userId ? (userId as Doc<"users">["_id"]) : undefined });
      toast.success(userId ? "Lead assigned" : "Lead unassigned");
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not assign lead",
      );
    }
  };

  const handleStatusChange = async (status: LeadStatus) => {
    try {
      await updateStatus({ leadId: lead._id, status });
      toast.success(`Moved to ${LEAD_STATUS_LABELS[status]}`);
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not update status",
      );
    }
  };

  const handleConvert = async () => {
    setConverting(true);
    try {
      const { buyerId } = await convertToBuyer({ leadId: lead._id });
      toast.success("Lead converted to buyer!");
      navigate(`/buyers/${buyerId}`);
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not convert lead",
      );
    } finally {
      setConverting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await removeLead({ leadId: lead._id });
      toast.success("Lead deleted");
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not delete lead",
      );
    }
  };

  return (
    <>
      <div className={cn("rounded-lg border border-border bg-card p-4 space-y-3 transition-opacity", isTerminal && "opacity-70")}>
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <button
              className="truncate font-semibold text-left hover:text-primary cursor-pointer transition-colors"
              onClick={() => setDetailOpen(true)}
            >
              {lead.name}
              <ChevronRight className="inline size-3.5 ml-0.5 text-muted-foreground" />
            </button>
            <p className="text-xs text-muted-foreground">{lead.phone}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              LEAD_STATUS_CLASSES[lead.status as LeadStatus],
            )}
          >
            {LEAD_STATUS_LABELS[lead.status as LeadStatus]}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-1 text-xs text-muted-foreground">
          {lead.projectInterest && (
            <p className="truncate">
              <span className="font-medium text-foreground">Interest:</span>{" "}
              {lead.projectInterest}
            </p>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <span>{LEAD_SOURCE_LABELS[lead.source as keyof typeof LEAD_SOURCE_LABELS]}</span>
            {lead.budget && (
              <span>Budget: {formatCompactInr(lead.budget)}</span>
            )}
          </div>
          {lead.notes && (
            <p className="line-clamp-2 text-muted-foreground">{lead.notes}</p>
          )}
        </div>

        {/* Lost reason */}
        {lead.lostReason && (
          <p className="text-xs text-muted-foreground italic">Lost: {lead.lostReason}</p>
        )}

        {/* Assignment */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-fit items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground cursor-pointer transition-colors">
              <UserCog className="size-3" />
              {lead.assignedToName ? (
                <span className="text-foreground font-medium">{lead.assignedToName}</span>
              ) : (
                <span>Unassigned</span>
              )}
              <ChevronDown className="size-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(assignable ?? []).map((a) => (
              <DropdownMenuItem key={a.userId} onClick={() => void handleAssign(a.userId)} className="cursor-pointer">
                {a.name}
              </DropdownMenuItem>
            ))}
            {lead.assignedToId && (
              <DropdownMenuItem onClick={() => void handleAssign(null)} className="cursor-pointer text-muted-foreground">
                Unassign
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-1">
          {lead.status === "won" && !isConverted && (
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={handleConvert} disabled={converting}>
              <UserCheck className="size-3" />
              {converting ? "Converting…" : "Convert to buyer"}
            </Button>
          )}

          {isConverted && (
            <Button size="sm" variant="secondary" className="h-7 gap-1 text-xs" onClick={() => navigate(`/buyers/${lead.convertedBuyerId}`)}>
              View buyer <ArrowRight className="size-3" />
            </Button>
          )}

          {!isTerminal && !isConverted && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs">
                  Move to <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {ALL_STATUSES.filter((s) => s !== lead.status).map((s) => (
                  <DropdownMenuItem key={s} onClick={() => void handleStatusChange(s)} className="cursor-pointer">
                    <span className={cn("mr-2 inline-block size-2 rounded-full", s === "won" ? "bg-emerald-500" : s === "lost" ? "bg-muted-foreground" : "bg-primary")} />
                    {LEAD_STATUS_LABELS[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={() => setEditOpen(true)} aria-label="Edit lead">
              <Edit2 className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)} aria-label="Delete lead">
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <LeadFormDialog open={editOpen} onOpenChange={setEditOpen} lead={lead} />

      {detailOpen && <LeadDetailPanel lead={lead} onClose={() => setDetailOpen(false)} />}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              {lead.name}'s lead record will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
