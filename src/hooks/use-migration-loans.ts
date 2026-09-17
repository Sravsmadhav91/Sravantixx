import { useEffect, useState } from "react";
import { migrationGet } from "@/lib/migration-api.ts";

export type MigrationLoan = {
  _id: string;
  ownerId: string;
  lenderName: string;
  principal: number;
  outstandingPrincipal: number;
  interestRatePercent: number;
  tenureMonths: number;
  emiFrequency?: string;
  emiAmount: number;
  status?: string;
  projectName?: string;
};

export function useMigrationLoans() {
  const [loans, setLoans] = useState<MigrationLoan[] | undefined>();
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const ownerId = import.meta.env.VITE_MIGRATION_OWNER_ID;
    if (!ownerId) {
      setError(new Error("VITE_MIGRATION_OWNER_ID is required for migration loans"));
      return;
    }

    migrationGet<MigrationLoan[]>("/api/tables/loans/records")
      .then((allLoans) => {
        if (!active) return;
        const filteredLoans = allLoans.filter((loan) => loan.ownerId === ownerId);
        setLoans(filteredLoans.sort((a, b) => a.lenderName.localeCompare(b.lenderName)));
      })
      .catch((value: unknown) => {
        if (active) {
          setError(value instanceof Error ? value : new Error("Could not load loans"));
          setLoans([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return { loans, error };
}
