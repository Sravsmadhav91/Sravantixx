import { useEffect, useState } from "react";
import {
  getMigrationCollectionsDashboard,
  type MigrationCollectionsDashboard,
} from "@/lib/migration-api.ts";

export function useMigrationCollectionsDashboard(options: { projectId: string; fromDate: string; toDate: string }) {
  const [data, setData] = useState<MigrationCollectionsDashboard | undefined>();

  useEffect(() => {
    let active = true;
    setData(undefined);
    getMigrationCollectionsDashboard(options)
      .then((value) => active && setData(value))
      .catch(() => active && setData(undefined));
    return () => {
      active = false;
    };
  }, [options.projectId, options.fromDate, options.toDate]);

  return data;
}