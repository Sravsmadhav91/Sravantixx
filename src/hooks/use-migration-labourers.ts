import { useEffect, useState } from "react";
import { migrationGet } from "@/lib/migration-api.ts";

export type MigrationLabourer = { _id: string; name: string; type: "individual" | "group"; memberCount: number; phone?: string; skill?: string; pan?: string; projectName?: string; balance: number; isActive: boolean };

export function useMigrationLabourers() {
  const [labourers, setLabourers] = useState<MigrationLabourer[] | undefined>();
  useEffect(() => { let active = true; migrationGet<MigrationLabourer[]>("/api/labourers").then((value) => active && setLabourers(value)).catch(() => active && setLabourers([])); return () => { active = false; }; }, []);
  return labourers;
}