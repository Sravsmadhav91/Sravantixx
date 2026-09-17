import { useState } from "react";
import { useQuery, useMutation, Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Users, Plus, Pencil, CheckCircle, XCircle, CalendarClock, Wallet } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { SignInButton } from "@/components/ui/signin.tsx";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { useRole } from "@/hooks/use-role.ts";
import { useMigrationPayroll } from "@/hooks/use-migration-payroll.ts";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import EmployeeFormDialog from "./_components/employee-form-dialog.tsx";
import NewPayrollRunDialog from "./_components/new-payroll-run-dialog.tsx";
import PayrollRunDialog from "./_components/payroll-run-dialog.tsx";
import MigrationEmployeeDialog from "./_components/migration-employee-dialog.tsx";
import MigrationPayrollRunDialog from "./_components/migration-payroll-run-dialog.tsx";

const RUN_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  finalized: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  paid: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

export default function PayrollPage() {
  if (migrationApiEnabled) {
    return <MigrationPayrollPage />;
  }
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Payroll"
        subtitle="Employee salary structures, monthly payroll runs, PF/ESI deductions, and payslips"
        breadcrumbs={[{ label: "Payroll" }]}
      />
      <AuthLoading>
        <Skeleton className="h-64 w-full" />
      </AuthLoading>
      <Unauthenticated>
        <SignInButton />
      </Unauthenticated>
      <Authenticated>
        <PayrollInner />
      </Authenticated>
    </div>
  );
}

function MigrationPayrollPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  return (
    <>
      <MigrationPayrollPageContent />
      <Button className="fixed bottom-6 right-6 z-20 shadow-lg" onClick={() => setCreateOpen(true)}>
        <Plus className="size-4" /> New Employee
      </Button>
      <Button className="fixed bottom-6 right-48 z-20 shadow-lg" variant="secondary" onClick={() => setRunOpen(true)}>
        <Wallet className="size-4" /> New Payroll Run
      </Button>
      <MigrationEmployeeDialog open={createOpen} onOpenChange={setCreateOpen} />
      <MigrationPayrollRunDialog open={runOpen} onOpenChange={setRunOpen} />
    </>
  );
}

function MigrationPayrollPageContent() {
  const { employees, runs, error } = useMigrationPayroll();
  if (error) return <div className="p-8 text-sm text-destructive">{error.message}</div>;
  if (employees === undefined || runs === undefined) return <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-8"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>;
  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8"><PageHeader title="Payroll" subtitle="Employee salary structures, monthly payroll runs, PF/ESI deductions, and payslips" breadcrumbs={[{ label: "Payroll" }]} /><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[{ label: "Active Employees", value: String(employees.filter((e) => e.isActive !== false).length), color: "text-foreground" }, { label: "Payroll Runs", value: String(runs.length), color: "text-foreground" }, { label: "Latest Net Pay", value: runs.length > 0 ? formatCompactInr(runs[0].totalNetPay) : "—", color: "text-primary" }].map((s) => <div key={s.label} className="rounded-lg border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">{s.label}</p><p className="mt-0.5 text-xl font-bold tabular-nums">{s.value}</p></div>)}</div><div className="rounded-lg border bg-card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium uppercase text-muted-foreground"><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Designation</th><th className="px-3 py-2 text-right">Gross Salary</th><th className="px-3 py-2">PF / ESI</th><th className="px-3 py-2">Status</th></tr></thead><tbody className="divide-y">{employees.map((e) => { const gross = (e.basic ?? 0) + (e.hra ?? 0) + (e.conveyance ?? 0) + (e.specialAllowance ?? 0) + (e.otherAllowances ?? 0); return <tr key={e._id} className="hover:bg-muted/30"><td className="px-3 py-2"><span className="font-medium">{e.name}</span><span className="ml-1.5 font-mono text-xs text-muted-foreground">{e.employeeCode}</span></td><td className="px-3 py-2 text-xs text-muted-foreground">{e.designation ?? "—"}</td><td className="px-3 py-2 text-right tabular-nums text-xs font-semibold">{formatCompactInr(gross)}</td><td className="px-3 py-2 text-xs text-muted-foreground">{e.pfApplicable ? "PF" : ""}{e.pfApplicable && e.esiApplicable ? " · " : ""}{e.esiApplicable ? "ESI" : ""}{!e.pfApplicable && !e.esiApplicable ? "—" : ""}</td><td className="px-3 py-2">{e.isActive === false ? <Badge variant="secondary">Inactive</Badge> : <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Active</Badge>}</td></tr>})}</tbody></table></div></div>;
}

function PayrollInner() {
  const { isOwner } = useRole();
  const [tab, setTab] = useState<"employees" | "runs">("employees");

  const [employeeDialog, setEmployeeDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Doc<"employees"> | undefined>();
  const [newRunDialog, setNewRunDialog] = useState(false);
  const [openRunId, setOpenRunId] = useState<Id<"payrollRuns"> | null>(null);

  const employees = useQuery(api.payroll.listEmployees, {});
  const runs = useQuery(api.payroll.listPayrollRuns, {});
  const setActive = useMutation(api.payroll.setEmployeeActive);

  const handleToggleActive = async (employee: Doc<"employees">) => {
    try {
      await setActive({
        employeeId: employee._id,
        isActive: !employee.isActive,
        dateOfLeaving: employee.isActive ? new Date().toISOString().slice(0, 10) : undefined,
      });
      toast.success(employee.isActive ? "Employee deactivated" : "Employee reactivated");
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to update employee");
      }
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active Employees", value: String(employees?.filter((e) => e.isActive).length ?? "—") },
          { label: "Payroll Runs", value: String(runs?.length ?? "—") },
          { label: "Latest Net Pay", value: runs && runs.length > 0 ? formatCompactInr(runs[0].totalNetPay) : "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="employees"><Users className="size-3.5" /> Employees</TabsTrigger>
            <TabsTrigger value="runs"><CalendarClock className="size-3.5" /> Payroll Runs</TabsTrigger>
          </TabsList>
          {isOwner && tab === "employees" && (
            <Button size="sm" onClick={() => { setEditingEmployee(undefined); setEmployeeDialog(true); }}>
              <Plus className="size-4" /> New Employee
            </Button>
          )}
          {isOwner && tab === "runs" && (
            <Button size="sm" onClick={() => setNewRunDialog(true)}>
              <Wallet className="size-4" /> New Payroll Run
            </Button>
          )}
        </div>

        {/* EMPLOYEES TAB */}
        <TabsContent value="employees" className="mt-4">
          {employees === undefined ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : employees.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Users /></EmptyMedia>
                <EmptyTitle>No employees yet</EmptyTitle>
                <EmptyDescription>Add employees to build salary structures and run payroll.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => { setEditingEmployee(undefined); setEmployeeDialog(true); }}>
                  <Plus className="size-4" /> New Employee
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase">
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Designation</th>
                    <th className="px-3 py-2 text-right">Gross Salary</th>
                    <th className="px-3 py-2">PF / ESI</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employees.map((e) => {
                    const gross = e.basic + e.hra + e.conveyance + e.specialAllowance + e.otherAllowances;
                    return (
                      <tr key={e._id} className="hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <span className="font-medium">{e.name}</span>
                          <span className="ml-1.5 font-mono text-xs text-muted-foreground">{e.employeeCode}</span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{e.designation}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold">{formatCompactInr(gross)}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {e.pfApplicable ? "PF" : ""}{e.pfApplicable && e.esiApplicable ? " · " : ""}{e.esiApplicable ? "ESI" : ""}
                          {!e.pfApplicable && !e.esiApplicable && "—"}
                        </td>
                        <td className="px-3 py-2">
                          {e.isActive ? <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                        </td>
                        <td className="px-2 py-2">
                          {isOwner && (
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditingEmployee(e); setEmployeeDialog(true); }}>
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="size-7" onClick={() => handleToggleActive(e)}>
                                {e.isActive ? <XCircle className="size-3.5 text-muted-foreground" /> : <CheckCircle className="size-3.5 text-green-600" />}
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* PAYROLL RUNS TAB */}
        <TabsContent value="runs" className="mt-4">
          {runs === undefined ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : runs.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><CalendarClock /></EmptyMedia>
                <EmptyTitle>No payroll runs yet</EmptyTitle>
                <EmptyDescription>Create a monthly payroll run to generate payslips for active employees.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setNewRunDialog(true)}>
                  <Wallet className="size-4" /> New Payroll Run
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-card divide-y">
              {runs.map((run) => (
                <button
                  key={run._id}
                  type="button"
                  onClick={() => setOpenRunId(run._id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 text-left cursor-pointer"
                >
                  <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{run.month}</p>
                    <p className="text-xs text-muted-foreground">
                      {run.finalizedDate ? `Finalized ${formatDate(run.finalizedDate)}` : "Not finalized"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatCompactInr(run.totalNetPay)}</span>
                  <Badge className={RUN_STATUS_COLORS[run.status]}>{run.status}</Badge>
                </button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <EmployeeFormDialog
        open={employeeDialog}
        onOpenChange={(o) => { setEmployeeDialog(o); if (!o) setEditingEmployee(undefined); }}
        editing={editingEmployee}
      />
      <NewPayrollRunDialog open={newRunDialog} onOpenChange={setNewRunDialog} onCreated={(id) => setOpenRunId(id)} />
      <PayrollRunDialog open={!!openRunId} onOpenChange={(o) => !o && setOpenRunId(null)} payrollRunId={openRunId} />
    </>
  );
}
