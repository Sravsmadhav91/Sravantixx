import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { BookOpen, MoreHorizontal, Pencil, Trash2, User } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel";
import type { UnitWithBuyer } from "@/convex/units.ts";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import {
  UNIT_STATUSES,
  UNIT_STATUS_CLASSES,
  UNIT_STATUS_LABELS,
  formatCompactInr,
} from "@/lib/real-estate.ts";
import { cn } from "@/lib/utils.ts";
import { useRole } from "@/hooks/use-role.ts";
import BookUnitDialog from "./book-unit-dialog.tsx";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ConvexError
    ? (error.data as { message: string }).message
    : fallback;
}

type UnitActionsProps = {
  unit: UnitWithBuyer;
  onEdit: (unit: Doc<"units">) => void;
};

function UnitActions({ unit, onEdit }: UnitActionsProps) {
  const setStatus = useMutation(api.units.setStatus);
  const removeUnit = useMutation(api.units.remove);
  const { isOwner } = useRole();
  const [bookOpen, setBookOpen] = useState(false);

  const changeStatus = async (status: Doc<"units">["status"]) => {
    try {
      await setStatus({ unitId: unit._id, status });
      toast.success(`Marked ${unit.number} as ${UNIT_STATUS_LABELS[status]}`);
    } catch (error) {
      toast.error(errorMessage(error, "Could not update the unit"));
    }
  };

  const handleDelete = async () => {
    try {
      await removeUnit({ unitId: unit._id });
      toast.success(`Removed ${unit.number}`);
    } catch (error) {
      toast.error(errorMessage(error, "Could not remove the unit"));
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${unit.number}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(unit)}>
            <Pencil className="size-4" />
            Edit unit
          </DropdownMenuItem>
          {unit.status === "available" || unit.status === "on_hold" ? (
            <DropdownMenuItem onClick={() => setBookOpen(true)}>
              <BookOpen className="size-4" />
              Book unit
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Set status</DropdownMenuLabel>
          {UNIT_STATUSES.map((status) => (
            <DropdownMenuItem
              key={status}
              disabled={status === unit.status}
              onClick={() => void changeStatus(status)}
            >
              {UNIT_STATUS_LABELS[status]}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {isOwner && (
            <DropdownMenuItem variant="destructive" onClick={() => void handleDelete()}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <BookUnitDialog
        open={bookOpen}
        onOpenChange={setBookOpen}
        unit={unit}
      />
    </>
  );
}

type UnitInventoryProps = {
  units: UnitWithBuyer[];
  onEdit?: (unit: Doc<"units">) => void;
  readOnly?: boolean;
  migrationMode?: boolean;
};

export default function UnitInventory({ units, onEdit, readOnly = false, migrationMode = false }: UnitInventoryProps) {
  const [view, setView] = useState<"grid" | "table">("grid");
  const useMigrationActions = migrationMode || import.meta.env.VITE_MIGRATION_API === "true";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={view === "grid" ? "default" : "secondary"}
          onClick={() => setView("grid")}
        >
          Site plan
        </Button>
        <Button
          size="sm"
          variant={view === "table" ? "default" : "secondary"}
          onClick={() => setView("table")}
        >
          List
        </Button>
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {units.map((unit) => (
            <div
              key={unit._id}
              className="space-y-2 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <p className="truncate font-medium">{unit.number}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {unit.configuration ?? "Unit"}
                    {unit.floor !== undefined ? ` · Floor ${unit.floor}` : ""}
                  </p>
                </div>
                {!readOnly && onEdit ? useMigrationActions ? <Button variant="ghost" size="icon" aria-label={`Edit ${unit.number}`} onClick={() => onEdit(unit)}><Pencil className="size-4" /></Button> : <UnitActions unit={unit} onEdit={onEdit} /> : null}
              </div>
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                  UNIT_STATUS_CLASSES[unit.status],
                )}
              >
                {UNIT_STATUS_LABELS[unit.status]}
              </span>
              {unit.allBuyerNames && unit.allBuyerIds && unit.allBuyerNames.length > 0 ? (
                <div className="space-y-0.5">
                  {unit.allBuyerNames.map((name, i) => (
                    <Link
                      key={unit.allBuyerIds![i]}
                      to={`/buyers/${unit.allBuyerIds![i]}`}
                      className="flex items-center gap-1 text-xs text-primary hover:underline truncate"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <User className="size-3 shrink-0" />
                      <span className="truncate">{name}{i === 0 && unit.allBuyerNames!.length > 1 ? " (primary)" : ""}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
              <div className="flex items-baseline justify-between text-sm">
                <div className="text-muted-foreground text-xs space-y-0.5">
                  {unit.superBuiltUpAreaSqft !== undefined && (
                    <p className="tabular-nums">SBA: {unit.superBuiltUpAreaSqft} sq ft</p>
                  )}
                  <p className="tabular-nums">BUA: {unit.areaSqft} sq ft</p>
                  {unit.carpetAreaSqft !== undefined && (
                    <p className="tabular-nums">CA: {unit.carpetAreaSqft} sq ft</p>
                  )}
                  {unit.undividedShare && (
                    <p>UDS: {unit.undividedShare}</p>
                  )}
                </div>
                <span className="font-semibold tabular-nums">
                  {formatCompactInr(unit.price)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Block</TableHead>
                <TableHead>Floor</TableHead>
                <TableHead>Config</TableHead>
                <TableHead className="text-right">SBA (sq ft)</TableHead>
                <TableHead className="text-right">BUA (sq ft)</TableHead>
                <TableHead className="text-right">CA (sq ft)</TableHead>
                <TableHead>UDS</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <TableRow key={unit._id}>
                  <TableCell className="font-medium">{unit.number}</TableCell>
                  <TableCell>{unit.block ?? "-"}</TableCell>
                  <TableCell className="tabular-nums">
                    {unit.floor ?? "-"}
                  </TableCell>
                  <TableCell>{unit.configuration ?? "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {unit.superBuiltUpAreaSqft ?? "-"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {unit.areaSqft}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {unit.carpetAreaSqft ?? "-"}
                  </TableCell>
                  <TableCell>{unit.undividedShare ?? "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {unit.ratePerSqft}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCompactInr(unit.price)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={UNIT_STATUS_CLASSES[unit.status]}
                    >
                      {UNIT_STATUS_LABELS[unit.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {unit.allBuyerNames && unit.allBuyerIds && unit.allBuyerNames.length > 0 ? (
                      <div className="space-y-0.5">
                        {unit.allBuyerNames.map((name, i) => (
                          <Link
                            key={unit.allBuyerIds![i]}
                            to={`/buyers/${unit.allBuyerIds![i]}`}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <User className="size-3 shrink-0" />
                            {name}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!readOnly && onEdit ? useMigrationActions ? <Button variant="ghost" size="icon" aria-label={`Edit ${unit.number}`} onClick={() => onEdit(unit)}><Pencil className="size-4" /></Button> : <UnitActions unit={unit} onEdit={onEdit} /> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
