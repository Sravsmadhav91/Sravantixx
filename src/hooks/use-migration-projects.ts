import { useEffect, useState } from "react";
import {
  listMigrationProjects,
  type MigrationProject,
} from "@/lib/migration-api.ts";

export function useMigrationProjects() {
  const [projects, setProjects] = useState<MigrationProject[] | undefined>();
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    listMigrationProjects()
      .then((value) => {
        if (active) setProjects(value);
      })
      .catch((value: unknown) => {
        if (active) setError(value instanceof Error ? value : new Error("Could not load projects"));
      });
    return () => {
      active = false;
    };
  }, []);

  return { projects, error };
}