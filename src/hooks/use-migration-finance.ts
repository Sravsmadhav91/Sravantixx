import { useEffect, useState } from "react";
import { migrationGet } from "@/lib/migration-api.ts";

export function useMigrationFinance<T>(path: string) {
  const [data, setData] = useState<T | undefined>();
  useEffect(() => { let active = true; migrationGet<T>(path).then((value) => active && setData(value)).catch(() => active && setData(undefined)); return () => { active = false; }; }, [path]);
  return data;
}