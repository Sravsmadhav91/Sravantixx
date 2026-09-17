import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Circle, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { PRIORITY_LABELS, PRIORITY_CLASSES } from "@/lib/crm.ts";
import {
  createMigrationTask,
  deleteMigrationTask,
  listMigrationTasksForEntity,
  migrationApiEnabled,
  toggleMigrationTask,
  updateMigrationTask,
} from "@/lib/migration-api.ts";
import { cn } from "@/lib/utils.ts";

type Priority = Doc<"crmTasks">["priority"];
type LinkedType = Doc<"crmTasks">["linkedType"];

type Props = {
  linkedType: LinkedType;
  linkedId: string;
  linkedName?: string;
};

const schema = z.object({
  title: z.string().min(1, "Title required"),
  dueDate: z.string().min(1, "Due date required"),
  priority: z.enum(["low", "medium", "high"]),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function TaskForm({
  defaultValues,
  onSubmit,
  onCancel,
  saving,
}: {
  defaultValues: Partial<FormData>;
  onSubmit: (d: FormData) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "medium", dueDate: today(), ...defaultValues },
  });
  const priority = watch("priority");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label>Title</Label>
        <Input {...register("title")} placeholder="e.g. Follow up with buyer" />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Due date</Label>
          <Input type="date" {...register("dueDate")} />
          {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Priority</Label>
          <div className="flex gap-1.5">
            {(["low", "medium", "high"] as Priority[]).map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setValue("priority", p)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-medium cursor-pointer transition-colors",
                  priority === p ? PRIORITY_CLASSES[p] : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                )}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
        <Textarea {...register("notes")} rows={2} className="resize-none" placeholder="Any context for this task…" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Save task"}</Button>
      </div>
    </form>
  );
}

function MigrationTaskList({ linkedType, linkedId, linkedName }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTask, setEditTask] = useState<Doc<"crmTasks"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState<Doc<"crmTasks">[] | undefined>();

  useEffect(() => {
    let active = true;
    listMigrationTasksForEntity(linkedType, linkedId)
      .then((value) => {
        if (active) setTasks(value as Doc<"crmTasks">[]);
      })
      .catch(() => {
        if (active) setTasks([]);
      });
    return () => {
      active = false;
    };
  }, [linkedType, linkedId]);

  const open = tasks?.filter((t) => t.status === "open") ?? [];
  const done = tasks?.filter((t) => t.status === "done") ?? [];

  const handleCreate = async (data: FormData) => {
    setSaving(true);
    try {
      const created = await createMigrationTask({ linkedType, linkedId, linkedName, ...data });
      setTasks((current) => current ? [created, ...current] : [created]);
      setAddOpen(false);
      toast.success("Task created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: FormData) => {
    if (!editTask) return;
    setSaving(true);
    try {
      const updated = await updateMigrationTask(editTask._id, data);
      setTasks((current) => current ? current.map((task) => task._id === editTask._id ? ({ ...task, ...updated }) : task) : [updated]);
      setEditTask(null);
      toast.success("Task updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (task: Doc<"crmTasks">) => {
    try {
      const nextStatus = task.status === "open" ? "done" : "open";
      const updated = await toggleMigrationTask(task._id, nextStatus);
      setTasks((current) => current ? current.map((item) => item._id === task._id ? ({ ...item, ...updated }) : item) : [updated]);
      toast.success(nextStatus === "done" ? "Task completed" : "Task reopened");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update task");
    }
  };

  const handleDelete = async (task: Doc<"crmTasks">) => {
    try {
      await deleteMigrationTask(task._id);
      setTasks((current) => current ? current.filter((item) => item._id !== task._id) : current);
      toast.success("Task deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete task");
    }
  };

  const isOverdue = (t: Doc<"crmTasks">) => t.status === "open" && t.dueDate < today();

  if (tasks === undefined) return <Skeleton className="h-20 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {open.length} open task{open.length !== 1 ? "s" : ""}
          {open.length > 0 && tasks.some(isOverdue) && (
            <span className="ml-1 text-destructive">· {tasks.filter(isOverdue).length} overdue</span>
          )}
        </p>
        <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" /> Add task
        </Button>
      </div>

      {open.length === 0 && done.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted-foreground">No tasks yet. Add one above.</p>
      ) : (
        <div className="space-y-1.5">
          {open.map((task) => (
            <div
              key={task._id}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                isOverdue(task) ? "border-destructive/40 bg-destructive/5" : "border-border bg-card",
              )}
            >
              <button
                onClick={() => void handleToggle(task)}
                className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary cursor-pointer transition-colors"
              >
                <Circle className="size-4" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{task.title}</p>
                <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span className={cn("rounded-full px-1.5 py-0.5 font-medium", PRIORITY_CLASSES[task.priority])}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                  <span className={cn("flex items-center gap-1", isOverdue(task) && "text-destructive font-medium")}>
                    <CalendarClock className="size-3" />
                    {task.dueDate}
                    {isOverdue(task) && " (overdue)"}
                  </span>
                </div>
                {task.notes && <p className="mt-1 text-xs text-muted-foreground">{task.notes}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => setEditTask(task)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => void handleDelete(task)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}

          {done.length > 0 && (
            <div className="space-y-1.5 border-t border-border pt-2">
              {done.map((task) => (
                <div key={task._id} className="flex items-start gap-3 rounded-lg border border-border bg-card/70 p-3 opacity-75">
                  <button onClick={() => void handleToggle(task)} className="mt-0.5 shrink-0 text-primary cursor-pointer transition-colors">
                    <CheckCircle2 className="size-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-through text-muted-foreground">{task.title}</p>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span className={cn("rounded-full px-1.5 py-0.5 font-medium", PRIORITY_CLASSES[task.priority])}>
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                      <span className="flex items-center gap-1"><CalendarClock className="size-3" />{task.dueDate}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => setEditTask(task)}><Pencil className="size-3.5" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => void handleDelete(task)}><Trash2 className="size-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add task</DialogTitle>
          </DialogHeader>
          <TaskForm defaultValues={{ title: "", dueDate: today(), priority: "medium", notes: "" }} onSubmit={handleCreate} onCancel={() => setAddOpen(false)} saving={saving} />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editTask)} onOpenChange={(openState) => !openState && setEditTask(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
          </DialogHeader>
          {editTask && (
            <TaskForm
              defaultValues={{
                title: editTask.title,
                dueDate: editTask.dueDate,
                priority: editTask.priority,
                notes: editTask.notes ?? "",
              }}
              onSubmit={handleUpdate}
              onCancel={() => setEditTask(null)}
              saving={saving}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TaskList({ linkedType, linkedId, linkedName }: Props) {
  if (migrationApiEnabled) return <MigrationTaskList linkedType={linkedType} linkedId={linkedId} linkedName={linkedName} />;

  const [addOpen, setAddOpen] = useState(false);
  const [editTask, setEditTask] = useState<Doc<"crmTasks"> | null>(null);
  const [saving, setSaving] = useState(false);

  const tasks = useQuery(api.crm.listTasksForEntity, { linkedType, linkedId });
  const createTask = useMutation(api.crm.createTask);
  const updateTask = useMutation(api.crm.updateTask);
  const completeTask = useMutation(api.crm.completeTask);
  const reopenTask = useMutation(api.crm.reopenTask);
  const deleteTask = useMutation(api.crm.deleteTask);

  const open = tasks?.filter((t) => t.status === "open") ?? [];
  const done = tasks?.filter((t) => t.status === "done") ?? [];

  const handleCreate = async (data: FormData) => {
    setSaving(true);
    try {
      await createTask({ linkedType, linkedId, linkedName, ...data });
      setAddOpen(false);
      toast.success("Task created");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: FormData) => {
    if (!editTask) return;
    setSaving(true);
    try {
      await updateTask({ taskId: editTask._id, ...data });
      setEditTask(null);
      toast.success("Task updated");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Failed to update task");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (task: Doc<"crmTasks">) => {
    try {
      if (task.status === "open") {
        await completeTask({ taskId: task._id });
        toast.success("Task completed");
      } else {
        await reopenTask({ taskId: task._id });
      }
    } catch {
      toast.error("Could not update task");
    }
  };

  const handleDelete = async (task: Doc<"crmTasks">) => {
    try {
      await deleteTask({ taskId: task._id });
      toast.success("Task deleted");
    } catch {
      toast.error("Could not delete task");
    }
  };

  const isOverdue = (t: Doc<"crmTasks">) => t.status === "open" && t.dueDate < today();

  if (tasks === undefined) return <Skeleton className="h-20 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {open.length} open task{open.length !== 1 ? "s" : ""}
          {open.length > 0 && tasks.some(isOverdue) && (
            <span className="ml-1 text-destructive">· {tasks.filter(isOverdue).length} overdue</span>
          )}
        </p>
        <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" /> Add task
        </Button>
      </div>

      {open.length === 0 && done.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted-foreground">No tasks yet. Add one above.</p>
      ) : (
        <div className="space-y-1.5">
          {open.map((task) => (
            <div
              key={task._id}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                isOverdue(task) ? "border-destructive/40 bg-destructive/5" : "border-border bg-card",
              )}
            >
              <button
                onClick={() => void handleToggle(task)}
                className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary cursor-pointer transition-colors"
              >
                <Circle className="size-4" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{task.title}</p>
                <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span className={cn("rounded-full px-1.5 py-0.5 font-medium", PRIORITY_CLASSES[task.priority])}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                  <span className={cn("flex items-center gap-1", isOverdue(task) && "text-destructive font-medium")}>
                    <CalendarClock className="size-3" />
                    {task.dueDate}
                    {isOverdue(task) && " (overdue)"}
                  </span>
                </div>
                {task.notes && <p className="mt-1 text-xs text-muted-foreground">{task.notes}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditTask(task)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => void handleDelete(task)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}

          {done.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-muted-foreground py-1 select-none">
                {done.length} completed task{done.length !== 1 ? "s" : ""}
              </summary>
              <div className="mt-1 space-y-1.5">
                {done.map((task) => (
                  <div key={task._id} className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 opacity-60">
                    <button
                      onClick={() => void handleToggle(task)}
                      className="mt-0.5 shrink-0 text-primary cursor-pointer"
                    >
                      <CheckCircle2 className="size-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-through text-muted-foreground">{task.title}</p>
                      {task.completedAt && (
                        <p className="text-xs text-muted-foreground">
                          Done {new Date(task.completedAt).toLocaleDateString("en-IN")}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => void handleDelete(task)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Add task dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add task{linkedName ? ` for ${linkedName}` : ""}</DialogTitle>
          </DialogHeader>
          <TaskForm
            defaultValues={{}}
            onSubmit={handleCreate}
            onCancel={() => setAddOpen(false)}
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      {/* Edit task dialog */}
      <Dialog open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
          </DialogHeader>
          {editTask && (
            <TaskForm
              defaultValues={{
                title: editTask.title,
                dueDate: editTask.dueDate,
                priority: editTask.priority,
                notes: editTask.notes,
              }}
              onSubmit={handleUpdate}
              onCancel={() => setEditTask(null)}
              saving={saving}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
