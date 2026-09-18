import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  ClipboardList,
  Plus,
  CheckCircle,
  XCircle,
  ArrowRight,
  Paperclip,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
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
import { Textarea } from "@/components/ui/textarea.tsx";
import { formatDate } from "@/lib/format.ts";
import { useRole } from "@/hooks/use-role.ts";
import {
  MATERIAL_REQUEST_STATUS_LABELS,
  MATERIAL_REQUEST_STATUS_COLORS,
} from "@/lib/material-requests.ts";
import { cn } from "@/lib/utils.ts";
import MaterialRequestDialog from "./_components/material-request-dialog.tsx";
import ConvertToPoDialog from "./_components/convert-to-po-dialog.tsx";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { useMigrationMaterialRequests } from "@/hooks/use-migration-material-requests.ts";
import { useMigrationProjects } from "@/hooks/use-migration-projects.ts";
import {
  createMigrationMaterialRequest,
  reviewMigrationMaterialRequest,
} from "@/lib/migration-api.ts";
import MigrationConvertToPoDialog from "./_components/migration-convert-to-po-dialog.tsx";
import MigrationQuotationDialog from "./_components/migration-quotation-dialog.tsx";

function MigrationMaterialRequestsPage() {
  const { role } = useRole();
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [neededByDate, setNeededByDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([
    { description: "", quantity: "", unit: "" },
  ]);
  const [convertRequest, setConvertRequest] = useState<any | null>(null);
  const [quotationRequest, setQuotationRequest] = useState<any | null>(null);
  const projects = useMigrationProjects().projects;
  const requests = useMigrationMaterialRequests(status);
  const canReview = role === "owner" || role === "project_manager";
  const submit = async () => {
    if (
      !projectId ||
      lines.some(
        (line) =>
          !line.description.trim() || !line.quantity || !line.unit.trim(),
      )
    ) {
      toast.error("Project and all material details are required");
      return;
    }
    try {
      await createMigrationMaterialRequest({
        projectId,
        neededByDate: neededByDate || undefined,
        notes: notes || undefined,
        lines: lines.map((line) => ({
          ...line,
          quantity: Number(line.quantity),
        })),
      });
      toast.success("Request submitted");
      setCreateOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not submit request",
      );
    }
  };
  const review = async (
    requestId: string,
    decision: "approved" | "rejected",
  ) => {
    const rejectionReason =
      decision === "rejected"
        ? window.prompt("Rejection reason") || ""
        : undefined;
    if (decision === "rejected" && !rejectionReason) return;
    try {
      await reviewMigrationMaterialRequest(
        requestId,
        decision,
        rejectionReason,
      );
      toast.success(`Request ${decision}`);
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not review request",
      );
    }
  };
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">
            Material Requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Site requests for materials, reviewed before ordering.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            className="h-8 rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="ordered">Ordered</option>
            <option value="rejected">Rejected</option>
          </select>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New request
          </Button>
        </div>
      </div>
      {requests === undefined ? (
        <Skeleton className="h-20 w-full" />
      ) : requests.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>No material requests yet</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {requests.map((request) => (
            <div
              key={request._id}
              className="rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="mr-2 font-mono text-xs text-muted-foreground">
                    {request.requestNumber}
                  </span>
                  <span className="font-medium">{request.projectName}</span>
                  <Badge className="ml-2 text-[10px]">{request.status}</Badge>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Requested by {request.requestedByName} on{" "}
                    {request.requestDate}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {request.status === "pending" && canReview && <><Button size="sm" variant="secondary" onClick={() => void review(request._id, "approved")}><CheckCircle className="size-4" />Approve</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => void review(request._id, "rejected")}><XCircle className="size-4" />Reject</Button></>}
                  <Button size="sm" variant="ghost" onClick={() => setQuotationRequest(request)}><Paperclip className="size-4" />Quotation</Button>
                  {request.status === "approved" && <Button size="sm" onClick={() => setConvertRequest(request)}>Convert to PO</Button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <MigrationConvertToPoDialog
        request={convertRequest}
        open={!!convertRequest}
        onOpenChange={(open) => {
          if (!open) setConvertRequest(null);
        }}
      />
      <MigrationQuotationDialog request={quotationRequest} open={!!quotationRequest} onOpenChange={(open) => { if (!open) setQuotationRequest(null); }} />
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-lg bg-card p-6">
            <h2 className="text-xl font-semibold">New material request</h2>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">Select project...</option>
              {(projects ?? []).map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={neededByDate}
              onChange={(e) => setNeededByDate(e.target.value)}
            />
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Materials needed
            </p>
            {lines.map((line, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Material description"
                  value={line.description}
                  onChange={(e) =>
                    setLines(
                      lines.map((item, i) =>
                        i === index
                          ? { ...item, description: e.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <Input
                  className="w-20"
                  type="number"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) =>
                    setLines(
                      lines.map((item, i) =>
                        i === index
                          ? { ...item, quantity: e.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <Input
                  className="w-24"
                  placeholder="Unit"
                  value={line.unit}
                  onChange={(e) =>
                    setLines(
                      lines.map((item, i) =>
                        i === index ? { ...item, unit: e.target.value } : item,
                      ),
                    )
                  }
                />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove material" className="shrink-0 text-muted-foreground hover:text-destructive" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setLines([
                  ...lines,
                  { description: "", quantity: "", unit: "" },
                ])
              }
            >
              <Plus className="size-4" />
              Add material
            </Button>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void submit()}>Submit request</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MaterialRequestsInner() {
  const { isOwner, role } = useRole();
  const canReview = isOwner || role === "project_manager";
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [convertRequestId, setConvertRequestId] =
    useState<Id<"materialRequests"> | null>(null);
  const [rejectRequestId, setRejectRequestId] =
    useState<Id<"materialRequests"> | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const requests = useQuery(api.materialRequests.listMaterialRequests, {
    status:
      statusFilter !== "all"
        ? (statusFilter as "pending" | "approved" | "rejected" | "ordered")
        : undefined,
  });
  const review = useMutation(api.materialRequests.reviewMaterialRequest);
  const cancelRequest = useMutation(api.materialRequests.cancelMaterialRequest);

  const handleApprove = async (id: Id<"materialRequests">) => {
    try {
      await review({ requestId: id, decision: "approved" });
      toast.success("Request approved");
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not approve",
      );
    }
  };

  const handleReject = async () => {
    if (!rejectRequestId) return;
    try {
      await review({
        requestId: rejectRequestId,
        decision: "rejected",
        rejectionReason: rejectReason,
      });
      toast.success("Request rejected");
      setRejectRequestId(null);
      setRejectReason("");
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not reject",
      );
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Material Requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Site requests for materials, reviewed before ordering.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="ordered">Ordered</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New request
          </Button>
        </div>
      </div>

      {requests === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>No material requests yet</EmptyTitle>
            <EmptyDescription>
              Raise a request for materials needed on site.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> New request
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div
              key={r._id}
              className="rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.requestNumber}
                    </span>
                    <span className="font-medium">{r.projectName}</span>
                    <Badge
                      className={cn(
                        "text-[10px] font-semibold",
                        MATERIAL_REQUEST_STATUS_COLORS[r.status],
                      )}
                    >
                      {MATERIAL_REQUEST_STATUS_LABELS[r.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Requested by {r.requestedByName} on{" "}
                    {formatDate(r.requestDate)}
                    {r.neededByDate
                      ? ` · Needed by ${formatDate(r.neededByDate)}`
                      : ""}
                  </p>
                  {r.notes && (
                    <p className="text-xs text-muted-foreground">{r.notes}</p>
                  )}
                  {r.status === "rejected" && r.rejectionReason && (
                    <p className="text-xs text-destructive">
                      Rejected: {r.rejectionReason}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {r.status === "pending" && canReview && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs"
                        onClick={() => handleApprove(r._id)}
                      >
                        <CheckCircle className="size-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => setRejectRequestId(r._id)}
                      >
                        <XCircle className="size-3.5" /> Reject
                      </Button>
                    </>
                  )}
                  {r.status === "approved" && (
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setConvertRequestId(r._id)}
                    >
                      <ArrowRight className="size-3.5" /> Convert to PO
                    </Button>
                  )}
                  {r.status === "pending" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        try {
                          await cancelRequest({ requestId: r._id });
                          toast.success("Request cancelled");
                        } catch {
                          toast.error("Could not cancel request");
                        }
                      }}
                    >
                      <X className="size-3.5" /> Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <MaterialRequestDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ConvertToPoDialog
        open={!!convertRequestId}
        onOpenChange={(v) => {
          if (!v) setConvertRequestId(null);
        }}
        requestId={convertRequestId ?? undefined}
      />

      <AlertDialog
        open={!!rejectRequestId}
        onOpenChange={(v) => {
          if (!v) {
            setRejectRequestId(null);
            setRejectReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject material request</AlertDialogTitle>
            <AlertDialogDescription>
              Let the requester know why this was rejected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for rejection"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={!rejectReason.trim()}
            >
              Reject request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function MaterialRequestsPage() {
  if (migrationApiEnabled) return <MigrationMaterialRequestsPage />;
  return (
    <>
      <AuthLoading>
        <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
          <Skeleton className="h-20 w-full" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="mx-auto w-full max-w-4xl p-8">
          <SignInButton />
        </div>
      </Unauthenticated>
      <Authenticated>
        <MaterialRequestsInner />
      </Authenticated>
    </>
  );
}
