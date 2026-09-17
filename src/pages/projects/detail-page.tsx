import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  Building2,
  LayoutGrid,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  ErrorState,
  ErrorStateContent,
  ErrorStateDescription,
  ErrorStateHeader,
  ErrorStateMedia,
  ErrorStateTitle,
} from "@/components/ui/error-state.tsx";
import { AlertTriangleIcon } from "lucide-react";
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
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  UNIT_STATUSES,
  UNIT_STATUS_LABELS,
  formatCompactInr,
} from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import {
  migrationApiEnabled,
} from "@/lib/migration-api.ts";
import {
  useMigrationProjectDetail,
  useMigrationUnits,
} from "@/hooks/use-migration-project-detail.ts";
import { useRole } from "@/hooks/use-role.ts";
import PageHeader from "@/components/page-header.tsx";
import ProjectFormDialog from "./_components/project-form-dialog.tsx";
import UnitFormDialog from "./_components/unit-form-dialog.tsx";
import BulkUnitsDialog from "./_components/bulk-units-dialog.tsx";
import MigrationUnitFormDialog from "./_components/migration-unit-form-dialog.tsx";
import UnitInventory from "./_components/unit-inventory.tsx";
import DocumentPanel from "@/components/documents/document-panel.tsx";
import { FolderOpen } from "lucide-react";

type StatusFilter = Doc<"units">["status"] | "all";

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (migrationApiEnabled) return <MigrationProjectDetailPage projectId={projectId} />;
  return <ConvexProjectDetailPage />;
}

function MigrationProjectDetailPage({ projectId }: { projectId?: string }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Doc<"units"> | undefined>();
  const detail = useMigrationProjectDetail(projectId);
  const { units, error: unitsError } = useMigrationUnits(projectId, statusFilter);
  if (!projectId) return <div className="p-8"><ErrorState><ErrorStateHeader><ErrorStateTitle>Project not found</ErrorStateTitle></ErrorStateHeader></ErrorState></div>;
  if (detail.project === undefined) return <div className="mx-auto max-w-6xl space-y-4 p-8"><Skeleton className="h-10 w-72" /><Skeleton className="h-48 w-full" /></div>;
  if (!detail.project) return <div className="p-8"><ErrorState><ErrorStateHeader><ErrorStateTitle>Project not available</ErrorStateTitle></ErrorStateHeader></ErrorState></div>;
  const project = detail.project;
    return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8"><PageHeader title={project.name} breadcrumbs={[{ label: "Projects", to: "/projects" }, { label: project.name }]} /><div className="space-y-1"><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{PROJECT_STATUS_LABELS[project.status]}</Badge></div><p className="text-sm text-muted-foreground">{project.address ? `${project.address}, ` : ""}{project.city} | {PROJECT_TYPE_LABELS[project.type]} | {project.code}</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[{ label: "Total units", value: project.summary.totalUnits }, { label: "Available", value: project.summary.available }, { label: "Inventory value", value: formatCompactInr(project.summary.inventoryValue) }, { label: "Sold value", value: formatCompactInr(project.summary.soldValue) }].map((tile) => <Card key={tile.label}><CardContent><p className="text-xs text-muted-foreground">{tile.label}</p><p className="text-2xl font-semibold">{tile.value}</p></CardContent></Card>)}</div><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Inventory</h2><Button onClick={() => { setEditingUnit(undefined); setUnitDialogOpen(true); }}><Plus className="size-4" />Add unit</Button></div><div className="flex flex-wrap gap-2">{(["all", ...UNIT_STATUSES] as StatusFilter[]).map((status) => <Button key={status} size="sm" variant={statusFilter === status ? "default" : "secondary"} onClick={() => setStatusFilter(status)}>{status === "all" ? "All" : UNIT_STATUS_LABELS[status]}</Button>)}</div>{unitsError ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Could not load units: {unitsError.message}</div> : units === undefined ? <Skeleton className="h-48 w-full" /> : units.length === 0 ? <Empty><EmptyHeader><EmptyMedia variant="icon"><Building2 /></EmptyMedia><EmptyTitle>No units yet</EmptyTitle></EmptyHeader></Empty> : <UnitInventory units={units} readOnly={false} onEdit={(unit) => { setEditingUnit(unit); setUnitDialogOpen(true); }} />}{projectId && <MigrationUnitFormDialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen} projectId={projectId} editing={editingUnit} />}</div>;
}

function ConvexProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const projectId = params.projectId as Id<"projects"> | undefined;
  const { isOwner } = useRole();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editingProject, setEditingProject] = useState(false);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [migrationUnitDialogOpen, setMigrationUnitDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Doc<"units"> | undefined>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const project = useQuery(
    api.projects.get,
    projectId ? { projectId } : "skip",
  );
  const units = useQuery(
    api.units.listByProject,
    projectId
      ? {
          projectId,
          ...(statusFilter === "all" ? {} : { status: statusFilter }),
        }
      : "skip",
  );
  const migrationProject = useMigrationProjectDetail(projectId);
  const migrationUnits = useMigrationUnits(projectId, statusFilter).units;
  const displayedProject = migrationApiEnabled ? migrationProject.project : project;
  const displayedUnits = migrationApiEnabled ? migrationUnits : units;
  const removeProject = useMutation(api.projects.remove);

  if (!projectId) {
    return (
      <div className="p-8">
        <ErrorState>
          <ErrorStateHeader>
            <ErrorStateMedia variant="icon">
              <AlertTriangleIcon />
            </ErrorStateMedia>
            <ErrorStateTitle>Project not found</ErrorStateTitle>
            <ErrorStateDescription>
              That link does not point to a project.
            </ErrorStateDescription>
          </ErrorStateHeader>
          <ErrorStateContent>
            <Button size="sm" asChild>
              <Link to="/projects">Back to projects</Link>
            </Button>
          </ErrorStateContent>
        </ErrorState>
      </div>
    );
  }

  const handleDeleteProject = async () => {
    try {
      await removeProject({ projectId });
      toast.success("Project deleted");
      navigate("/projects");
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Could not delete the project",
      );
    }
  };

  const openNewUnit = () => {
    setEditingUnit(undefined);
    setUnitDialogOpen(true);
  };

  const openEditUnit = (unit: Doc<"units">) => {
    setEditingUnit(unit);
    setUnitDialogOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={displayedProject?.name ?? "Project"}
        breadcrumbs={[
          { label: "Projects", to: "/projects" },
          { label: displayedProject?.name ?? "…" },
        ]}
        actions={
          !migrationApiEnabled && project && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setEditingProject(true)}>
                <Pencil className="size-4" />
                Edit
              </Button>
              {isOwner && (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              )}
            </div>
          )
        }
      />

      {displayedProject === undefined ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : displayedProject === null ? (
        <ErrorState>
          <ErrorStateHeader>
            <ErrorStateMedia variant="icon">
              <AlertTriangleIcon />
            </ErrorStateMedia>
            <ErrorStateTitle>Project not available</ErrorStateTitle>
            <ErrorStateDescription>
              It may have been deleted.
            </ErrorStateDescription>
          </ErrorStateHeader>
        </ErrorState>
      ) : (
        <>
          {/* Project meta */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {PROJECT_STATUS_LABELS[displayedProject.status]}
              </Badge>
            </div>
            <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" />
              {displayedProject.address ? `${displayedProject.address}, ` : ""}
              {displayedProject.city}
              <span className="text-border">|</span>
              {PROJECT_TYPE_LABELS[displayedProject.type]}
              <span className="text-border">|</span>
              {displayedProject.code}
            </p>
            {displayedProject.reraNumber || displayedProject.possessionDate ? (
              <p className="text-xs text-muted-foreground">
                {displayedProject.reraNumber ? `RERA ${displayedProject.reraNumber}` : ""}
                {displayedProject.reraNumber && displayedProject.possessionDate ? " · " : ""}
                {displayedProject.possessionDate
                  ? `Possession ${formatDate(displayedProject.possessionDate)}`
                  : ""}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total units", value: String(displayedProject.summary.totalUnits) },
              { label: "Available", value: String(displayedProject.summary.available) },
              {
                label: "Inventory value",
                value: formatCompactInr(displayedProject.summary.inventoryValue),
              },
              {
                label: "Sold value",
                value: formatCompactInr(displayedProject.summary.soldValue),
              },
            ].map((tile) => (
              <Card key={tile.label}>
                <CardContent className="space-y-1">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {tile.label}
                  </p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {tile.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Inventory</h2>
            {migrationApiEnabled ? (
              <Button onClick={() => setMigrationUnitDialogOpen(true)}><Plus className="size-4" />Add unit</Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setBulkDialogOpen(true)}>
                  <LayoutGrid className="size-4" />
                  Generate units
                </Button>
                <Button onClick={openNewUnit}>
                  <Plus className="size-4" />
                  Add unit
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", ...UNIT_STATUSES] as StatusFilter[]).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={statusFilter === status ? "default" : "secondary"}
                onClick={() => setStatusFilter(status)}
              >
                {status === "all" ? "All" : UNIT_STATUS_LABELS[status]}
              </Button>
            ))}
          </div>

          {displayedUnits === undefined ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-28 w-full" />
              ))}
            </div>
          ) : displayedUnits.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Building2 />
                </EmptyMedia>
                <EmptyTitle>
                  {statusFilter === "all"
                    ? "No units yet"
                    : `No ${UNIT_STATUS_LABELS[statusFilter].toLowerCase()} units`}
                </EmptyTitle>
                <EmptyDescription>
                  {statusFilter === "all"
                    ? "Generate a whole block at once, or add units one by one."
                    : "Try a different status filter."}
                </EmptyDescription>
              </EmptyHeader>
              {statusFilter === "all" && !migrationApiEnabled ? (
                <EmptyContent className="flex-row justify-center gap-2">
                  <Button size="sm" onClick={() => setBulkDialogOpen(true)}>
                    Generate units
                  </Button>
                  <Button size="sm" variant="secondary" onClick={openNewUnit}>
                    Add one unit
                  </Button>
                </EmptyContent>
              ) : null}
            </Empty>
          ) : (
            <UnitInventory
              units={displayedUnits}
              onEdit={migrationApiEnabled ? undefined : openEditUnit}
              readOnly={migrationApiEnabled}
            />
          )}

          {!migrationApiEnabled && <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <FolderOpen className="size-5 text-muted-foreground" />
              Documents
            </h2>
            <DocumentPanel
              linkedType="project"
              linkedId={projectId}
              linkedName={displayedProject.name}
            />
          </div>}

          {migrationApiEnabled && projectId && <MigrationUnitFormDialog open={migrationUnitDialogOpen} onOpenChange={setMigrationUnitDialogOpen} projectId={projectId} />}
          {!migrationApiEnabled && <ProjectFormDialog
            open={editingProject}
            onOpenChange={setEditingProject}
            project={project}
          />}
          {!migrationApiEnabled && <UnitFormDialog
            open={unitDialogOpen}
            onOpenChange={setUnitDialogOpen}
            projectId={projectId}
            unit={editingUnit}
          />}
          {!migrationApiEnabled && <BulkUnitsDialog
            open={bulkDialogOpen}
            onOpenChange={setBulkDialogOpen}
            projectId={projectId}
          />}
          {!migrationApiEnabled && <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the project and all of its unsold units. Projects
                  with booked or sold units cannot be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleDeleteProject()}>
                  Delete project
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>}
        </>
      )}
    </div>
  );
}
