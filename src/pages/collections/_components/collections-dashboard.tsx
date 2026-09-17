import { useState } from "react";
import { useQuery } from "convex/react";
import {
  IndianRupee,
  Receipt,
  AlertTriangle,
  CalendarClock,
  Percent,
  Building2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
import { Button } from "@/components/ui/button.tsx";
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
import { useMigrationCollectionsDashboard } from "@/hooks/use-migration-collections-dashboard.ts";

function defaultFromDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 11);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const AGING_COLORS = [
  "oklch(0.72 0.15 70)",
  "oklch(0.66 0.16 45)",
  "oklch(0.6 0.18 30)",
  "oklch(0.56 0.2 27)",
];

function AgingTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { count: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{formatCompactInr(p.value)}</p>
      <p className="text-muted-foreground">
        {p.payload.count} instalment{p.payload.count !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

export default function CollectionsDashboard() {
  return migrationApiEnabled ? <MigrationCollectionsDashboardData /> : <ConvexCollectionsDashboardData />;
}

function ConvexCollectionsDashboardData() {
  const [fromDate, setFromDate] = useState(defaultFromDate());
  const [toDate, setToDate] = useState(todayDate());
  const [projectId, setProjectId] = useState<string>("all");

  const projects = useQuery(api.projects.list, {});
  const data = useQuery(api.reports.getCollectionsDashboard, {
    fromDate,
    toDate,
    projectId: projectId !== "all" ? (projectId as Id<"projects">) : undefined,
  });

  const projectOptions = [
    { value: "all", label: "All projects" },
    ...(projects ?? []).map((p) => ({ value: p._id, label: p.name })),
  ];

  return (
    <CollectionsDashboardView
      data={data}
      projectOptions={projectOptions}
      fromDate={fromDate}
      setFromDate={setFromDate}
      toDate={toDate}
      setToDate={setToDate}
      projectId={projectId}
      setProjectId={setProjectId}
    />
  );
}

function MigrationCollectionsDashboardData() {
  const [fromDate, setFromDate] = useState(defaultFromDate());
  const [toDate, setToDate] = useState(todayDate());
  const [projectId, setProjectId] = useState<string>("all");

  const migrationProjects = useMigrationProjects();
  const data = useMigrationCollectionsDashboard({ projectId, fromDate, toDate });

  const projectOptions = [
    { value: "all", label: "All projects" },
    ...(migrationProjects.projects ?? []).map((p) => ({ value: p._id, label: p.name })),
  ];

  return (
    <CollectionsDashboardView
      data={data}
      projectOptions={projectOptions}
      fromDate={fromDate}
      setFromDate={setFromDate}
      toDate={toDate}
      setToDate={setToDate}
      projectId={projectId}
      setProjectId={setProjectId}
    />
  );
}

type DashboardData = {
  kpis: { totalAgreementValue: number; totalCollected: number; collectionRate: number; totalOutstanding: number; overdueAmount: number; overdueCount: number; upcomingAmount: number; upcomingCount: number };
  aging: { label: string; amount: number; count: number }[];
  trend: { month: string; collectedAmount: number; sortKey: string }[];
  byProject: { name: string; collectedAmount: number; outstanding: number }[];
};

function CollectionsDashboardView({
  data,
  projectOptions,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  projectId,
  setProjectId,
}: {
  data: DashboardData | undefined;
  projectOptions: { value: string; label: string }[];
  fromDate: string;
  setFromDate: (value: string) => void;
  toDate: string;
  setToDate: (value: string) => void;
  projectId: string;
  setProjectId: (value: string) => void;
}) {

  const loaded = data !== undefined;
  const hasAging = loaded && data.aging.some((a) => a.count > 0);
  const hasTrend = loaded && data.trend.length > 0;
  const hasByProject = loaded && data.byProject.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Collections
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Collections Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Outstanding vs collected, overdue aging, and trends across all bookings.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <div className="space-y-0.5">
          <Label className="text-xs">Project</Label>
          <SearchableSelect
            value={projectId}
            onValueChange={setProjectId}
            options={projectOptions}
            placeholder="All projects"
            size="sm"
            triggerClassName="h-8 w-48 text-xs"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs">Trend from</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-36 text-xs" />
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs">Trend to</Label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-36 text-xs" />
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="h-8"
          onClick={() => { setFromDate(defaultFromDate()); setToDate(todayDate()); setProjectId("all"); }}
        >
          Reset
        </Button>
      </div>

      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {!loaded
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
          : [
              {
                label: "Agreement value",
                value: formatCompactInr(data.kpis.totalAgreementValue),
                hint: "Across active bookings",
                icon: IndianRupee,
              },
              {
                label: "Collected",
                value: formatCompactInr(data.kpis.totalCollected),
                hint: `${data.kpis.collectionRate}% of agreement value`,
                icon: Receipt,
              },
              {
                label: "Outstanding",
                value: formatCompactInr(data.kpis.totalOutstanding),
                hint: "Yet to be collected",
                icon: Percent,
              },
              {
                label: "Overdue",
                value: formatCompactInr(data.kpis.overdueAmount),
                hint: `${data.kpis.overdueCount} instalment${data.kpis.overdueCount !== 1 ? "s" : ""}`,
                icon: AlertTriangle,
                danger: true,
              },
              {
                label: "Due within 7 days",
                value: formatCompactInr(data.kpis.upcomingAmount),
                hint: `${data.kpis.upcomingCount} instalment${data.kpis.upcomingCount !== 1 ? "s" : ""}`,
                icon: CalendarClock,
              },
            ].map((tile) => {
              const Icon = tile.icon;
              return (
                <Card key={tile.label}>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {tile.label}
                      </span>
                      <Icon className={tile.danger ? "size-4 text-destructive" : "size-4 text-primary"} />
                    </div>
                    <p className={`text-2xl font-semibold tabular-nums ${tile.danger ? "text-destructive" : ""}`}>
                      {tile.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{tile.hint}</p>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Aging buckets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Overdue aging</CardTitle>
          </CardHeader>
          <CardContent>
            {!loaded ? (
              <Skeleton className="h-56 w-full" />
            ) : !hasAging ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><AlertTriangle /></EmptyMedia>
                  <EmptyTitle>No overdue instalments</EmptyTitle>
                  <EmptyDescription>Everything is on track — nothing is past due.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.aging} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tickFormatter={(v: number) => formatCompactInr(v)} tick={{ fontSize: 11 }} className="fill-muted-foreground" width={64} />
                  <Tooltip content={<AgingTooltip />} />
                  <Bar dataKey="amount" name="Overdue amount" radius={[3, 3, 0, 0]}>
                    {data.aging.map((entry, i) => (
                      <Cell key={entry.label} fill={AGING_COLORS[i % AGING_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Collections trend</CardTitle>
          </CardHeader>
          <CardContent>
            {!loaded ? (
              <Skeleton className="h-56 w-full" />
            ) : !hasTrend ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Receipt /></EmptyMedia>
                  <EmptyTitle>No collections in this period</EmptyTitle>
                  <EmptyDescription>Try widening the date range or clearing filters.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tickFormatter={(v: number) => formatCompactInr(v)} tick={{ fontSize: 11 }} className="fill-muted-foreground" width={64} />
                  <Tooltip formatter={(v) => formatCompactInr(Number(v ?? 0))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="collectedAmount" name="Collected" fill="oklch(0.55 0.13 175)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* By project */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Outstanding by project</CardTitle>
        </CardHeader>
        <CardContent>
          {!loaded ? (
            <Skeleton className="h-56 w-full" />
          ) : !hasByProject ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Building2 /></EmptyMedia>
                <EmptyTitle>No active bookings</EmptyTitle>
                <EmptyDescription>Outstanding balances will appear here once you have active bookings.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, data.byProject.length * 52)}>
              <BarChart
                data={data.byProject}
                layout="vertical"
                margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tickFormatter={(v: number) => formatCompactInr(v)} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" width={110} />
                <Tooltip formatter={(v) => formatCompactInr(Number(v ?? 0))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="collectedAmount" name="Collected" fill="oklch(0.55 0.13 175)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="outstanding" name="Outstanding" fill="oklch(0.62 0.17 20)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
