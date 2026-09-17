import { useEffect, useState } from "react";
import { listMigrationBuyers } from "@/lib/migration-api.ts";
import type { Doc } from "@/convex/_generated/dataModel";

export function useMigrationBuyers(search: string) {
  const [buyers, setBuyers] = useState<Doc<"buyers">[] | undefined>();

  useEffect(() => {
    let active = true;
    setBuyers(undefined);
    listMigrationBuyers(search)
      .then((value) => active && setBuyers(value))
      .catch(() => active && setBuyers([]));
    return () => {
      active = false;
    };
  }, [search]);

  return buyers;
}