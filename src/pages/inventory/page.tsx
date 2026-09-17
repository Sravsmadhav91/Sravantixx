import { useState } from "react";
import { useQuery, useMutation, Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import {
  Boxes,
  Warehouse,
  ArrowLeftRight,
  Wallet,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Package,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { SignInButton } from "@/components/ui/signin.tsx";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { useRole } from "@/hooks/use-role.ts";
import { useMigrationInventory } from "@/hooks/use-migration-inventory.ts";
import { cn } from "@/lib/utils.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import { MOVEMENT_TYPE_LABELS, MOVEMENT_TYPE_COLORS } from "@/lib/inventory.ts";
import ItemFormDialog from "./_components/item-form-dialog.tsx";
import GodownFormDialog from "./_components/godown-form-dialog.tsx";
import StockMovementDialog from "./_components/stock-movement-dialog.tsx";
import MigrationItemDialog from "./_components/migration-item-dialog.tsx";
import MigrationGodownDialog from "./_components/migration-godown-dialog.tsx";

export default function InventoryPage() {
  if (migrationApiEnabled) {
    return <MigrationInventoryPage />;
  }
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Inventory & Stock"
        subtitle="Materials, godowns, and stock movements with moving-average valuation"
        breadcrumbs={[{ label: "Inventory" }]}
      />
      <AuthLoading>
        <Skeleton className="h-64 w-full" />
      </AuthLoading>
      <Unauthenticated>
        <SignInButton />
      </Unauthenticated>
      <Authenticated>
        <InventoryInner />
      </Authenticated>
    </div>
  );
}

function MigrationInventoryPage() {
  const [itemDialog, setItemDialog] = useState(false);
  const [godownDialog, setGodownDialog] = useState(false);
  return (
    <>
      <MigrationInventoryContent />
      <Button className="fixed bottom-6 right-6 z-20 shadow-lg" onClick={() => setItemDialog(true)}>
        <Plus className="size-4" /> New Item
      </Button>
      <Button className="fixed bottom-6 right-44 z-20 shadow-lg" variant="secondary" onClick={() => setGodownDialog(true)}>
        <Plus className="size-4" /> New Godown
      </Button>
      <MigrationItemDialog open={itemDialog} onOpenChange={setItemDialog} />
      <MigrationGodownDialog open={godownDialog} onOpenChange={setGodownDialog} />
    </>
  );
}

function MigrationInventoryContent() {
  const { items, godowns, movements, valuation, error } = useMigrationInventory();

  if (error) {
    return <div className="p-8 text-sm text-destructive">{error.message}</div>;
  }

  if (items === undefined || godowns === undefined || movements === undefined || valuation === undefined) {
    return <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-8"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader title="Inventory & Stock" subtitle="Materials, godowns, and stock movements with moving-average valuation" breadcrumbs={[{ label: "Inventory" }]} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Active Items", value: String(valuation.itemCount), color: "text-foreground" },
          { label: "Godowns", value: String(valuation.godownCount), color: "text-foreground" },
          { label: "Stock Value", value: formatCompactInr(valuation.totalValue), color: "text-primary" },
          { label: "Low Stock Alerts", value: String(valuation.lowStockCount), color: valuation.lowStockCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">{stat.label}</p><p className={cn("mt-0.5 text-xl font-bold tabular-nums", stat.color)}>{stat.value}</p></div>
        ))}
      </div>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium uppercase text-muted-foreground"><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Category</th><th className="px-3 py-2 text-right">In Stock</th><th className="px-3 py-2 text-right">Value</th><th className="px-3 py-2">Status</th></tr></thead><tbody className="divide-y">{items.map((item) => <tr key={item._id} className="hover:bg-muted/30"><td className="px-3 py-2 font-mono text-xs text-muted-foreground">{item.sku}</td><td className="px-3 py-2 font-medium">{item.name}</td><td className="px-3 py-2 text-xs text-muted-foreground">{item.category ?? "—"}</td><td className="px-3 py-2 text-right tabular-nums text-xs">{item.totalQuantity ?? 0} {item.unit}{item.isLowStock && <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400"><AlertTriangle className="size-3" /></span>}</td><td className="px-3 py-2 text-right tabular-nums text-xs font-semibold">{formatCompactInr(item.totalValue ?? 0)}</td><td className="px-3 py-2">{item.isActive === false ? <Badge variant="secondary" className="text-xs">Inactive</Badge> : <span className="text-xs text-muted-foreground">Active</span>}</td></tr>)}</tbody></table>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4"><h3 className="text-sm font-semibold">Godowns</h3><div className="mt-3 space-y-2">{godowns.length === 0 ? <p className="text-sm text-muted-foreground">No godowns yet.</p> : godowns.map((godown) => <div key={godown._id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm"><span>{godown.name}</span><span className={cn("text-xs", godown.isActive === false ? "text-muted-foreground" : "text-primary")}>{godown.isActive === false ? "Inactive" : "Active"}</span></div>)}</div></div>
        <div className="rounded-lg border bg-card p-4"><h3 className="text-sm font-semibold">Recent movements</h3><div className="mt-3 space-y-2">{movements.length === 0 ? <p className="text-sm text-muted-foreground">No movements yet.</p> : movements.slice(0, 6).map((movement) => <div key={movement._id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm"><span>{movement.movementType ?? "Stock"}</span><span className="tabular-nums">{movement.quantity}</span></div>)}</div></div>
      </div>
    </div>
  );
}

function InventoryInner() {
  const { isOwner } = useRole();
  const [tab, setTab] = useState<"items" | "godowns" | "movements" | "valuation">("items");

  const [itemDialog, setItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<Doc<"stockItems"> | undefined>();
  const [godownDialog, setGodownDialog] = useState(false);
  const [editingGodown, setEditingGodown] = useState<Doc<"stockGodowns"> | undefined>();
  const [movementDialog, setMovementDialog] = useState(false);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<Id<"stockItems"> | null>(null);
  const [confirmDeleteGodown, setConfirmDeleteGodown] = useState<Id<"stockGodowns"> | null>(null);

  const items = useQuery(api.inventory.listItems, {});
  const godowns = useQuery(api.inventory.listGodowns, {});
  const movements = useQuery(api.inventory.listMovements, {});
  const valuation = useQuery(api.inventory.getStockValuation, {});

  const updateItem = useMutation(api.inventory.updateItem);
  const deleteItem = useMutation(api.inventory.deleteItem);
  const updateGodown = useMutation(api.inventory.updateGodown);
  const deleteGodown = useMutation(api.inventory.deleteGodown);

  return (
    <>
      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active Items", value: String(valuation?.itemCount ?? "—"), color: "text-foreground" },
          { label: "Godowns", value: String(godowns?.filter((g) => g.isActive).length ?? "—"), color: "text-foreground" },
          { label: "Stock Value", value: valuation ? formatCompactInr(valuation.totalValue) : "—", color: "text-primary" },
          { label: "Low Stock Alerts", value: String(valuation?.lowStockCount ?? "—"), color: (valuation?.lowStockCount ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={cn("text-xl font-bold tabular-nums mt-0.5", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="items"><Boxes className="size-3.5" /> Items</TabsTrigger>
            <TabsTrigger value="godowns"><Warehouse className="size-3.5" /> Godowns</TabsTrigger>
            <TabsTrigger value="movements"><ArrowLeftRight className="size-3.5" /> Movements</TabsTrigger>
            <TabsTrigger value="valuation"><Wallet className="size-3.5" /> Valuation</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {tab === "items" && (
              <Button size="sm" onClick={() => { setEditingItem(undefined); setItemDialog(true); }}>
                <Plus className="size-4" /> New Item
              </Button>
            )}
            {tab === "godowns" && (
              <Button size="sm" onClick={() => { setEditingGodown(undefined); setGodownDialog(true); }}>
                <Plus className="size-4" /> New Godown
              </Button>
            )}
            {(tab === "movements" || tab === "items") && (
              <Button size="sm" variant="secondary" onClick={() => setMovementDialog(true)}>
                <ArrowLeftRight className="size-4" /> Record Movement
              </Button>
            )}
          </div>
        </div>

        {/* ITEMS TAB */}
        <TabsContent value="items" className="mt-4">
          {items === undefined ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : items.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Boxes /></EmptyMedia>
                <EmptyTitle>No stock items yet</EmptyTitle>
                <EmptyDescription>Add materials like cement, steel, or sand to start tracking inventory.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => { setEditingItem(undefined); setItemDialog(true); }}>
                  <Plus className="size-4" /> New Item
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase">
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-right">In Stock</th>
                    <th className="px-3 py-2 text-right">Value</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => (
                    <tr key={item._id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{item.sku}</td>
                      <td className="px-3 py-2 font-medium">{item.name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{item.category ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">
                        {item.totalQuantity} {item.unit}
                        {item.isLowStock && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="size-3" />
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold">{formatCompactInr(item.totalValue)}</td>
                      <td className="px-3 py-2">
                        {!item.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                      </td>
                      <td className="px-2 py-2">
                        {isOwner && (
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditingItem(item); setItemDialog(true); }}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() =>
                                updateItem({ itemId: item._id, isActive: !item.isActive }).then(() =>
                                  toast.success(item.isActive ? "Item deactivated" : "Item activated"),
                                )
                              }
                            >
                              {item.isActive ? <XCircle className="size-3.5 text-muted-foreground" /> : <CheckCircle className="size-3.5 text-green-600" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={() => setConfirmDeleteItem(item._id)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* GODOWNS TAB */}
        <TabsContent value="godowns" className="mt-4">
          {godowns === undefined ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : godowns.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Warehouse /></EmptyMedia>
                <EmptyTitle>No godowns yet</EmptyTitle>
                <EmptyDescription>Add a site store or warehouse to hold stock.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => { setEditingGodown(undefined); setGodownDialog(true); }}>
                  <Plus className="size-4" /> New Godown
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card divide-y">
              {godowns.map((godown) => (
                <div key={godown._id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
                  <Warehouse className="size-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{godown.name}</p>
                    {godown.address && <p className="truncate text-xs text-muted-foreground">{godown.address}</p>}
                  </div>
                  {!godown.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  {isOwner && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditingGodown(godown); setGodownDialog(true); }}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() =>
                          updateGodown({ godownId: godown._id, isActive: !godown.isActive }).then(() =>
                            toast.success(godown.isActive ? "Godown deactivated" : "Godown activated"),
                          )
                        }
                      >
                        {godown.isActive ? <XCircle className="size-3.5 text-muted-foreground" /> : <CheckCircle className="size-3.5 text-green-600" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={() => setConfirmDeleteGodown(godown._id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* MOVEMENTS TAB */}
        <TabsContent value="movements" className="mt-4">
          {movements === undefined ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : movements.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><ArrowLeftRight /></EmptyMedia>
                <EmptyTitle>No stock movements yet</EmptyTitle>
                <EmptyDescription>Record opening stock, purchase receipts, or consumption to see history here.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setMovementDialog(true)}>
                  <ArrowLeftRight className="size-4" /> Record Movement
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Godown</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movements.map((m) => (
                    <tr key={m._id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(m.date)}</td>
                      <td className="px-3 py-2 text-sm font-medium">{m.itemName}</td>
                      <td className="px-3 py-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", MOVEMENT_TYPE_COLORS[m.type])}>
                          {MOVEMENT_TYPE_LABELS[m.type]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {m.godownName}
                        {m.linkedGodownName && (m.type === "transfer_out" ? ` → ${m.linkedGodownName}` : ` ← ${m.linkedGodownName}`)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">
                        {m.type.endsWith("_out") ? "−" : "+"}{m.quantity} {m.itemUnit}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{formatCompactInr(m.rate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold">{formatCompactInr(m.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* VALUATION TAB */}
        <TabsContent value="valuation" className="mt-4">
          {valuation === undefined ? (
            <Skeleton className="h-64 w-full" />
          ) : valuation.rows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Package /></EmptyMedia>
                <EmptyTitle>No stock on hand</EmptyTitle>
                <EmptyDescription>Record opening stock or purchase receipts to see valuation here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Godown</th>
                    <th className="px-3 py-2 text-right">Quantity</th>
                    <th className="px-3 py-2 text-right">Avg. Rate</th>
                    <th className="px-3 py-2 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {valuation.rows.map((row) => (
                    <tr key={`${row.stockItemId}-${row.godownId}`} className="hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <span className="font-medium text-sm">{row.itemName}</span>
                        <span className="ml-1.5 font-mono text-xs text-muted-foreground">{row.sku}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{row.godownName}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{row.quantity} {row.unit}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{formatCompactInr(row.avgRate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold">{formatCompactInr(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/20 font-semibold text-sm">
                    <td className="px-3 py-2" colSpan={4}>Total Stock Value</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCompactInr(valuation.totalValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ItemFormDialog
        open={itemDialog}
        onOpenChange={(o) => { setItemDialog(o); if (!o) setEditingItem(undefined); }}
        editing={editingItem}
      />
      <GodownFormDialog
        open={godownDialog}
        onOpenChange={(o) => { setGodownDialog(o); if (!o) setEditingGodown(undefined); }}
        editing={editingGodown}
      />
      <StockMovementDialog open={movementDialog} onOpenChange={setMovementDialog} />

      <AlertDialog open={!!confirmDeleteItem} onOpenChange={(o) => !o && setConfirmDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Items with recorded stock movements cannot be deleted — deactivate instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDeleteItem) return;
                try {
                  await deleteItem({ itemId: confirmDeleteItem });
                  toast.success("Item deleted");
                } catch (err) {
                  if (err instanceof ConvexError) {
                    const { message } = err.data as { message: string };
                    toast.error(message);
                  } else {
                    toast.error("Failed to delete item");
                  }
                }
                setConfirmDeleteItem(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDeleteGodown} onOpenChange={(o) => !o && setConfirmDeleteGodown(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete godown?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Godowns with recorded stock movements cannot be deleted — deactivate instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDeleteGodown) return;
                try {
                  await deleteGodown({ godownId: confirmDeleteGodown });
                  toast.success("Godown deleted");
                } catch (err) {
                  if (err instanceof ConvexError) {
                    const { message } = err.data as { message: string };
                    toast.error(message);
                  } else {
                    toast.error("Failed to delete godown");
                  }
                }
                setConfirmDeleteGodown(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
