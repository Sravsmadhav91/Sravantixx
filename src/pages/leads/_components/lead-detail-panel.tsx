import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { ArrowRight, ChevronDown, ClipboardList, History, UserCheck, UserCog } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Doc } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_CLASSES,
  LEAD_SOURCE_LABELS,
  ALL_STATUSES,
  type LeadStatus,
} from "@/lib/leads.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { cn } from "@/lib/utils.ts";
import ActivityTimeline from "@/components/crm/activity-timeline.tsx";
import TaskList from "@/components/crm/task-list.tsx";
import LeadFormDialog from "./lead-form-dialog.tsx";

type Tab = "activity" | "tasks";

type Props = { lead: Doc<"leads">; onClose: () => void };

export default function LeadDetailPanel({ lead, onClose }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("activity");
  const [editOpen, setEditOpen] = useState(false);
  const [converting, setConverting] = useState(false);

  const updateStatus = useMutation(api.leads.updateStatus);
  const convertToBuyer = useMutation(api.leads.convertToBuyer);
  const assignLead = useMutation(api.leads.assign);
  const assignable = useQuery(api.team.listAssignable);

  const isTerminal = lead.status === "won" || lead.status === "lost";
  const isConverted = !!lead.convertedBuyerId;

  const handleAssign = async (userId: string | null) => {
    try {
      await assignLead({ leadId: lead._id, userId: userId ? (userId as Doc<"users">["_id"]) : undefined });
      toast.success(userId ? "Lead assigned" : "Lead unassigned");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Could not assign lead");
    }
  };

  const handleStatusChange = async (status: LeadStatus) => {
    try {
      await updateStatus({ leadId: lead._id, status });
      toast.success(`Moved to ${LEAD_STATUS_LABELS[status]}`);
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Could not update status");
    }
  };

  const handleConvert = async () => {
    setConverting(true);
    try {
      const { buyerId } = await convertToBuyer({ leadId: lead._id });
      toast.success("Lead converted to buyer!");
      navigate(`/buyers/${buyerId}`);
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Could not convert");
    } finally {
      setConverting(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof ClipboardList }[] = [
    { id: "activity", label: "Activity", icon: History },
    { id: "tasks", label: "Tasks", icon: ClipboardList },
  ];

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-start justify-between gap-3 pr-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{lead.name}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", LEAD_STATUS_CLASSES[lead.status as LeadStatus])}>
                    {LEAD_STATUS_LABELS[lead.status as LeadStatus]}
                  </span>
                </div>
                <p className="text-sm font-normal text-muted-foreground">
                  {lead.phone}
                  {lead.email && ` · ${lead.email}`}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Lead info */}
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1.5">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
              <span>Source: <strong className="text-foreground">{LEAD_SOURCE_LABELS[lead.source as keyof typeof LEAD_SOURCE_LABELS]}</strong></span>
              {lead.budget && <span>Budget: <strong className="text-foreground">{formatCompactInr(lead.budget)}</strong></span>}
              {lead.projectInterest && <span>Interest: <strong className="text-foreground">{lead.projectInterest}</strong></span>}
              <span>Assigned to: <strong className="text-foreground">{lead.assignedToName ?? "Unassigned"}</strong></span>
            </div>
            {lead.notes && <p className="text-muted-foreground">{lead.notes}</p>}
            {lead.lostReason && <p className="text-muted-foreground italic">Lost: {lead.lostReason}</p>}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>Edit</Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary">
                  <UserCog className="size-3.5" />
                  Assign <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
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

            {lead.status === "won" && !isConverted && (
              <Button size="sm" onClick={handleConvert} disabled={converting}>
                <UserCheck className="size-3.5" />
                {converting ? "Converting…" : "Convert to buyer"}
              </Button>
            )}

            {isConverted && (
              <Button size="sm" variant="secondary" onClick={() => navigate(`/buyers/${lead.convertedBuyerId}`)}>
                View buyer <ArrowRight className="size-3.5" />
              </Button>
            )}

            {!isTerminal && !isConverted && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm">
                    Move to <ChevronDown className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {ALL_STATUSES.filter((s) => s !== lead.status).map((s) => (
                    <DropdownMenuItem key={s} className="cursor-pointer" onClick={() => void handleStatusChange(s)}>
                      {LEAD_STATUS_LABELS[s]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border -mx-6 px-6">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors border-b-2 -mb-px",
                  tab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-[300px]">
            {tab === "activity" && (
              <ActivityTimeline linkedType="lead" linkedId={lead._id} />
            )}
            {tab === "tasks" && (
              <TaskList linkedType="lead" linkedId={lead._id} linkedName={lead.name} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <LeadFormDialog open={editOpen} onOpenChange={setEditOpen} lead={lead} />
    </>
  );
}
