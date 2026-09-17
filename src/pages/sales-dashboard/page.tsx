import { Link } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "convex/react";
import {
  IndianRupee,
  Receipt,
  ScrollText,
  TrendingUp,
  Percent,
  Building2,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";
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
import { useMigrationSalesDashboard } from "@/hooks/use-migration-sales-dashboard.ts";

function currentFY(): { from: string; to: string } {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: `${year}-04-01`, to: `${year + 1}-03-31` };
}

// ── Tooltip renderers ─────────────────────────────────────────────────────────

function TrendTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string; dataKey: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.dataKey === "bookingCount" ? p.value : formatCompactInr(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SalesDashboardPage() {
  if (migrationApiEnabled) return <MigrationSalesDashboardPage />;
  return <ConvexSalesDashboardPage />;
}

function MigrationSalesDashboardPage() {
  const fy = currentFY();
  const [fromDate, setFromDate] = useState(fy.from);
  const [toDate, setToDate] = useState(fy.to);
  const [projectId, setProjectId] = useState("all");
  const projects = useMigrationProjects().projects;
  const data = useMigrationSalesDashboard({ projectId, fromDate, toDate });
  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sales</p><h1 className="font-serif text-3xl font-semibold">Sales Dashboard</h1><p className="text-sm text-muted-foreground">Bookings, revenue trends, and lead conversion at a glance.</p></div><Button asChild variant="secondary" size="sm"><Link to="/reports">Full reports →</Link></Button></div><div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3"><select className="h-8 rounded-md border border-input bg-background px-3 text-xs" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="all">All projects</option>{(projects ?? []).map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</select><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-36 text-xs" /><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-36 text-xs" /><Button variant="secondary" size="sm" onClick={() => { setFromDate(fy.from); setToDate(fy.to); setProjectId("all"); }}>Reset</Button></div>{!data ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div> : <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[["Bookings", data.kpis.bookingCount], ["Booking value", formatCompactInr(data.kpis.bookingValue)], ["Collected", formatCompactInr(data.kpis.collectedAmount)], ["Avg ticket size", formatCompactInr(data.kpis.avgTicketSize)], ["Lead → booking", `${data.kpis.leadToBookingRate}%`]].map(([label, value]) => <Card key={String(label)}><CardContent><p className="text-xs uppercase text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label === "Bookings" ? "In selected period" : ""}</p></CardContent></Card>)}</div><Card><CardHeader><CardTitle>Bookings & collections trend</CardTitle></CardHeader><CardContent>{data.trend.length === 0 ? <p className="py-20 text-center text-sm text-muted-foreground">No bookings or collections in this period</p> : <ResponsiveContainer width="100%" height={280}><ComposedChart data={data.trend}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar dataKey="bookingValue" name="Booking Value" fill="oklch(0.72 0.15 70)" /><Bar dataKey="collectedAmount" name="Collected" fill="oklch(0.55 0.13 175)" /><Line dataKey="bookingCount" name="Bookings" stroke="oklch(0.62 0.17 20)" /></ComposedChart></ResponsiveContainer>}</CardContent></Card><div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>Sales by project</CardTitle></CardHeader><CardContent className="space-y-3">{data.byProject.map((project) => <div key={project.projectId} className="flex justify-between border-b pb-2"><span>{project.name}</span><strong>{formatCompactInr(project.bookingValue)}</strong></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Sales by team member</CardTitle></CardHeader><CardContent className="space-y-3">{data.bySalesRep.map((rep) => <div key={rep.userId ?? "owner"} className="flex justify-between border-b pb-2"><span>{rep.name}</span><strong>{rep.bookingCount} bookings · {formatCompactInr(rep.bookingValue)}</strong></div>)}</CardContent></Card></div></>}</div>;
}

function ConvexSalesDashboardPage() {
  const fy = currentFY();
  const [fromDate, setFromDate] = useState(fy.from);
  const [toDate, setToDate] = useState(fy.to);
  const [projectId, setProjectId] = useState<string>("all");

  const projects = useQuery(api.projects.list, {});
  const data = useQuery(api.reports.getSalesDashboard, {
    fromDate,
    toDate,
    projectId: projectId !== "all" ? (projectId as Id<"projects">) : undefined,
  });

  const projectOptions = [
    { value: "all", label: "All projects" },
    ...(projects ?? []).map((p) => ({ value: p._id, label: p.name })),
  ];

  const loaded = data !== undefined;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sales</p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Sales Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Bookings, revenue trends, and lead conversion at a glance.
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link to="/reports">Full reports →</Link>
        </Button>
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
          <Label className="text-xs">From</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-36 text-xs" />
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs">To</Label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-36 text-xs" />
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="h-8"
          onClick={() => { setFromDate(fy.from); setToDate(fy.to); setProjectId("all"); }}
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
                label: "Bookings",
                value: String(data.kpis.bookingCount),
                hint: "In selected period",
                icon: ScrollText,
              },
              {
                label: "Booking value",
                value: formatCompactInr(data.kpis.bookingValue),
                hint: "Agreement value booked",
                icon: IndianRupee,
              },
              {
                label: "Collected",
                value: formatCompactInr(data.kpis.collectedAmount),
                hint: "Receipts in period",
                icon: Receipt,
              },
              {
                label: "Avg ticket size",
                value: formatCompactInr(data.kpis.avgTicketSize),
                hint: "Per booking",
                icon: TrendingUp,
              },
              {
                label: "Lead → booking",
                value: `${data.kpis.leadToBookingRate}%`,
                hint: `${data.kpis.totalLeads} leads in period`,
                icon: Percent,
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
                      <Icon className="size-4 text-primary" />
                    </div>
                    <p className="text-2xl font-semibold tabular-nums">{tile.value}</p>
                    <p className="text-xs text-muted-foreground">{tile.hint}</p>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Bookings & collections trend</CardTitle>
        </CardHeader>
        <CardContent>
          {!loaded ? (
            <Skeleton className="h-72 w-full" />
          ) : data.trend.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
              No bookings or collections in this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={data.trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(v: number) => formatCompactInr(v)}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  width={64}
                />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} className="fill-muted-foreground" width={28} allowDecimals={false} />
                <Tooltip content={<TrendTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="bookingValue" name="Booking Value" fill="oklch(0.72 0.15 70)" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="left" dataKey="collectedAmount" name="Collected" fill="oklch(0.55 0.13 175)" radius={[3, 3, 0, 0]} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="bookingCount"
                  name="Bookings"
                  stroke="oklch(0.62 0.17 20)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* By project */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Sales by project</CardTitle>
          </CardHeader>
          <CardContent>
            {!loaded ? (
              <Skeleton className="h-56 w-full" />
            ) : data.byProject.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Building2 /></EmptyMedia>
                  <EmptyTitle>No bookings in this period</EmptyTitle>
                  <EmptyDescription>Try widening the date range or clearing filters.</EmptyDescription>
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
                  <Tooltip
                    formatter={(v) => formatCompactInr(Number(v ?? 0))}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="bookingValue" name="Booking Value" fill="oklch(0.72 0.15 70)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="collectedAmount" name="Collected" fill="oklch(0.55 0.13 175)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* By sales rep */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Sales by team member</CardTitle>
          </CardHeader>
          <CardContent>
            {!loaded ? (
              <Skeleton className="h-56 w-full" />
            ) : data.bySalesRep.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Users /></EmptyMedia>
                  <EmptyTitle>No bookings in this period</EmptyTitle>
                  <EmptyDescription>Bookings created by owner or team members will appear here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-3">
                {data.bySalesRep.map((rep) => {
                  const max = data.bySalesRep[0]?.bookingValue || 1;
                  const pct = Math.round((rep.bookingValue / max) * 100);
                  return (
                    <div key={rep.userId ?? "unassigned"} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate max-w-[60%]">{rep.name}</span>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {rep.bookingCount} booking{rep.bookingCount !== 1 ? "s" : ""} · <strong className="text-foreground">{formatCompactInr(rep.bookingValue)}</strong>
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
