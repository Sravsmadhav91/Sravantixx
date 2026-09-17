import { useEffect, useState } from "react";
import { migrationGet } from "@/lib/migration-api.ts";

export type MigrationStockItem = {
  _id: string;
  ownerId: string;
  sku: string;
  name: string;
  unit: string;
  category?: string;
  reorderLevel?: number;
  notes?: string;
  isActive?: boolean;
  totalQuantity?: number;
  totalValue?: number;
  isLowStock?: boolean;
};

export type MigrationStockGodown = {
  _id: string;
  ownerId: string;
  name: string;
  address?: string;
  isActive?: boolean;
};

export type MigrationStockMovement = {
  _id: string;
  ownerId: string;
  stockItemId: string;
  godownId: string;
  quantity: number;
  value: number;
  movementType?: string;
  reason?: string;
  createdAt?: string;
};

export type MigrationStockBalance = {
  _id: string;
  ownerId: string;
  stockItemId: string;
  godownId: string;
  quantity: number;
  value: number;
};

export type MigrationInventorySummary = {
  itemCount: number;
  godownCount: number;
  totalValue: number;
  lowStockCount: number;
};

export function useMigrationInventory() {
  const [items, setItems] = useState<MigrationStockItem[] | undefined>();
  const [godowns, setGodowns] = useState<MigrationStockGodown[] | undefined>();
  const [movements, setMovements] = useState<MigrationStockMovement[] | undefined>();
  const [valuation, setValuation] = useState<MigrationInventorySummary | undefined>();
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const ownerId = import.meta.env.VITE_MIGRATION_OWNER_ID;
    if (!ownerId) {
      setError(new Error("VITE_MIGRATION_OWNER_ID is required for migration inventory"));
      return;
    }

    Promise.all([
      migrationGet<MigrationStockItem[]>("/api/tables/stockItems/records"),
      migrationGet<MigrationStockGodown[]>("/api/tables/stockGodowns/records"),
      migrationGet<MigrationStockMovement[]>("/api/tables/stockMovements/records"),
      migrationGet<MigrationStockBalance[]>("/api/tables/stockBalances/records"),
    ])
      .then(([rawItems, rawGodowns, rawMovements, rawBalances]) => {
        if (!active) return;

        const filteredItems = rawItems.filter((item) => item.ownerId === ownerId);
        const filteredGodowns = rawGodowns.filter((godown) => godown.ownerId === ownerId);
        const filteredMovements = rawMovements.filter((movement) => movement.ownerId === ownerId);
        const totalsByItem = new Map<string, { quantity: number; value: number }>();
        for (const balance of rawBalances.filter((b) => b.ownerId === ownerId)) {
          const current = totalsByItem.get(balance.stockItemId) ?? { quantity: 0, value: 0 };
          current.quantity += Number(balance.quantity || 0);
          current.value += Number(balance.value || 0);
          totalsByItem.set(balance.stockItemId, current);
        }

        const normalizedItems = filteredItems.map((item) => {
          const totals = totalsByItem.get(item._id) ?? { quantity: 0, value: 0 };
          return {
            ...item,
            totalQuantity: totals.quantity,
            totalValue: totals.value,
            isLowStock: item.reorderLevel != null && totals.quantity < item.reorderLevel,
          } satisfies MigrationStockItem;
        });

        const lowStockCount = normalizedItems.filter((item) => item.isLowStock).length;
        setItems(normalizedItems.sort((a, b) => a.name.localeCompare(b.name)));
        setGodowns(filteredGodowns.sort((a, b) => a.name.localeCompare(b.name)));
        setMovements(filteredMovements.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))));
        setValuation({
          itemCount: normalizedItems.filter((item) => item.isActive !== false).length,
          godownCount: filteredGodowns.filter((godown) => godown.isActive !== false).length,
          totalValue: normalizedItems.reduce((sum, item) => sum + (item.totalValue ?? 0), 0),
          lowStockCount,
        });
      })
      .catch((value: unknown) => {
        if (active) {
          setError(value instanceof Error ? value : new Error("Could not load inventory"));
          setItems([]);
          setGodowns([]);
          setMovements([]);
          setValuation({ itemCount: 0, godownCount: 0, totalValue: 0, lowStockCount: 0 });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return { items, godowns, movements, valuation, error };
}
