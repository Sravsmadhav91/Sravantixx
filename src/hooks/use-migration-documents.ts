import { useEffect, useState } from "react";
import { listMigrationDocuments, type MigrationDocument } from "@/lib/migration-api.ts";

export type { MigrationDocument };

export function useMigrationDocuments(search?: string, docType?: string) {
  const [docs, setDocs] = useState<MigrationDocument[] | undefined>();
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;

    listMigrationDocuments({ search, docType })
      .then((filtered) => {
        if (active) setDocs(filtered);
      })
      .catch((value: unknown) => {
        if (active) {
          setError(value instanceof Error ? value : new Error("Could not load migration documents"));
          setDocs([]);
        }
      });

    return () => {
      active = false;
    };
  }, [search, docType]);

  return { docs, error };
}
