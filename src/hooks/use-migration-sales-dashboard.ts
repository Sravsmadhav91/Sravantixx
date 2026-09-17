import { useEffect, useState } from "react";
import { getMigrationSalesDashboard, type MigrationSalesDashboard } from "@/lib/migration-api.ts";

export function useMigrationSalesDashboard(options: { projectId: string; fromDate: string; toDate: string }) {
  const [data, setData] = useState<MigrationSalesDashboard | undefined>();
  useEffect(() => { let active = true; setData(undefined); getMigrationSalesDashboard(options).then((value) => active && setData(value)).catch(() => active && setData(undefined)); return () => { active = false; }; }, [options.projectId, options.fromDate, options.toDate]);
  return data;
}