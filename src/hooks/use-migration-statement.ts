import { useEffect, useState } from "react";
import { getMigrationStatement, type MigrationStatement } from "@/lib/migration-api.ts";

export function useMigrationStatement(bookingId: string | undefined) {
  const [statement, setStatement] = useState<MigrationStatement | undefined>();

  useEffect(() => {
    if (!bookingId) return;
    let active = true;
    setStatement(undefined);
    getMigrationStatement(bookingId)
      .then((value) => active && setStatement(value))
      .catch(() => active && setStatement(undefined));
    return () => {
      active = false;
    };
  }, [bookingId]);

  return statement;
}