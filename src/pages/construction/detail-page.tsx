import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import {
  AlertTriangleIcon,
  CheckCircle,
  ClipboardList,
  HardHat,
  IndianRupee,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  ErrorState,
  ErrorStateContent,
  ErrorStateDescription,
  ErrorStateHeader,
  ErrorStateMedia,
  ErrorStateTitle,
} from "@/components/ui/error-state.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_COLORS,
  progressColor,
} from "@/lib/construction.ts";
import { cn } from "@/lib/utils.ts";
import PageHeader from "@/components/page-header.tsx";
import StageFormDialog from "./_components/stage-form-dialog.tsx";
import ExpenseFormDialog from "./_components/expense-form-dialog.tsx";
import BoqDialog from "./_components/boq-dialog.tsx";
import type { Doc } from "@/convex/_generated/dataModel";
import type { StageEstimateVsActual } from "@/convex/construction.ts";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import MigrationConstructionDetail from "./migration-detail.tsx";

function StageEstimateSummary({ estimate }: { estimate: StageEstimateVsActual | undefined }) {
  if (!estimate || estimate.estimated === 0) return null;
  const over = estimate.variance < 0;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">
        BOQ estimate: <span className="font-medium text-foreground">{formatCompactInr(estimate.estimated)}</span>
      </span>
      <span className="text-muted-foreground">
        Actual: <span className="font-medium text-foreground">{formatCompactInr(estimate.actual)}</span>
      </span>
      {estimate.actual > 0 && (
        <span className={cn("font-medium", over ? "text-destructive" : "text-primary")}>
          {over ? "Over" : "Under"} by {formatCompactInr(Math.abs(estimate.variance))}
        </span>
      )}
    </div>
  );
}

export default function ConstructionDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects"> | undefined;

  if (migrationApiEnabled && params.projectId) {
    return <MigrationConstructionDetail projectId={params.projectId} />;
  }

  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editStage, setEditStage] = useState<Doc<"constructionStages"> | undefined>();
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Doc<"projectExpenses"> | undefined>();
  const [boqStage, setBoqStage] = useState<Doc<"constructionStages"> | undefined>();

  const project = useQuery(api.projects.getById, projectId ? { projectId } : "skip");
  const stages = useQuery(api.construction.listStages, projectId ? { projectId } : "skip");
  const expenses = useQuery(api.construction.listExpenses, projectId ? { projectId } : "skip");
  const summary = useQuery(
    api.construction.getConstructionSummary,
    projectId ? { projectId } : "skip",
  );
  const stageEstimates = useQuery(
    api.construction.getStageEstimateVsActual,
    projectId ? { projectId } : "skip",
  );

  const removeStage = useMutation(api.construction.removeStage);
  const removeExpense = useMutation(api.construction.removeExpense);

  if (!projectId) {
    return (
      <div className="p-8">
        <ErrorState>
          <ErrorStateHeader>
            <ErrorStateMedia variant="icon"><AlertTriangleIcon /></ErrorStateMedia>
            <ErrorStateTitle>Project not found</ErrorStateTitle>
          </ErrorStateHeader>
          <ErrorStateContent>
            <Button size="sm" asChild><Link to="/construction">Back</Link></Button>
          </ErrorStateContent>
        </ErrorState>
      </div>
    );
  }

  const isLoading = project === undefined || stages === undefined || expenses === undefined;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 p-4 md:p-8">
      <PageHeader
        title={project?.name ?? "Construction"}
        breadcrumbs={[
          { label: "Construction", to: "/construction" },
          { label: project?.name ?? "…" },
        ]}
        actions={
          project && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { setEditStage(undefined); setStageDialogOpen(true); }}>
                <Plus className="size-4" /> Add stage
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setEditExpense(undefined); setExpenseDialogOpen(true); }}>
                <Plus className="size-4" /> Add expense
              </Button>
            </div>
          )
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          {/* Project subtitle */}
          {project && (
            <p className="text-sm text-muted-foreground -mt-4">
              {project.city}
              {project.constructionBudget
                ? ` · Budget: ${formatCompactInr(project.constructionBudget)}`
                : ""}
            </p>
          )}

          {/* Summary tiles */}
          {summary && (
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Overall progress",
                  value: `${summary.overallProgress}%`,
                  sub: `${summary.stageCount} stage${summary.stageCount !== 1 ? "s" : ""}`,
                },
                {
                  label: "Total spent",
                  value: formatCompactInr(summary.totalExpenses),
                  sub: project?.constructionBudget
                    ? `Budget: ${formatCompactInr(project.constructionBudget)}`
                    : "No budget set",
                  highlight:
                    project?.constructionBudget != null &&
                    summary.totalExpenses > project.constructionBudget,
                },
                {
                  label: "Remaining budget",
                  value: project?.constructionBudget
                    ? formatCompactInr(
                        Math.max(0, project.constructionBudget - summary.totalExpenses),
                      )
                    : "—",
                  sub: project?.constructionBudget
                    ? summary.totalExpenses > project.constructionBudget
                      ? "Over budget"
                      : "Available"
                    : "Set a budget on the project",
                  highlight:
                    project?.constructionBudget != null &&
                    summary.totalExpenses > project.constructionBudget,
                },
              ].map((tile) => (
                <Card key={tile.label}>
                  <CardContent className="space-y-1">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {tile.label}
                    </p>
                    <p
                      className={cn(
                        "text-2xl font-semibold tabular-nums",
                        tile.highlight && "text-destructive",
                      )}
                    >
                      {tile.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{tile.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Construction stages */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Construction stages</h2>
              <Button
                size="sm"
                onClick={() => {
                  setEditStage(undefined);
                  setStageDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                Add stage
              </Button>
            </div>

            {stages.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><HardHat /></EmptyMedia>
                  <EmptyTitle>No stages yet</EmptyTitle>
                  <EmptyDescription>
                    Add stages like Foundation, Slab, Brickwork, and Handover.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditStage(undefined);
                      setStageDialogOpen(true);
                    }}
                  >
                    Add stage
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="space-y-2">
                {stages.map((stage) => (
                  <div
                    key={stage._id}
                    className="rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {stage.percentComplete >= 100 ? (
                            <CheckCircle className="size-4 shrink-0 text-primary" />
                          ) : (
                            <HardHat
                              className={cn(
                                "size-4 shrink-0",
                                progressColor(stage.percentComplete),
                              )}
                            />
                          )}
                          <span className="font-medium">{stage.name}</span>
                          <span
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              progressColor(stage.percentComplete),
                            )}
                          >
                            {stage.percentComplete}%
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${stage.percentComplete}%` }}
                          />
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {stage.startDate && (
                            <span>Start: {formatDate(stage.startDate)}</span>
                          )}
                          {stage.targetDate && (
                            <span>Target: {formatDate(stage.targetDate)}</span>
                          )}
                          {stage.completedDate && (
                            <span>Completed: {formatDate(stage.completedDate)}</span>
                          )}
                          {stage.notes && <span>{stage.notes}</span>}
                        </div>
                        {/* BOQ estimate vs actual */}
                        <StageEstimateSummary estimate={stageEstimates?.find((s) => s.stageId === stage._id)} />
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => setBoqStage(stage)}
                        >
                          <ClipboardList className="size-4" /> BOQ
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditStage(stage);
                            setStageDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            try {
                              await removeStage({ stageId: stage._id });
                              toast.success("Stage removed");
                            } catch (error) {
                              toast.error(
                                error instanceof ConvexError
                                  ? (error.data as { message: string }).message
                                  : "Could not remove stage",
                              );
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Expenses */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Expenses</h2>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEditExpense(undefined);
                  setExpenseDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                Record expense
              </Button>
            </div>

            {/* Category breakdown */}
            {summary && Object.keys(summary.byCategory).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.byCategory).map(([cat, amt]) => (
                  <span
                    key={cat}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      EXPENSE_CATEGORY_COLORS[cat] ?? EXPENSE_CATEGORY_COLORS.other,
                    )}
                  >
                    {EXPENSE_CATEGORY_LABELS[cat] ?? cat}: {formatCompactInr(amt)}
                  </span>
                ))}
              </div>
            )}

            {expenses.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><IndianRupee /></EmptyMedia>
                  <EmptyTitle>No expenses yet</EmptyTitle>
                  <EmptyDescription>Record material, labour, and approval costs.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase">
                      <th className="px-4 py-2">Description</th>
                      <th className="px-4 py-2">Category</th>
                      <th className="px-4 py-2">Vendor</th>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr key={exp._id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <span className="font-medium">{exp.description}</span>
                          {exp.notes && (
                            <p className="text-xs text-muted-foreground">{exp.notes}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              EXPENSE_CATEGORY_COLORS[exp.category] ??
                                EXPENSE_CATEGORY_COLORS.other,
                            )}
                          >
                            {EXPENSE_CATEGORY_LABELS[exp.category] ?? exp.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {exp.vendor ?? "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {formatDate(exp.expenseDate)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {formatCompactInr(exp.amount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditExpense(exp);
                                setExpenseDialogOpen(true);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={async () => {
                                try {
                                  await removeExpense({ expenseId: exp._id });
                                  toast.success("Expense removed");
                                } catch (error) {
                                  toast.error(
                                    error instanceof ConvexError
                                      ? (error.data as { message: string }).message
                                      : "Could not remove expense",
                                  );
                                }
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/40">
                      <td className="px-4 py-2 font-medium" colSpan={4}>
                        Total expenses
                      </td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">
                        {formatCompactInr(
                          expenses.reduce((s, e) => s + e.amount, 0),
                        )}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* Budget overrun warning */}
          {project?.constructionBudget != null &&
            summary &&
            summary.totalExpenses > project.constructionBudget && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertTriangleIcon className="size-4 shrink-0" />
                Over budget by{" "}
                {formatCompactInr(summary.totalExpenses - project.constructionBudget)}
              </div>
            )}
        </>
      )}

      <StageFormDialog
        open={stageDialogOpen}
        onOpenChange={(v) => {
          setStageDialogOpen(v);
          if (!v) setEditStage(undefined);
        }}
        projectId={projectId}
        stage={editStage}
        nextOrder={(stages?.length ?? 0) + 1}
      />
      <ExpenseFormDialog
        open={expenseDialogOpen}
        onOpenChange={(v) => {
          setExpenseDialogOpen(v);
          if (!v) setEditExpense(undefined);
        }}
        projectId={projectId}
        expense={editExpense}
        stages={stages}
      />
      <BoqDialog
        open={!!boqStage}
        onOpenChange={(v) => {
          if (!v) setBoqStage(undefined);
        }}
        stageId={boqStage?._id}
        stageName={boqStage?.name ?? ""}
      />
    </div>
  );
}
