import { useEffect, useState } from "react";
import { migrationGet } from "@/lib/migration-api.ts";

export type MigrationSubcontract = {
  _id: string;
  ownerId: string;
  projectId: string;
  vendorId: string;
  title: string;
  contractValue: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
  isActive?: boolean;
  vendorName?: string;
  vendorPan?: string | null;
  projectName?: string;
  paidAmount: number;
  balance: number;
};

export type MigrationSubcontractDetail = {
  contract: MigrationSubcontract;
  vendor?: { name: string; pan?: string | null };
  project?: { name: string };
  invoices: Array<{ _id: string; internalRef?: string; date?: string; total: number; linkId: string }>;
  paidAmount: number;
  balance: number;
};

export function useMigrationSubcontracts() {
  const [contracts, setContracts] = useState<MigrationSubcontract[] | undefined>();
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const ownerId = import.meta.env.VITE_MIGRATION_OWNER_ID;
    if (!ownerId) {
      setError(new Error("VITE_MIGRATION_OWNER_ID is required for migration subcontracts"));
      return;
    }

    Promise.all([
      migrationGet<Array<{ _id: string; ownerId: string; projectId: string; vendorId: string; title: string; contractValue: number; startDate?: string; endDate?: string; notes?: string; isActive?: boolean }>>("/api/tables/subcontracts/records"),
      migrationGet<Array<{ _id: string; ownerId: string; name: string; pan?: string | null }>>("/api/tables/vendors/records"),
      migrationGet<Array<{ _id: string; ownerId: string; name: string }>>("/api/tables/projects/records"),
      migrationGet<Array<{ _id: string; ownerId: string; subcontractId: string; purchaseInvoiceId: string }>>("/api/tables/subcontractInvoices/records"),
      migrationGet<Array<{ _id: string; ownerId: string; vendorId: string; internalRef?: string; date?: string; amountPaid?: number; total?: number; status?: string }>>("/api/tables/purchaseInvoices/records"),
    ])
      .then(([rawContracts, vendors, projects, links, invoices]) => {
        if (!active) return;

        const filteredContracts = rawContracts.filter((contract) => contract.ownerId === ownerId);
        const vendorMap = new Map(vendors.filter((vendor) => vendor.ownerId === ownerId).map((vendor) => [vendor._id, vendor]));
        const projectMap = new Map(projects.filter((project) => project.ownerId === ownerId).map((project) => [project._id, project]));

        const mapped = filteredContracts.map((contract) => {
          const vendor = vendorMap.get(contract.vendorId);
          const project = projectMap.get(contract.projectId);
          const matchingLinks = links.filter((link) => link.ownerId === ownerId && link.subcontractId === contract._id);
          const paidAmount = matchingLinks.reduce((sum, link) => {
            const invoice = invoices.find((item) => item.ownerId === ownerId && item._id === link.purchaseInvoiceId && item.status !== "cancelled");
            return sum + Number(invoice?.amountPaid ?? 0);
          }, 0);
          const balance = Number(contract.contractValue ?? 0) - paidAmount;

          return {
            ...contract,
            vendorName: vendor?.name ?? "Unknown",
            vendorPan: vendor?.pan ?? null,
            projectName: project?.name ?? "Unknown",
            paidAmount,
            balance,
          } satisfies MigrationSubcontract;
        });

        setContracts(mapped.sort((a, b) => Number(b._id?.slice(0, 10) || 0) - Number(a._id?.slice(0, 10) || 0)));
      })
      .catch((value: unknown) => {
        if (active) {
          setError(value instanceof Error ? value : new Error("Could not load subcontracts"));
          setContracts([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return { contracts, error };
}
