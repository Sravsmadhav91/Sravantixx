import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { MessageSquarePlus, Phone, CalendarDays, Mail, MoreHorizontal, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_ICONS } from "@/lib/crm.ts";
import { formatDateTime } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";

type ActivityType = Doc<"crmActivities">["activityType"];

const QUICK_TYPES: { type: ActivityType; icon: typeof Phone; label: string }[] = [
  { type: "note", icon: MessageSquarePlus, label: "Note" },
  { type: "call", icon: Phone, label: "Call" },
  { type: "meeting", icon: CalendarDays, label: "Meeting" },
  { type: "email", icon: Mail, label: "Email" },
];

type LinkedType = "buyer" | "lead" | "booking";

type Props = {
  linkedType: LinkedType;
  linkedId: string;
};

export default function ActivityTimeline({ linkedType, linkedId }: Props) {
  const [selectedType, setSelectedType] = useState<ActivityType>("note");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const activities = useQuery(api.crm.listActivities, { linkedType, linkedId });
  const addActivity = useMutation(api.crm.addActivity);
  const deleteActivity = useMutation(api.crm.deleteActivity);

  const handleAdd = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await addActivity({ linkedType, linkedId, activityType: selectedType, note: note.trim() });
      setNote("");
      toast.success("Activity logged");
    } catch (err) {
      toast.error(
        err instanceof ConvexError ? (err.data as { message: string }).message : "Could not log activity",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: Doc<"crmActivities">["_id"]) => {
    try {
      await deleteActivity({ activityId: id });
      toast.success("Activity removed");
    } catch {
      toast.error("Could not remove activity");
    }
  };

  return (
    <div className="space-y-4">
      {/* Add new activity */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TYPES.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                selectedType === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <Textarea
          placeholder={`Add a ${ACTIVITY_TYPE_LABELS[selectedType].toLowerCase()}…`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="resize-none"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleAdd} disabled={saving || !note.trim()}>
            {saving ? "Saving…" : "Log activity"}
          </Button>
        </div>
      </div>

      {/* Timeline */}
      {activities === undefined ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : activities.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="relative space-y-1 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-border">
          {activities.map((a) => (
            <div key={a._id} className="group relative flex gap-3 pl-10">
              {/* Dot */}
              <span className="absolute left-[9px] top-[14px] size-3 rounded-full border-2 border-primary bg-background" />
              <div className="flex-1 min-w-0 rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="text-base leading-none">{ACTIVITY_TYPE_ICONS[a.activityType]}</span>
                    <span>{ACTIVITY_TYPE_LABELS[a.activityType]}</span>
                    {a.createdByName && (
                      <span className="text-xs font-normal text-muted-foreground">· {a.createdByName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(new Date(a._creationTime).toISOString())}
                    </span>
                    {/* Only show delete on non-system activities */}
                    {["note", "call", "meeting", "email"].includes(a.activityType) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="cursor-pointer text-destructive focus:text-destructive"
                            onClick={() => void handleDelete(a._id)}
                          >
                            <Trash2 className="size-3.5 mr-1.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{a.note}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
