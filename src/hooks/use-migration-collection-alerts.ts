import { useEffect, useState } from "react";
import { getMigrationCollectionAlerts, type MigrationInstallmentAlert } from "@/lib/migration-api.ts";

export function useMigrationCollectionAlerts() {
  const [alerts, setAlerts] = useState<{ overdue: MigrationInstallmentAlert[]; upcoming: MigrationInstallmentAlert[] } | undefined>();

  useEffect(() => {
    let active = true;
    getMigrationCollectionAlerts()
      .then((value) => active && setAlerts(value))
      .catch(() => active && setAlerts({ overdue: [], upcoming: [] }));
    return () => {
      active = false;
    };
  }, []);

  return alerts;
}