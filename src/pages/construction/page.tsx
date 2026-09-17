import { useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { HardHat, TrendingDown } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { useMigrationProjects } from "@/hooks/use-migration-projects.ts";

function MigrationConstructionPage() {
  const { projects } = useMigrationProjects();
  return <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8"><div className="space-y-1"><h1 className="font-serif text-3xl font-semibold tracking-tight">Construction</h1><p className="text-sm text-muted-foreground">Track stage-wise progress and expenses per project.</p></div>{projects === undefined ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div> : projects.length === 0 ? <Empty><EmptyHeader><EmptyMedia variant="icon"><HardHat /></EmptyMedia><EmptyTitle>No projects yet</EmptyTitle></EmptyHeader></Empty> : <div className="space-y-3">{projects.map((project) => <Link key={project._id} to={`/construction/${project._id}`} className="flex items-center justify-between rounded-lg border border-border bg-card p-4"><div><p className="font-medium">{project.name}</p><p className="text-sm text-muted-foreground">{project.city}{project.constructionBudget ? ` · Budget: ${formatCompactInr(project.constructionBudget)}` : ""}</p></div><span className="text-sm text-muted-foreground">View progress →</span></Link>)}</div>}</div>;
}

function ConstructionListInner() {
  const projects = useQuery(api.projects.list, {});

  if (projects === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HardHat />
          </EmptyMedia>
          <EmptyTitle>No projects yet</EmptyTitle>
          <EmptyDescription>
            Create a project first, then track construction progress here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => (
        <Link
          key={project._id}
          to={`/construction/${project._id}`}
          className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{project.name}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {project.code}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {project.city}
              {project.constructionBudget
                ? ` · Budget: ${formatCompactInr(project.constructionBudget)}`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <TrendingDown className="size-4" />
            View progress
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function ConstructionPage() {
  if (migrationApiEnabled) return <MigrationConstructionPage />;
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Construction</h1>
        <p className="text-sm text-muted-foreground">
          Track stage-wise progress and expenses per project.
        </p>
      </div>
      <AuthLoading>
        <Skeleton className="h-20 w-full" />
      </AuthLoading>
      <Unauthenticated>
        <SignInButton />
      </Unauthenticated>
      <Authenticated>
        <ConstructionListInner />
      </Authenticated>
    </div>
  );
}
