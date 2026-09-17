import { useEffect, useState } from "react";
import { migrationGet } from "@/lib/migration-api.ts";

export type MigrationEmployee = {
  _id: string;
  ownerId: string;
  name: string;
  employeeCode: string;
  designation?: string;
  basic: number;
  hra: number;
  conveyance: number;
  specialAllowance: number;
  otherAllowances: number;
  pfApplicable?: boolean;
  esiApplicable?: boolean;
  isActive?: boolean;
};

export type MigrationPayrollRun = {
  _id: string;
  ownerId: string;
  month: string;
  totalNetPay: number;
  finalizedDate?: string;
  status?: string;
};

export function useMigrationPayroll() {
  const [employees, setEmployees] = useState<MigrationEmployee[] | undefined>();
  const [runs, setRuns] = useState<MigrationPayrollRun[] | undefined>();
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const ownerId = import.meta.env.VITE_MIGRATION_OWNER_ID;
    if (!ownerId) {
      setError(new Error("VITE_MIGRATION_OWNER_ID is required for migration payroll"));
      return;
    }

    Promise.all([
      migrationGet<MigrationEmployee[]>("/api/tables/employees/records"),
      migrationGet<MigrationPayrollRun[]>("/api/tables/payrollRuns/records"),
    ])
      .then(([allEmployees, allRuns]) => {
        if (!active) return;
        const filteredEmployees = allEmployees.filter((employee) => employee.ownerId === ownerId);
        const filteredRuns = allRuns.filter((run) => run.ownerId === ownerId);
        setEmployees(filteredEmployees.sort((a, b) => a.name.localeCompare(b.name)));
        setRuns(filteredRuns.sort((a, b) => String(b.month || "").localeCompare(String(a.month || ""))));
      })
      .catch((value: unknown) => {
        if (active) {
          setError(value instanceof Error ? value : new Error("Could not load payroll"));
          setEmployees([]);
          setRuns([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return { employees, runs, error };
}
