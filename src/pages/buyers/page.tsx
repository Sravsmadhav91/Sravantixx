import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { Plus, Users } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { useMigrationBuyers } from "@/hooks/use-migration-buyers.ts";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import LoadMoreButton from "@/components/load-more-button.tsx";
import BuyerFormDialog from "./_components/buyer-form-dialog.tsx";
import BuyerCard from "./_components/buyer-card.tsx";
import MigrationBuyerFormDialog from "./_components/migration-buyer-form-dialog.tsx";

const PAGE_SIZE = 24;

export default function BuyersPage() {
  if (migrationApiEnabled) return <MigrationBuyersPage />;
  return <ConvexBuyersPage />;
}

function MigrationBuyersPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [debouncedSearch] = useDebounce(search, 300);
  const buyers = useMigrationBuyers(debouncedSearch.trim());
  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8"><div className="flex flex-wrap items-end justify-between gap-4"><div className="space-y-1"><h1 className="font-serif text-3xl font-semibold tracking-tight">Buyers</h1><p className="text-sm text-muted-foreground">Contacts you are selling to.</p></div><Button onClick={() => setDialogOpen(true)}><Plus className="size-4" />Add buyer</Button></div><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name..." className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm" />{buyers === undefined ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}</div> : buyers.length === 0 ? <Empty><EmptyHeader><EmptyMedia variant="icon"><Users /></EmptyMedia><EmptyTitle>{debouncedSearch ? "No buyers found" : "No buyers yet"}</EmptyTitle></EmptyHeader></Empty> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{buyers.map((buyer) => <BuyerCard key={buyer._id} buyer={buyer} readOnly migrationMode />)}</div>}<MigrationBuyerFormDialog open={dialogOpen} onOpenChange={setDialogOpen} /></div>;
}

function ConvexBuyersPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);

  const {
    results: buyers,
    status,
    loadMore,
    isLoading,
  } = usePaginatedQuery(
    api.buyers.listPaginated,
    { search: debouncedSearch.trim() || undefined },
    { initialNumItems: PAGE_SIZE },
  );
  const migrationBuyers = useMigrationBuyers(debouncedSearch.trim());
  const displayedBuyers = migrationApiEnabled ? migrationBuyers ?? [] : buyers;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Buyers
          </h1>
          <p className="text-sm text-muted-foreground">
            Contacts you are selling to.
          </p>
        </div>
        {!migrationApiEnabled && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Add buyer
          </Button>
        )}
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name…"
        className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {(migrationApiEnabled ? migrationBuyers === undefined : status === "LoadingFirstPage") ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : displayedBuyers.length === 0 && !isLoading ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>
              {debouncedSearch ? "No buyers found" : "No buyers yet"}
            </EmptyTitle>
            <EmptyDescription>
              {debouncedSearch
                ? "Try a different name."
                : "Add a buyer before you book a unit."}
            </EmptyDescription>
          </EmptyHeader>
          {!debouncedSearch && !migrationApiEnabled && (
            <EmptyContent>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                Add buyer
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {displayedBuyers.map((buyer) => (
              <BuyerCard key={buyer._id} buyer={buyer} readOnly={migrationApiEnabled} />
            ))}
          </div>
          {!migrationApiEnabled && <LoadMoreButton status={status} onLoadMore={() => loadMore(PAGE_SIZE)} pageSize={PAGE_SIZE} />}
        </>
      )}

      {!migrationApiEnabled && <BuyerFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />}
    </div>
  );
}
