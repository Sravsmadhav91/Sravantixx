import { useEffect, useState } from "react";
import { migrationGet } from "@/lib/migration-api.ts";

export type MigrationDocument = {
  _id: string;
  ownerId: string;
  linkedType?: string;
  linkedId?: string;
  linkedName?: string;
  storageId?: string;
  fileName: string;
  contentType?: string;
  size?: number;
  docType?: string;
  label?: string;
  notes?: string;
  uploadedAt?: string;
};

export function useMigrationDocuments(search?: string, docType?: string) {
  const [docs, setDocs] = useState<MigrationDocument[] | undefined>();
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const ownerId = import.meta.env.VITE_MIGRATION_OWNER_ID;
    if (!ownerId) {
      setError(new Error("VITE_MIGRATION_OWNER_ID is required for migration documents"));
      return;
    }

    migrationGet<MigrationDocument[]>("/api/tables/documents/records")
      .then((rawDocs) => {
        if (!active) return;

        const query = search?.trim().toLowerCase();
        const filtered = rawDocs
          .filter((doc) => doc.ownerId === ownerId)
          .filter((doc) => (docType ? doc.docType === docType : true))
          .filter((doc) => {
            if (!query) return true;
            const haystack = `${doc.label ?? doc.fileName ?? ""} ${doc.linkedName ?? ""}`.toLowerCase();
            return haystack.includes(query);
          })
          .sort((a, b) => String(b.uploadedAt ?? "").localeCompare(String(a.uploadedAt ?? "")));

        setDocs(filtered);
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
