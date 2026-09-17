import { useEffect, useState } from "react";
import {
  getMigrationProject,
  listMigrationUnits,
  type MigrationProject,
} from "@/lib/migration-api.ts";
import type { UnitWithBuyer } from "@/convex/units.ts";

export function useMigrationProjectDetail(projectId: string | undefined) {
  const [project, setProject] = useState<MigrationProject | null | undefined>();
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setProject(undefined);
    setError(null);
    getMigrationProject(projectId)
      .then((value) => active && setProject(value))
      .catch((value: unknown) => {
        if (active) {
          setError(value instanceof Error ? value : new Error("Could not load project"));
          setProject(null);
        }
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  return { project, error };
}

export function useMigrationUnits(projectId: string | undefined, status: string) {
  const [units, setUnits] = useState<UnitWithBuyer[] | undefined>();
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setUnits(undefined);
    setError(null);
    listMigrationUnits(projectId, status)
      .then((value) => active && setUnits(value))
      .catch((value: unknown) => {
        if (!active) return;
        setError(value instanceof Error ? value : new Error("Could not load units"));
        setUnits([]);
      });
    return () => {
      active = false;
    };
  }, [projectId, status]);

  return { units, error };
}