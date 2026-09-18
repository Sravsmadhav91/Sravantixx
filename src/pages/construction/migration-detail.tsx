import { Link } from "react-router-dom";
import { CheckCircle, HardHat, IndianRupee } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import PageHeader from "@/components/page-header.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import {
  EXPENSE_CATEGORY_COLORS,
  EXPENSE_CATEGORY_LABELS,
  progressColor,
} from "@/lib/construction.ts";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { useMigrationConstruction } from "@/hooks/use-migration-construction.ts";
import {
  deleteMigrationConstructionExpense,
  deleteMigrationConstructionStage,
  updateMigrationConstructionExpense,
  updateMigrationConstructionStage,
} from "@/lib/migration-api.ts";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import MigrationStageDialog from "./_components/migration-stage-dialog.tsx";
import MigrationExpenseDialog from "./_components/migration-expense-dialog.tsx";

export default function MigrationConstructionDetail({
  projectId,
}: {
  projectId: string;
}) {
  const [stageOpen, setStageOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseFilters, setExpenseFilters] = useState({ description: "", category: "", vendor: "", date: "", amount: "" });
  const editStage = async (stage: any) => {
    const name = window.prompt("Stage name", stage.name);
    if (name === null) return;
    const percent = window.prompt(
      "Percent complete",
      String(stage.percentComplete),
    );
    if (percent === null) return;
    try {
      await updateMigrationConstructionStage(projectId, stage._id, {
        name,
        percentComplete: Number(percent),
        order: stage.order,
        targetDate: stage.targetDate,
        notes: stage.notes,
      });
      toast.success("Stage updated");
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update stage",
      );
    }
  };
  const deleteStage = async (stage: any) => {
    if (!window.confirm(`Delete stage ${stage.name}?`)) return;
    try {
      await deleteMigrationConstructionStage(projectId, stage._id);
      toast.success("Stage deleted");
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete stage",
      );
    }
  };
  const editExpense = async (expense: any) => {
    const description = window.prompt("Description", expense.description);
    if (description === null) return;
    const amount = window.prompt("Amount", String(expense.amount));
    if (amount === null) return;
    try {
      await updateMigrationConstructionExpense(projectId, expense._id, {
        description,
        amount: Number(amount),
        category: expense.category,
        vendor: expense.vendor,
        expenseDate: expense.expenseDate,
        notes: expense.notes,
      });
      toast.success("Expense updated");
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update expense",
      );
    }
  };
  const deleteExpense = async (expense: any) => {
    if (!window.confirm(`Delete expense ${expense.description}?`)) return;
    try {
      await deleteMigrationConstructionExpense(projectId, expense._id);
      toast.success("Expense deleted");
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete expense",
      );
    }
  };
  const { data, error } = useMigrationConstruction(projectId);
  if (data === undefined) {
    return (
      <div className="w-full space-y-4 p-4 md:p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (!data || error) {
    return (
      <div className="p-8 text-sm text-destructive">
        {error?.message ?? "Project not found"}
      </div>
    );
  }
  const { project, stages, expenses, summary } = data;
  const filteredExpenses = expenses.filter((expense) => {
    const matches = (value: unknown, query: string) => !query.trim() || String(value ?? "").toLowerCase().includes(query.trim().toLowerCase());
    return matches(`${expense.description ?? ""} ${expense.notes ?? ""}`, expenseFilters.description) && matches(`${EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category} ${expense.category}`, expenseFilters.category) && matches(expense.vendor ?? "", expenseFilters.vendor) && matches(expense.expenseDate ? `${expense.expenseDate} ${formatDate(expense.expenseDate)}` : "", expenseFilters.date) && matches(expense.amount, expenseFilters.amount);
  });
  const filteredExpenseTotal = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const overBudget =
    project.constructionBudget != null &&
    summary.totalExpenses > project.constructionBudget;
  return (
    <div className="w-full max-w-none space-y-8 p-4 md:p-8">
      <PageHeader
        title={project.name}
        breadcrumbs={[
          { label: "Construction", to: "/construction" },
          { label: project.name },
        ]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setStageOpen(true)}>
              Add stage
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setExpenseOpen(true)}
            >
              Add expense
            </Button>
          </div>
        }
      />
      <p className="-mt-4 text-sm text-muted-foreground">
        {project.city}
        {project.constructionBudget
          ? ` · Budget: ${formatCompactInr(project.constructionBudget)}`
          : ""}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Overall progress
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {summary.overallProgress}%
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.stageCount} stage{summary.stageCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total spent
            </p>
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                overBudget && "text-destructive",
              )}
            >
              {formatCompactInr(summary.totalExpenses)}
            </p>
            <p className="text-xs text-muted-foreground">
              {project.constructionBudget
                ? `Budget: ${formatCompactInr(project.constructionBudget)}`
                : "No budget set"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Remaining budget
            </p>
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                overBudget && "text-destructive",
              )}
            >
              {project.constructionBudget
                ? formatCompactInr(
                    Math.max(
                      0,
                      project.constructionBudget - summary.totalExpenses,
                    ),
                  )
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {overBudget
                ? "Over budget"
                : project.constructionBudget
                  ? "Available"
                  : "Set a budget on the project"}
            </p>
          </CardContent>
        </Card>
      </div>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Construction stages</h2>
          <Button size="sm" onClick={() => setStageOpen(true)}>
            Add stage
          </Button>
        </div>
        {stages.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HardHat />
              </EmptyMedia>
              <EmptyTitle>No stages yet</EmptyTitle>
              <EmptyDescription>
                Construction stages will appear here after they are added.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-2">
            {stages.map((stage) => (
              <div
                key={stage._id}
                className="rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  {stage.percentComplete >= 100 ? (
                    <CheckCircle className="mt-0.5 size-4 shrink-0 text-primary" />
                  ) : (
                    <HardHat
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        progressColor(stage.percentComplete),
                      )}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{stage.name}</span>
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          progressColor(stage.percentComplete),
                        )}
                      >
                        {stage.percentComplete}%
                      </span>
                      <span className="ml-auto flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void editStage(stage)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => void deleteStage(stage)}
                        >
                          Delete
                        </Button>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${stage.percentComplete}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {stage.stageGroup && <span>{String(stage.stageGroup).replaceAll("_", " ")}</span>}
                      {stage.category && <span>Category: {String(stage.category).replaceAll("_", " ")}</span>}
                      {stage.responsiblePerson && <span>Owner: {stage.responsiblePerson}</span>}
                      {stage.vendor && <span>Vendor: {stage.vendor}</span>}
                      {stage.startDate && (
                        <span>Start: {formatDate(stage.startDate)}</span>
                      )}
                      {stage.targetDate && (
                        <span>Target: {formatDate(stage.targetDate)}</span>
                      )}
                      {stage.completedDate && (
                        <span>
                          Completed: {formatDate(stage.completedDate)}
                        </span>
                      )}
                      {stage.plannedCost != null && <span>Planned: {formatCompactInr(Number(stage.plannedCost))}</span>}
                      {stage.actualCost != null && <span>Actual: {formatCompactInr(Number(stage.actualCost))}</span>}
                      {stage.approvalStatus && <span>Approval: {String(stage.approvalStatus).replaceAll("_", " ")}</span>}
                      {stage.inspectionStatus && <span>Inspection: {String(stage.inspectionStatus).replaceAll("_", " ")}</span>}
                      {stage.attachment && <a href={stage.attachment.dataBase64} download={stage.attachment.fileName} className="text-primary hover:underline">Attachment: {stage.attachment.fileName}</a>}
                      {stage.notes && <span>{stage.notes}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Expenses</h2>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setExpenseOpen(true)}
          >
            Add expense
          </Button>
        </div>
        {Object.keys(summary.byCategory).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.byCategory).map(([category, amount]) => (
              <span
                key={category}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  EXPENSE_CATEGORY_COLORS[category] ??
                    EXPENSE_CATEGORY_COLORS.other,
                )}
              >
                {EXPENSE_CATEGORY_LABELS[category] ?? category}:{" "}
                {formatCompactInr(amount)}
              </span>
            ))}
          </div>
        )}
        {expenses.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IndianRupee />
              </EmptyMedia>
              <EmptyTitle>No expenses yet</EmptyTitle>
              <EmptyDescription>
                Project expenses will appear here after they are recorded.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="w-full overflow-x-auto rounded-lg border border-border">
            <table className="min-w-[1180px] w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
                  <th className="w-[44%] px-4 py-2">Description</th>
                  <th className="w-[17%] px-4 py-2">Category</th>
                  <th className="w-[17%] px-4 py-2">Vendor</th>
                  <th className="w-[10%] px-4 py-2">Date</th>
                  <th className="w-[12%] px-4 py-2 text-right">Amount</th>
                </tr>
                <tr className="border-b border-border bg-background text-left">
                  <th className="px-3 py-2"><input className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" placeholder="Search description..." value={expenseFilters.description} onChange={(event) => setExpenseFilters({ ...expenseFilters, description: event.target.value })} /></th>
                  <th className="px-3 py-2"><input className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" placeholder="Search category..." value={expenseFilters.category} onChange={(event) => setExpenseFilters({ ...expenseFilters, category: event.target.value })} /></th>
                  <th className="px-3 py-2"><input className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" placeholder="Search vendor..." value={expenseFilters.vendor} onChange={(event) => setExpenseFilters({ ...expenseFilters, vendor: event.target.value })} /></th>
                  <th className="px-3 py-2"><input className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" placeholder="Date..." value={expenseFilters.date} onChange={(event) => setExpenseFilters({ ...expenseFilters, date: event.target.value })} /></th>
                  <th className="px-3 py-2"><input className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-xs" placeholder="Amount..." value={expenseFilters.amount} onChange={(event) => setExpenseFilters({ ...expenseFilters, amount: event.target.value })} /></th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr
                    key={expense._id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium">{expense.description}</span>
                      {expense.notes && (
                        <p className="text-xs text-muted-foreground">
                          {expense.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          EXPENSE_CATEGORY_COLORS[expense.category] ??
                            EXPENSE_CATEGORY_COLORS.other,
                        )}
                      >
                        {EXPENSE_CATEGORY_LABELS[expense.category] ??
                          expense.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {expense.vendor ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(expense.expenseDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatCompactInr(expense.amount)}
                      <div className="mt-1 flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void editExpense(expense)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => void deleteExpense(expense)}
                        >
                          Delete
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
                    {formatCompactInr(filteredExpenseTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
      <MigrationStageDialog
        open={stageOpen}
        onOpenChange={setStageOpen}
        projectId={projectId}
      />
      <MigrationExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        projectId={projectId}
      />
      {overBudget && (
        <p className="text-sm text-destructive">
          Over budget by{" "}
          {formatCompactInr(
            summary.totalExpenses - project.constructionBudget!,
          )}
        </p>
      )}
      <Link
        to="/construction"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Back to Construction
      </Link>
    </div>
  );
}
