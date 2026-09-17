import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { Building2, MapPin, Pencil, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Progress } from "@/components/ui/progress.tsx";
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
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  formatCompactInr,
} from "@/lib/real-estate.ts";
import { useMigrationProjects } from "@/hooks/use-migration-projects.ts";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import ProjectFormDialog from "./_components/project-form-dialog.tsx";
import MigrationProjectFormDialog from "./_components/migration-project-form-dialog.tsx";

export default function ProjectsPage() {
  if (migrationApiEnabled) return <MigrationProjectsPage />;
  return <ConvexProjectsPage />;
}

function MigrationProjectsPage() {
  const migrationProjects = useMigrationProjects();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>();
  const projects = migrationProjects.projects;

  return (
    <ProjectsContent
      projects={projects}
      dialogOpen={dialogOpen}
      setDialogOpen={setDialogOpen}
      readOnly={false}
      migrationDialog={<MigrationProjectFormDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingProject(undefined); }} project={editingProject} />}
      onEditProject={(project) => { setEditingProject(project); setDialogOpen(true); }}
    />
  );
}

function ConvexProjectsPage() {
  const convexProjects = useQuery(api.projects.list, {});
  const [dialogOpen, setDialogOpen] = useState(false);
  return <ProjectsContent projects={convexProjects} dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} />;
}

function ProjectsContent({
  projects,
  dialogOpen,
  setDialogOpen,
  readOnly = false,
  migrationDialog,
  onEditProject,
}: {
  projects: any[] | undefined;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  readOnly?: boolean;
  migrationDialog?: React.ReactNode;
  onEditProject?: (project: any) => void;
}) {

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Projects
          </h1>
          <p className="text-sm text-muted-foreground">
            Every tower, layout or scheme you are selling.
          </p>
        </div>
        {!readOnly && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            New project
          </Button>
        )}
      </div>

      {projects === undefined ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-44 w-full" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>No projects yet</EmptyTitle>
            <EmptyDescription>
              Add your first project, then load its flats or plots into
              inventory.
            </EmptyDescription>
          </EmptyHeader>
          {!readOnly && (
            <EmptyContent>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                Add project
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => {
            const { summary } = project;
            const committed = summary.booked + summary.sold;
            const percent =
              summary.totalUnits === 0
                ? 0
                : Math.round((committed / summary.totalUnits) * 100);
            return (
              <Card key={project._id} className="transition-shadow hover:shadow-md">
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <Link
                        to={`/projects/${project._id}`}
                        className="block truncate font-medium hover:text-primary"
                      >
                        {project.name}
                      </Link>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="size-3.5" />
                        {project.city}
                        <span className="text-border">|</span>
                        {PROJECT_TYPE_LABELS[project.type as keyof typeof PROJECT_TYPE_LABELS]}
                      </p>
                    </div>
                    <div className="flex items-center gap-1"><Badge variant="secondary" className="shrink-0">{PROJECT_STATUS_LABELS[project.status as keyof typeof PROJECT_STATUS_LABELS]}</Badge>{onEditProject && <Button variant="ghost" size="icon" onClick={() => onEditProject(project)} aria-label={`Edit ${project.name}`}><Pencil className="size-4" /></Button>}</div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {committed} of {summary.totalUnits} units committed
                      </span>
                      <span className="tabular-nums">{percent}%</span>
                    </div>
                    <Progress value={percent} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-muted/60 p-2">
                      <p className="text-xs text-muted-foreground">Available</p>
                      <p className="font-semibold tabular-nums">
                        {summary.available}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/60 p-2">
                      <p className="text-xs text-muted-foreground">Inventory</p>
                      <p className="font-semibold tabular-nums">
                        {formatCompactInr(summary.inventoryValue)}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/60 p-2">
                      <p className="text-xs text-muted-foreground">Sold</p>
                      <p className="font-semibold tabular-nums">
                        {formatCompactInr(summary.soldValue)}
                      </p>
                    </div>
                  </div>

                  <Button asChild variant="secondary" size="sm" className="w-full">
                    <Link to={`/projects/${project._id}`}>View inventory</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {migrationDialog ?? (!readOnly && <ProjectFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />)}
    </div>
  );
}
