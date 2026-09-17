import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  IndianRupee,
  KeyRound,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { getMigrationDashboard, migrationApiEnabled, type MigrationDashboard } from "@/lib/migration-api.ts";
import { OverduePanel, UpcomingDuePanel } from "@/components/payment-alerts.tsx";
import ApprovalNotificationsPanel from "@/components/approval-notifications.tsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

// ── Recharts tooltip ─────────────────────────────────────────────────────────

function InrTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCompactInr(p.value)}
        </p>
      ))}
    </div>
  );
}

function CountTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  if (migrationApiEnabled) return <MigrationDashboardPage />;
  return <ConvexDashboardPage />;
}

function MigrationDashboardPage() {
  const [dashboard, setDashboard] = useState<MigrationDashboard | undefined>();
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getMigrationDashboard().then(setDashboard).catch((value: unknown) => setError(value instanceof Error ? value : new Error("Could not load dashboard")));
  }, []);

  if (error) return <div className="p-8 text-sm text-destructive">{error.message}</div>;
  const kpis = dashboard?.kpis;
  const tiles = kpis ? [
    { label: "Live projects", value: String(kpis.totalProjects), hint: "Towers, layouts and schemes", icon: Building2, to: "/projects" },
    { label: "Units available", value: `${kpis.availableUnits} / ${kpis.totalUnits}`, hint: "Ready to sell right now", icon: KeyRound, to: "/projects" },
    { label: "Active bookings", value: String(kpis.activeBookings), hint: `${formatCompactInr(kpis.totalBookingValue)} agreement value`, icon: CheckCircle2, to: "/bookings" },
    { label: "Total collected", value: formatCompactInr(kpis.totalCollected), hint: "Across all receipts", icon: Receipt, to: "/collections" },
    { label: "Outstanding", value: formatCompactInr(kpis.totalOutstanding), hint: "Booking value − collected", icon: TrendingDown, to: "/collections" },
    { label: "Overdue instalments", value: String(kpis.overdueCount), hint: "Past due date", icon: AlertTriangle, to: "/collections" },
    { label: "Open leads", value: String(kpis.openLeads), hint: "Active in pipeline", icon: TrendingUp, to: "/leads" },
  ] : [];

  return <div className="mx-auto w-full max-w-7xl space-y-8 p-4 md:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-serif text-3xl font-semibold">Namaste, Maam</h1><p className="text-sm text-muted-foreground">Here is how your inventory and sales are doing today.</p></div><div className="flex gap-2"><Button asChild variant="secondary" size="sm"><Link to="/reports">Reports</Link></Button><Button asChild><Link to="/projects"><Plus className="size-4" /> New project</Link></Button></div></div>
    {!kpis ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-28" />)}</div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{tiles.map((tile) => { const Icon = tile.icon; return <Link key={tile.label} to={tile.to}><Card className="h-full transition-colors hover:border-primary"><CardContent className="space-y-2"><div className="flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{tile.label}</span><Icon className="size-4 text-primary" /></div><p className="text-2xl font-semibold tabular-nums">{tile.value}</p><p className="text-xs text-muted-foreground">{tile.hint}</p></CardContent></Card></Link>; })}</div>}
    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Bookings per month</CardTitle></CardHeader><CardContent>{!dashboard ? <Skeleton className="h-52 w-full" /> : <ResponsiveContainer width="100%" height={220}><BarChart data={dashboard.bookingsByMonth}><CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip content={<CountTooltip />} /><Bar dataKey="count" name="Bookings" fill="var(--color-primary)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">Collections trend</CardTitle></CardHeader><CardContent>{!dashboard ? <Skeleton className="h-52 w-full" /> : <ResponsiveContainer width="100%" height={220}><LineChart data={dashboard.collectionsByMonth}><CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatCompactInr(value)} width={65} /><Tooltip content={<InrTooltip />} /><Line dataKey="amount" name="Collected" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer>}</CardContent></Card></div>
    {dashboard && <Card><CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Project unit status</CardTitle><Button asChild variant="ghost" size="sm"><Link to="/projects">View all</Link></Button></div></CardHeader><CardContent><ResponsiveContainer width="100%" height={Math.max(180, dashboard.projectStatus.length * 56)}><BarChart data={dashboard.projectStatus} layout="vertical" margin={{ left: 0, right: 16 }}><CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} /><Tooltip content={<CountTooltip />} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="available" name="Available" stackId="a" fill="var(--color-primary)" /><Bar dataKey="booked" name="Booked" stackId="a" fill="#f59e0b" /><Bar dataKey="sold" name="Sold" stackId="a" fill="#10b981" /><Bar dataKey="onHold" name="On hold" stackId="a" fill="var(--color-muted-foreground)" /></BarChart></ResponsiveContainer></CardContent></Card>}
    {dashboard && <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Your projects</h2><Button asChild variant="ghost" size="sm"><Link to="/projects">View all</Link></Button></div><div className="grid gap-3 md:grid-cols-2">{dashboard.projects.slice(0, 4).map((project) => <Link key={project._id} to={`/projects/${project._id}`} className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:border-primary"><div className="min-w-0"><p className="truncate font-medium">{project.name}</p><p className="text-xs text-muted-foreground">{project.summary.available} available · {project.summary.totalUnits} units</p></div><span className="shrink-0 font-semibold tabular-nums">{formatCompactInr(project.summary.inventoryValue)}</span></Link>)}</div></section>}
  </div>;
}

function ConvexDashboardPage() {
  const user = useQuery(api.users.getCurrentUser, {});
  const kpis = useQuery(api.reports.getDashboardKpis, {});
  const projects = useQuery(api.projects.list, {});
  const bookingsByMonth = useQuery(api.reports.getBookingsByMonth, {});
  const collectionsByMonth = useQuery(api.reports.getCollectionsByMonth, {});
  const projectStatus = useQuery(api.reports.getProjectWiseStatus, {});
  const openLeadsCount = useQuery(api.leads.getOpenCount, {});
  const overdue = useQuery(api.payments.listOverdue, {});
  const upcoming = useQuery(api.payments.listUpcomingDue, {});

  const firstName = user?.name?.split(" ")[0];
  const loaded = kpis !== undefined && projects !== undefined;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          {user === undefined ? (
            <Skeleton className="h-9 w-64" />
          ) : (
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              {firstName ? `Namaste, ${firstName}` : "Welcome to Sravantix"}
            </h1>
          )}
          <p className="text-sm text-muted-foreground">
            Here is how your inventory and sales are doing today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link to="/reports">Reports</Link>
          </Button>
          <Button asChild>
            <Link to="/projects">
              <Plus className="size-4" />
              New project
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!loaded
          ? Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))
          : [
              {
                label: "Live projects",
                value: String(kpis.totalProjects),
                hint: "Towers, layouts and schemes",
                icon: Building2,
                to: "/projects",
              },
              {
                label: "Units available",
                value: `${kpis.availableUnits} / ${kpis.totalUnits}`,
                hint: "Ready to sell right now",
                icon: KeyRound,
                to: "/projects",
              },
              {
                label: "Active bookings",
                value: String(kpis.activeBookings),
                hint: formatCompactInr(kpis.totalBookingValue) + " agreement value",
                icon: CheckCircle2,
                to: "/bookings",
              },
              {
                label: "Total collected",
                value: formatCompactInr(kpis.totalCollected),
                hint: "Across all receipts",
                icon: Receipt,
                to: "/collections",
              },
              {
                label: "Outstanding",
                value: formatCompactInr(kpis.totalOutstanding),
                hint: "Booking value − collected",
                icon: TrendingDown,
                highlight: kpis.totalOutstanding > 0,
                to: "/collections",
              },
              {
                label: "Overdue instalments",
                value: String(kpis.overdueCount),
                hint: "Past due date",
                icon: AlertTriangle,
                highlight: kpis.overdueCount > 0,
                to: "/collections",
              },
              {
                label: "Open leads",
                value: openLeadsCount !== undefined ? String(openLeadsCount) : "…",
                hint: "Active in pipeline",
                icon: TrendingUp,
                to: "/leads",
              },
            ].map((tile) => {
              const Icon = tile.icon;
              return (
                <Link key={tile.label} to={tile.to}>
                  <Card className="h-full cursor-pointer transition-colors hover:border-primary">
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          {tile.label}
                        </span>
                        <Icon
                          className={
                            "size-4 " +
                            (tile.highlight ? "text-destructive" : "text-primary")
                          }
                        />
                      </div>
                      <p
                        className={
                          "text-2xl font-semibold tabular-nums " +
                          (tile.highlight ? "text-destructive" : "")
                        }
                      >
                        {tile.value}
                      </p>
                      <p className="text-xs text-muted-foreground">{tile.hint}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
      </div>

      {/* Payment alerts — overdue + upcoming */}
      <div className="space-y-3">
        <ApprovalNotificationsPanel />
        {overdue && overdue.length > 0 && <OverduePanel items={overdue} />}
        {upcoming && upcoming.length > 0 && <UpcomingDuePanel items={upcoming} />}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bookings by month */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Bookings per month</CardTitle>
          </CardHeader>
          <CardContent>
            {bookingsByMonth === undefined ? (
              <Skeleton className="h-52 w-full" />
            ) : bookingsByMonth.length === 0 ? (
              <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                No bookings yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bookingsByMonth} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                  <Tooltip content={<CountTooltip />} />
                  <Bar dataKey="count" name="Bookings" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Collections by month */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Collections trend</CardTitle>
          </CardHeader>
          <CardContent>
            {collectionsByMonth === undefined ? (
              <Skeleton className="h-52 w-full" />
            ) : collectionsByMonth.length === 0 ? (
              <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                No receipts yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={collectionsByMonth} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    tickFormatter={(v: number) => formatCompactInr(v)}
                    width={60}
                  />
                  <Tooltip content={<InrTooltip />} />
                  <Line
                    dataKey="amount"
                    name="Collected"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Project-wise status */}
      {projectStatus && projectStatus.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Project unit status</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/projects">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(180, projectStatus.length * 56)}>
              <BarChart
                data={projectStatus}
                layout="vertical"
                margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  width={120}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
                        <p className="mb-1 font-medium">{label}</p>
                        {payload.map((p) => (
                          <p key={p.name as string} style={{ color: p.color as string }}>
                            {p.name as string}: {p.value as number}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="available" name="Available" stackId="a" fill="var(--color-primary)" />
                <Bar dataKey="booked" name="Booked" stackId="a" fill="#f59e0b" />
                <Bar dataKey="sold" name="Sold" stackId="a" fill="#10b981" />
                <Bar dataKey="onHold" name="On hold" stackId="a" fill="var(--color-muted-foreground)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Projects quick list (hidden when no projects) */}
      {projects && projects.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your projects</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/projects">View all</Link>
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {projects.slice(0, 4).map((project) => (
              <Link
                key={project._id}
                to={`/projects/${project._id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{project.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {project.summary.available} available · {project.summary.totalUnits} units
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatCompactInr(project.summary.inventoryValue)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
