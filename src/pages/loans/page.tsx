import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { HandCoins, Plus, CircleCheck, XCircle } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
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
import { useMigrationLoans } from "@/hooks/use-migration-loans.ts";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import { LOAN_STATUS_LABELS, LOAN_STATUS_COLORS, INSTALLMENT_STATUS_COLORS } from "@/lib/loans.ts";
import { cn } from "@/lib/utils.ts";
import LoanDialog from "./_components/loan-dialog.tsx";
import RecordEmiDialog from "./_components/record-emi-dialog.tsx";
import MigrationLoanDialog from "./_components/migration-loan-dialog.tsx";

export default function LoansPage() {
  if (migrationApiEnabled) {
    return <MigrationLoansPage />;
  }
  return <LoansInner />;
}

function MigrationLoansPage() {
  const { loans, error } = useMigrationLoans();
  const [createOpen, setCreateOpen] = useState(false);
  if (error) return <div className="p-8 text-sm text-destructive">{error.message}</div>;
  if (loans === undefined) return <div className="mx-auto w-full max-w-4xl space-y-4 p-4 md:p-8"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>;
  return <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8"><div className="flex flex-wrap items-end justify-between gap-3"><div className="space-y-1"><h1 className="font-serif text-3xl font-semibold tracking-tight">Loan Management</h1><p className="text-sm text-muted-foreground">Track company loans, EMI schedules, and repayments.</p></div><Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-4" /> New loan</Button></div>{loans.length === 0 ? <Empty><EmptyHeader><EmptyMedia variant="icon"><HandCoins /></EmptyMedia><EmptyTitle>No loans yet</EmptyTitle><EmptyDescription>Record a business loan to generate its EMI schedule automatically.</EmptyDescription></EmptyHeader><EmptyContent><Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-4" /> New loan</Button></EmptyContent></Empty> : <div className="space-y-2">{loans.map((loan) => <div key={loan._id} className="rounded-lg border border-border bg-card px-4 py-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1 space-y-1"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{loan.lenderName}</span><Badge className={cn("text-[10px] font-semibold", LOAN_STATUS_COLORS[loan.status ?? "active"])}>{LOAN_STATUS_LABELS[loan.status ?? "active"]}</Badge></div><p className="text-xs text-muted-foreground">{loan.interestRatePercent}% p.a. · {loan.tenureMonths} months · EMI {formatCompactInr(loan.emiAmount)}{loan.projectName ? ` · ${loan.projectName}` : ""}</p><div className="flex items-center gap-2 pt-1"><div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${loan.principal > 0 ? Math.min(100, ((loan.principal - loan.outstandingPrincipal) / loan.principal) * 100) : 0}%` }} /></div><span className="text-[11px] text-muted-foreground">{formatCompactInr(loan.principal - loan.outstandingPrincipal)} of {formatCompactInr(loan.principal)} repaid</span></div></div><div className="text-right"><p className="text-xs text-muted-foreground">Outstanding</p><p className="font-mono text-sm font-semibold tabular-nums">{formatCompactInr(loan.outstandingPrincipal)}</p></div></div></div>)}</div>}<MigrationLoanDialog open={createOpen} onOpenChange={setCreateOpen} /></div>;
}

function LoansInner() {
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState<Id<"loans"> | null>(null);
  const [payInstallment, setPayInstallment] = useState<Doc<"loanInstallments"> | null>(null);
  const [deleteId, setDeleteId] = useState<Id<"loans"> | null>(null);

  const loans = useQuery(api.loans.listLoans, {});
  const detail = useQuery(api.loans.getLoan, expanded ? { loanId: expanded } : "skip");
  const deleteLoan = useMutation(api.loans.deleteLoan);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteLoan({ loanId: deleteId });
      toast.success("Loan deleted");
      setDeleteId(null);
    } catch (error) {
      toast.error(error instanceof ConvexError ? (error.data as { message: string }).message : "Could not delete loan");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Loan Management</h1>
          <p className="text-sm text-muted-foreground">
            Track company loans, EMI schedules, and repayments.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> New loan
        </Button>
      </div>

      {loans === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : loans.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HandCoins />
            </EmptyMedia>
            <EmptyTitle>No loans yet</EmptyTitle>
            <EmptyDescription>Record a business loan to generate its EMI schedule automatically.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> New loan
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-2">
          {loans.map((loan) => {
            const isOpen = expanded === loan._id;
            const paidPct = loan.principal > 0 ? Math.min(100, ((loan.principal - loan.outstandingPrincipal) / loan.principal) * 100) : 0;
            return (
              <div key={loan._id} className="rounded-lg border border-border bg-card px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 space-y-1 text-left"
                    onClick={() => setExpanded(isOpen ? null : loan._id)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{loan.lenderName}</span>
                      <Badge className={cn("text-[10px] font-semibold", LOAN_STATUS_COLORS[loan.status])}>
                        {LOAN_STATUS_LABELS[loan.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {loan.interestRatePercent}% p.a. · {loan.tenureMonths} {loan.emiFrequency === "monthly" ? "monthly" : "quarterly"} EMIs of {formatCompactInr(loan.emiAmount)}
                      {loan.projectName ? ` · ${loan.projectName}` : ""}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${paidPct}%` }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {formatCompactInr(loan.principal - loan.outstandingPrincipal)} of {formatCompactInr(loan.principal)} repaid
                      </span>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Outstanding</p>
                      <p className="font-mono text-sm font-semibold tabular-nums">{formatCompactInr(loan.outstandingPrincipal)}</p>
                    </div>
                    {loan.status === "active" && loan.outstandingPrincipal === loan.principal && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(loan._id)}
                      >
                        <XCircle className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-3 border-t border-border pt-3">
                    {detail === undefined ? (
                      <Skeleton className="h-24 w-full" />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-[11px] font-medium text-muted-foreground">
                              <th className="py-1.5 text-left">#</th>
                              <th className="py-1.5 text-left">Due date</th>
                              <th className="py-1.5 text-right">Principal</th>
                              <th className="py-1.5 text-right">Interest</th>
                              <th className="py-1.5 text-right">Total</th>
                              <th className="py-1.5 text-center">Status</th>
                              <th className="py-1.5 w-8"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {detail?.installments.map((inst) => (
                              <tr key={inst._id}>
                                <td className="py-1.5">{inst.installmentNumber}</td>
                                <td className="py-1.5">{formatDate(inst.dueDate)}</td>
                                <td className="py-1.5 text-right font-mono tabular-nums">{formatCompactInr(inst.principalComponent)}</td>
                                <td className="py-1.5 text-right font-mono tabular-nums">{formatCompactInr(inst.interestComponent)}</td>
                                <td className="py-1.5 text-right font-mono font-semibold tabular-nums">{formatCompactInr(inst.totalAmount)}</td>
                                <td className="py-1.5 text-center">
                                  <Badge className={cn("text-[10px]", INSTALLMENT_STATUS_COLORS[inst.status])}>
                                    {inst.status}
                                  </Badge>
                                </td>
                                <td className="py-1.5">
                                  {inst.status !== "paid" && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-6 text-green-600"
                                      onClick={() => setPayInstallment(inst)}
                                    >
                                      <CircleCheck className="size-3.5" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <LoanDialog open={createOpen} onOpenChange={setCreateOpen} />
      <RecordEmiDialog
        open={!!payInstallment}
        onOpenChange={(v) => {
          if (!v) setPayInstallment(null);
        }}
        installment={payInstallment}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this loan?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the loan and its full repayment schedule. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

