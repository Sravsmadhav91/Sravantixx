import { useEffect, useState } from "react";
import { migrationGet } from "@/lib/migration-api.ts";

export type MigrationTask = {
  _id: string;
  ownerId: string;
  linkedType: "buyer" | "lead" | "booking";
  linkedId: string;
  linkedName?: string;
  title: string;
  dueDate: string;
  priority: "low" | "medium" | "high";
  status: "open" | "done";
  completedAt?: string;
  notes?: string;
};

export function useMigrationTasks(showDone: boolean) {
  const [tasks, setTasks] = useState<MigrationTask[] | undefined>();
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const ownerId = import.meta.env.VITE_MIGRATION_OWNER_ID;
    if (!ownerId) {
      setError(new Error("VITE_MIGRATION_OWNER_ID is required for migration tasks"));
      return;
    }

    migrationGet<MigrationTask[]>("/api/tables/crmTasks/records")
      .then((rawTasks) => {
        if (!active) return;
        const filtered = rawTasks
          .filter((task) => task.ownerId === ownerId)
          .filter((task) => task.status === (showDone ? "done" : "open"))
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        setTasks(filtered);
      })
      .catch((value: unknown) => {
        if (active) {
          setError(value instanceof Error ? value : new Error("Could not load migration tasks"));
          setTasks([]);
        }
      });

    return () => {
      active = false;
    };
  }, [showDone]);

  return { tasks, error };
}
