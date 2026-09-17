import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { useMigrationTasks } from "@/hooks/use-migration-tasks.ts";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardList,
  Trash2,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { PRIORITY_LABELS, PRIORITY_CLASSES } from "@/lib/crm.ts";
import { cn } from "@/lib/utils.ts";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function MigrationTasksDashboardPage() {
  const [showDone, setShowDone] = useState(false);
  const { tasks, error } = useMigrationTasks(showDone);

  if (error) return <div className="p-8 text-sm text-destructive">{error.message}</div>;
  if (tasks === undefined) return <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>;

  const overdue = tasks.filter((t) => t.status === "open" && t.dueDate < new Date().toISOString().slice(0, 10));
  const dueToday = tasks.filter((t) => t.status === "open" && t.dueDate === new Date().toISOString().slice(0, 10));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">CRM</p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">Follow-up tasks across buyers and leads.{tasks.length > 0 && <span className="ml-1 text-primary font-medium">{tasks.length} {showDone ? "completed" : "open"}</span>}{overdue.length > 0 && <span className="ml-1 text-destructive font-medium">· {overdue.length} overdue</span>}</p>
        </div>
        <Button asChild variant="ghost" size="sm"><Link to="/dashboard">← Dashboard</Link></Button>
      </div>
      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {overdue.length > 0 && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5"><p className="text-xs text-destructive font-medium">Overdue</p><p className="text-2xl font-semibold tabular-nums text-destructive">{overdue.length}</p></div>}
          {dueToday.length > 0 && <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-2.5"><p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Due today</p><p className="text-2xl font-semibold tabular-nums">{dueToday.length}</p></div>}
          <div className="rounded-lg border border-border bg-card px-4 py-2.5"><p className="text-xs text-muted-foreground font-medium">Total {showDone ? "completed" : "open"}</p><p className="text-2xl font-semibold tabular-nums">{tasks.length}</p></div>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => setShowDone(false)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors", !showDone ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}>Open tasks</button>
        <button onClick={() => setShowDone(true)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors", showDone ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}>Completed</button>
      </div>
      {tasks.length === 0 ? (
        <Empty><EmptyHeader><EmptyMedia variant="icon"><ClipboardList /></EmptyMedia><EmptyTitle>{showDone ? "No completed tasks" : "No open tasks"}</EmptyTitle><EmptyDescription>{showDone ? "Completed tasks will appear here." : "Tasks are created on buyer and lead detail pages."}</EmptyDescription></EmptyHeader></Empty>
      ) : (
        <div className="space-y-2">{tasks.slice().sort((a, b) => { if (!showDone) { const aOv = a.dueDate < today() ? 0 : 1; const bOv = b.dueDate < today() ? 0 : 1; if (aOv !== bOv) return aOv - bOv; } return a.dueDate.localeCompare(b.dueDate); }).map((task) => { const isOverdueTask = task.status === "open" && task.dueDate < today(); return <div key={task._id} className={cn("flex items-start gap-3 rounded-lg border p-3.5 transition-colors", isOverdueTask ? "border-destructive/40 bg-destructive/5" : "border-border bg-card", task.status === "done" && "opacity-60")}><div className={cn("mt-0.5 shrink-0 transition-colors", task.status === "done" ? "text-primary" : "text-muted-foreground")}><CheckCircle2 className={cn("size-4", task.status === "done" ? "" : "hidden")} /> <Circle className={cn("size-4", task.status === "done" ? "hidden" : "")}/></div><div className="flex-1 min-w-0 space-y-1"><p className={cn("text-sm font-medium", task.status === "done" && "line-through text-muted-foreground")}>{task.title}</p><div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground"><span className={cn("rounded-full px-1.5 py-0.5 font-medium", PRIORITY_CLASSES[task.priority])}>{PRIORITY_LABELS[task.priority]}</span><span className={cn("flex items-center gap-1", isOverdueTask && "text-destructive font-semibold")}><CalendarClock className="size-3" />{task.dueDate}{isOverdueTask && " · overdue"}</span>{task.linkedName && <Link to={task.linkedType === "buyer" ? `/buyers/${task.linkedId}` : task.linkedType === "lead" ? "/leads" : `/collections/${task.linkedId}`} className="text-primary hover:underline capitalize">{task.linkedType}: {task.linkedName}</Link>}</div>{task.notes && <p className="text-xs text-muted-foreground">{task.notes}</p>}</div></div>; })}</div>
      )}
    </div>
  );
}

export default function TasksDashboardPage() {
  if (migrationApiEnabled) return <MigrationTasksDashboardPage />;

  const [showDone, setShowDone] = useState(false);

  const openTasks = useQuery(api.crm.listAllTasks, { status: "open" });
  const doneTasks = useQuery(api.crm.listAllTasks, { status: "done" });
  const completeTask = useMutation(api.crm.completeTask);
  const reopenTask = useMutation(api.crm.reopenTask);
  const deleteTask = useMutation(api.crm.deleteTask);

  const tasks = showDone ? doneTasks : openTasks;

  const overdue = openTasks?.filter((t) => t.dueDate < today()) ?? [];
  const dueToday = openTasks?.filter((t) => t.dueDate === today()) ?? [];

  const handleToggle = async (
    id: (typeof openTasks extends (infer T)[] | undefined ? T : never)["_id"],
    status: "open" | "done",
  ) => {
    try {
      if (status === "open") {
        await completeTask({ taskId: id });
        toast.success("Task completed");
      } else {
        await reopenTask({ taskId: id });
      }
    } catch {
      toast.error("Could not update task");
    }
  };

  const handleDelete = async (
    id: (typeof openTasks extends (infer T)[] | undefined ? T : never)["_id"],
  ) => {
    try {
      await deleteTask({ taskId: id });
      toast.success("Task deleted");
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Could not delete task",
      );
    }
  };

  const entityLink = (linkedType: string, linkedId: string) => {
    if (linkedType === "buyer") return `/buyers/${linkedId}`;
    if (linkedType === "lead") return `/leads`;
    if (linkedType === "booking") return `/collections/${linkedId}`;
    return "#";
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">CRM</p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Follow-up tasks across buyers and leads.
            {openTasks && openTasks.length > 0 && (
              <span className="ml-1 text-primary font-medium">{openTasks.length} open</span>
            )}
            {overdue.length > 0 && (
              <span className="ml-1 text-destructive font-medium">· {overdue.length} overdue</span>
            )}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard">← Dashboard</Link>
        </Button>
      </div>

      {/* Summary pills */}
      {openTasks && openTasks.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {overdue.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5">
              <p className="text-xs text-destructive font-medium">Overdue</p>
              <p className="text-2xl font-semibold tabular-nums text-destructive">{overdue.length}</p>
            </div>
          )}
          {dueToday.length > 0 && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-2.5">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Due today</p>
              <p className="text-2xl font-semibold tabular-nums">{dueToday.length}</p>
            </div>
          )}
          <div className="rounded-lg border border-border bg-card px-4 py-2.5">
            <p className="text-xs text-muted-foreground font-medium">Total open</p>
            <p className="text-2xl font-semibold tabular-nums">{openTasks.length}</p>
          </div>
        </div>
      )}

      {/* Toggle open/done */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowDone(false)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors",
            !showDone ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          )}
        >
          Open tasks
        </button>
        <button
          onClick={() => setShowDone(true)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors",
            showDone ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          )}
        >
          Completed
        </button>
      </div>

      {/* Task list */}
      {tasks === undefined ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : tasks.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
            <EmptyTitle>{showDone ? "No completed tasks" : "No open tasks"}</EmptyTitle>
            <EmptyDescription>
              {showDone
                ? "Completed tasks will appear here."
                : "Tasks are created on buyer and lead detail pages."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {tasks
            .slice()
            .sort((a, b) => {
              if (!showDone) {
                // Sort: overdue first, then by dueDate asc
                const aOv = a.dueDate < today() ? 0 : 1;
                const bOv = b.dueDate < today() ? 0 : 1;
                if (aOv !== bOv) return aOv - bOv;
              }
              return a.dueDate.localeCompare(b.dueDate);
            })
            .map((task) => {
              const isOverdueTask = task.status === "open" && task.dueDate < today();
              return (
                <div
                  key={task._id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3.5 transition-colors",
                    isOverdueTask ? "border-destructive/40 bg-destructive/5" : "border-border bg-card",
                    task.status === "done" && "opacity-60",
                  )}
                >
                  <button
                    onClick={() => void handleToggle(task._id, task.status)}
                    className={cn(
                      "mt-0.5 shrink-0 cursor-pointer transition-colors",
                      task.status === "done" ? "text-primary" : "text-muted-foreground hover:text-primary",
                    )}
                  >
                    {task.status === "done" ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <Circle className="size-4" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className={cn("text-sm font-medium", task.status === "done" && "line-through text-muted-foreground")}>
                      {task.title}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className={cn("rounded-full px-1.5 py-0.5 font-medium", PRIORITY_CLASSES[task.priority])}>
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                      <span className={cn("flex items-center gap-1", isOverdueTask && "text-destructive font-semibold")}>
                        <CalendarClock className="size-3" />
                        {task.dueDate}
                        {isOverdueTask && " · overdue"}
                      </span>
                      {task.linkedName && (
                        <Link
                          to={entityLink(task.linkedType, task.linkedId)}
                          className="text-primary hover:underline capitalize"
                        >
                          {task.linkedType}: {task.linkedName}
                        </Link>
                      )}
                    </div>
                    {task.notes && <p className="text-xs text-muted-foreground">{task.notes}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => void handleDelete(task._id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
