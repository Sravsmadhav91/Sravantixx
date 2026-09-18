import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { Authenticated } from "convex/react";
import { Link } from "react-router-dom";
import { ConvexError } from "convex/values";
import {
  BookOpen,
  ChevronRight,
  FileText,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  XCircle,
  CheckCircle,
  BookMarked,
  TrendingUp,
  Landmark,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx";
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
import { cn } from "@/lib/utils.ts";
import { formatCompactInr } from "@/lib/real-estate.ts";
import { formatDate } from "@/lib/format.ts";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_COLORS,
  ACCOUNT_GROUP_LABELS,
  TYPE_ORDER,
  VOUCHER_CONFIG,
  VOUCHER_TYPE_ORDER,
  type VoucherType,
} from "@/lib/accounting.ts";
import { useRole } from "@/hooks/use-role.ts";
import PageHeader from "@/components/page-header.tsx";
import AccountFormDialog from "./_components/account-form-dialog.tsx";
import JournalEntryDialog from "./_components/journal-entry-dialog.tsx";
import VoucherDialog from "./_components/voucher-dialog.tsx";
import CostCenterFormDialog from "./_components/cost-center-form-dialog.tsx";
import MigrationAccountDialog from "./_components/migration-account-dialog.tsx";
import MigrationVoucherDialog from "./_components/migration-voucher-dialog.tsx";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { useMigrationFinance } from "@/hooks/use-migration-finance.ts";
import {
  createMigrationJournalEntry,
  deleteMigrationAccount,
  deleteMigrationJournalEntry,
  updateMigrationJournalEntry,
} from "@/lib/migration-api.ts";
import { toast } from "sonner";

function MigrationAccountingLegacyPage() {
  const accounts = useMigrationFinance<any[]>("/api/accounting/accounts");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [narration, setNarration] = useState("");
  const [debit, setDebit] = useState("");
  const [credit, setCredit] = useState("");
  const [amount, setAmount] = useState("");
  const submit = async () => {
    if (!debit || !credit || !amount) {
      toast.error("Debit, credit, and amount are required");
      return;
    }
    try {
      await createMigrationJournalEntry({
        date,
        reference,
        narration,
        debitAccountId: debit,
        creditAccountId: credit,
        amount: Number(amount),
      });
      toast.success("Journal entry posted");
      setDialogOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not post journal entry",
      );
    }
  };
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Accounting"
        subtitle="Double-entry ledger, chart of accounts and journal entries"
        breadcrumbs={[{ label: "Accounting" }]}
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            New journal entry
          </Button>
        }
      />
      <div className="rounded-lg border bg-card p-3">
        <Input placeholder="Search by name or code..." />
      </div>
      {accounts === undefined ? (
        <Skeleton className="h-64 w-full" />
      ) : accounts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen />
            </EmptyMedia>
            <EmptyTitle>No accounts found</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border bg-card divide-y">
          {accounts.map((account) => (
            <div
              key={account._id}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <span className="w-14 font-mono text-xs text-muted-foreground">
                {account.code}
              </span>
              <span className="flex-1 text-sm font-medium">{account.name}</span>
              <span className="text-sm">
                {formatCompactInr(account.balance ?? 0)}
              </span>
              <Badge variant="secondary">{account.type}</Badge>
            </div>
          ))}
        </div>
      )}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg space-y-3 rounded-lg bg-card p-6">
            <h2 className="text-xl font-semibold">New Journal Entry</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <Input
                placeholder="Reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Narration"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
            />
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={debit}
              onChange={(e) => setDebit(e.target.value)}
            >
              <option value="">Debit account...</option>
              {(accounts ?? []).map((account) => (
                <option key={account._id} value={account._id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={credit}
              onChange={(e) => setCredit(e.target.value)}
            >
              <option value="">Credit account...</option>
              {(accounts ?? []).map((account) => (
                <option key={account._id} value={account._id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
            <Input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void submit()}>Post Entry</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MigrationAccountingPage() {
  const [tab, setTab] = useState<
    "accounts" | "cost-centers" | "journal" | "daybook"
  >("accounts");
  const [accountOpen, setAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>();
  const [accountSearch, setAccountSearch] = useState("");
  const [voucherType, setVoucherType] = useState<
    "sales" | "purchase" | "payment"
  >("payment");
  const [voucherOpen, setVoucherOpen] = useState(false);
  const accounts = useMigrationFinance<any[]>("/api/accounting/accounts");
  const balances = useMigrationFinance<any[]>("/api/accounting/balances");
  const entries = useMigrationFinance<any[]>(
    "/api/tables/journalEntries/records",
  );
  const projects = useMigrationFinance<Array<{ _id: string; name: string }>>("/api/projects");
  const journalLines = useMigrationFinance<any[]>(
    "/api/tables/journalLines/records",
  );
  const costCenters = useMigrationFinance<any[]>(
    "/api/tables/costCenters/records",
  );
  const balanceMap = new Map(
    (balances ?? []).map((balance) => [balance.accountId, balance.balance]),
  );
  const [entrySearch, setEntrySearch] = useState("");
  const [entryMonth, setEntryMonth] = useState("all");
  const [entryYear, setEntryYear] = useState("all");
  const [entryLedger, setEntryLedger] = useState("all");
  const [entryVoucherType, setEntryVoucherType] = useState("all");
  const [entryStatus, setEntryStatus] = useState("all");
  const ledgerOptions = (accounts ?? []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const entryYears = [...new Set((entries ?? []).map((entry) => String(entry.date || "").slice(0, 4)).filter(Boolean))].sort().reverse();
  const linesByEntry = new Map<string, any[]>();
  for (const line of journalLines ?? []) linesByEntry.set(line.journalEntryId, [...(linesByEntry.get(line.journalEntryId) ?? []), line]);
  const filteredEntries = (entries ?? []).filter((entry) => {
    const date = String(entry.date || "");
    const lines = linesByEntry.get(entry._id) ?? [];
    const text = `${entry.entryNumber ?? ""} ${entry.narration ?? ""} ${entry.reference ?? ""}`.toLowerCase();
    return (!entrySearch.trim() || text.includes(entrySearch.trim().toLowerCase())) &&
      (entryMonth === "all" || date.slice(5, 7) === entryMonth) &&
      (entryYear === "all" || date.slice(0, 4) === entryYear) &&
      (entryLedger === "all" || lines.some((line) => line.accountId === entryLedger)) &&
      (entryVoucherType === "all" || String(entry.voucherType || "manual") === entryVoucherType) &&
      (entryStatus === "all" || entry.status === entryStatus);
  }).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const { isOwner } = useRole();
  const removeAccount = async (account: any) => {
    if (!isOwner || !window.confirm(`Delete account ${account.name}?`)) return;
    try {
      await deleteMigrationAccount(account._id);
      toast.success("Account deleted");
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete account",
      );
    }
  };
  const removeEntry = async (entry: any) => {
    if (
      !isOwner ||
      !window.confirm(`Delete journal entry ${entry.entryNumber || entry._id}?`)
    )
      return;
    try {
      await deleteMigrationJournalEntry(entry._id);
      toast.success("Journal entry deleted");
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete journal entry",
      );
    }
  };
  const editEntry = async (entry: any) => {
    if (!isOwner) return;
    const narration = window.prompt("Narration", entry.narration || "");
    if (narration === null) return;
    try {
      await updateMigrationJournalEntry(entry._id, { narration });
      toast.success("Journal entry updated");
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update journal entry",
      );
    }
  };
  const assignEntryProject = async (entry: any) => {
    if (!isOwner) return;
    const currentProject = projects?.find((project) => project._id === entry.projectId);
    const projectName = window.prompt("Project name (leave blank to unlink)", currentProject?.name ?? "");
    if (projectName === null) return;
    const project = projects?.find((item) => item.name.trim().toLowerCase() === projectName.trim().toLowerCase());
    if (projectName.trim() && !project) { toast.error("Project not found. Enter an exact project name."); return; }
    try { await updateMigrationJournalEntry(entry._id, { projectId: project?._id }); toast.success("Project assignment updated"); window.location.reload(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not assign project"); }
  };
  const accountGroups = ["asset", "liability", "income", "expense", "equity"];
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Accounting"
        subtitle="Double-entry ledger, chart of accounts and journal entries"
        breadcrumbs={[{ label: "Accounting" }]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setEditingAccount(undefined);
                setAccountOpen(true);
              }}
            >
              <Plus className="size-4" />
              New Account
            </Button>
            <Button
              onClick={() => {
                setVoucherType("payment");
                setVoucherOpen(true);
              }}
            >
              <Plus className="size-4" />
              New Journal Entry
            </Button>
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted/60 p-1">
        <Button
          size="sm"
          variant={tab === "accounts" ? "default" : "ghost"}
          onClick={() => setTab("accounts")}
        >
          Chart of Accounts
        </Button>
        <Button
          size="sm"
          variant={tab === "cost-centers" ? "default" : "ghost"}
          onClick={() => setTab("cost-centers")}
        >
          Cost Centers
        </Button>
        <Button
          size="sm"
          variant={tab === "journal" ? "default" : "ghost"}
          onClick={() => setTab("journal")}
        >
          Journal Entries
        </Button>
        <Button
          size="sm"
          variant={tab === "daybook" ? "default" : "ghost"}
          onClick={() => setTab("daybook")}
        >
          Day Book
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setVoucherType("sales");
            setVoucherOpen(true);
          }}
        >
          + Sales
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setVoucherType("purchase");
            setVoucherOpen(true);
          }}
        >
          + Purchase
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setVoucherType("payment");
            setVoucherOpen(true);
          }}
        >
          + Payment
        </Button>
      </div>
      {tab === "accounts" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Chart of Accounts</CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setEditingAccount(undefined);
                  setAccountOpen(true);
                }}
              >
                <Plus className="size-4" />
                New Account
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or code…"
                className="pl-9"
                value={accountSearch}
                onChange={(event) => setAccountSearch(event.target.value)}
              />
            </div>
            {accounts === undefined ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="space-y-4">
                {accountGroups.map((group) => {
                  const rows = accounts.filter(
                    (account) =>
                      account.type === group &&
                      (`${account.name} ${account.code}`)
                        .toLowerCase()
                        .includes(accountSearch.toLowerCase().trim()),
                  );
                  if (!rows.length) return null;
                  return (
                    <div key={group}>
                      <div className="mb-1 flex items-center gap-2 text-sm font-semibold capitalize">
                        <span>{group}</span>
                        <Badge variant="secondary">
                          {rows.length} accounts
                        </Badge>
                      </div>
                      <div className="divide-y rounded-lg border">
                        {rows.map((account) => (
                          <div
                            key={account._id}
                            className="flex items-center gap-3 px-3 py-2 text-sm"
                          >
                            <span className="w-14 font-mono text-xs text-muted-foreground">
                              {account.code}
                            </span>
                            <span className="flex-1 font-medium">
                              {account.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {account.group}
                            </span>
                            <span className="tabular-nums">
                              {formatCompactInr(
                                Number(balanceMap.get(account._id) || 0),
                              )}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Edit ${account.name}`}
                              onClick={() => {
                                setEditingAccount(account);
                                setAccountOpen(true);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            {isOwner && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                aria-label={`Delete ${account.name}`}
                                onClick={() => void removeAccount(account)}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {tab === "cost-centers" && (
        <Card>
          <CardHeader>
            <CardTitle>Cost Centers</CardTitle>
          </CardHeader>
          <CardContent>
            {costCenters === undefined ? (
              <Skeleton className="h-48 w-full" />
            ) : costCenters.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BookOpen />
                  </EmptyMedia>
                  <EmptyTitle>No cost centers yet</EmptyTitle>
                  <EmptyDescription>
                    Create cost centers to tag transactions.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="divide-y rounded-lg border">
                {costCenters.map((center) => (
                  <div
                    key={center._id}
                    className="flex justify-between px-3 py-2 text-sm"
                  >
                    <span>{center.name}</span>
                    <Badge variant="secondary">{center.code || "Active"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {(tab === "journal" || tab === "daybook") && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>{tab === "journal" ? "Journal Entries" : "Day Book"}</CardTitle><span className="text-xs text-muted-foreground">{filteredEntries.length} entries</span></div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <Input placeholder="Search narration / ref..." value={entrySearch} onChange={(event) => setEntrySearch(event.target.value)} />
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={entryMonth} onChange={(event) => setEntryMonth(event.target.value)}><option value="all">All months</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={String(index + 1).padStart(2, "0")}>{new Date(2000, index).toLocaleString("en-IN", { month: "long" })}</option>)}</select>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={entryYear} onChange={(event) => setEntryYear(event.target.value)}><option value="all">All years</option>{entryYears.map((year) => <option key={year} value={year}>{year}</option>)}</select>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={entryLedger} onChange={(event) => setEntryLedger(event.target.value)}><option value="all">All ledgers</option>{ledgerOptions.map((account) => <option key={account._id} value={account._id}>{account.code} · {account.name}</option>)}</select>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={entryVoucherType} onChange={(event) => setEntryVoucherType(event.target.value)}><option value="all">All voucher types</option><option value="manual">Manual</option><option value="sales">Sales</option><option value="purchase">Purchase</option><option value="payment">Payment</option><option value="receipt">Receipt</option><option value="contra">Contra</option><option value="debit_note">Debit note</option><option value="credit_note">Credit note</option></select>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={entryStatus} onChange={(event) => setEntryStatus(event.target.value)}><option value="all">All statuses</option><option value="posted">Posted</option><option value="draft">Draft</option></select>
            </div>
            {entries === undefined || journalLines === undefined || accounts === undefined ? (
              <Skeleton className="h-48 w-full" />
            ) : filteredEntries.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BookOpen />
                  </EmptyMedia>
                  <EmptyTitle>No journal entries</EmptyTitle>
                  <EmptyDescription>
                    Post journal entries to see them here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="divide-y rounded-lg border">
                {filteredEntries.map((entry) => (
                    <div
                      key={entry._id}
                      className="flex items-center gap-3 px-3 py-2 text-sm"
                    >
                      <span className="w-24 text-xs text-muted-foreground">
                        {entry.date}
                      </span>
                      <span className="w-28 font-mono text-xs">
                        {entry.entryNumber || "—"}
                      </span>
                      <span className="flex-1 truncate">
                        {entry.narration || "Journal entry"}
                      </span>
                      <span className="tabular-nums font-semibold">
                        {formatCompactInr(
                          Number(entry.totalAmount || entry.totalDebit || 0),
                        )}
                      </span>
                      <Badge variant="secondary">
                        {entry.status || "posted"}
                      </Badge>
                      {isOwner && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => void assignEntryProject(entry)}>Project</Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void editEntry(entry)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => void removeEntry(entry)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <MigrationAccountDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        account={editingAccount}
      />
      <MigrationVoucherDialog
        open={voucherOpen}
        onOpenChange={setVoucherOpen}
        voucherType={voucherType}
      />
    </div>
  );
}

// ── Accounts Tab ─────────────────────────────────────────────────────────────

function AccountsTab() {
  const accounts = useQuery(api.accounting.listAccounts, {});
  const balances = useQuery(api.accounting.getAccountBalances, {});
  const seedAccounts = useMutation(api.accounting.seedDefaultAccounts);
  const deleteAccount = useMutation(api.accounting.deleteAccount);
  const updateAccount = useMutation(api.accounting.updateAccount);
  const { isOwner } = useRole();

  const [search, setSearch] = useState("");
  const [editingAccount, setEditingAccount] = useState<
    Doc<"accounts"> | undefined
  >();
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Id<"accounts"> | null>(
    null,
  );
  const [seedFailed, setSeedFailed] = useState(false);
  const hasSeededRef = useRef(false);

  // Auto-seed on first load. Convex's reactive query updates `accounts` once
  // the mutation inserts rows, so no local "seeding" state is needed — we
  // just avoid re-triggering the mutation and surface a failure if it errors.
  useEffect(() => {
    if (accounts === undefined || accounts.length > 0) return;
    if (hasSeededRef.current) return;
    hasSeededRef.current = true;
    seedAccounts({})
      .then(({ seeded }) => {
        if (seeded > 0) toast.success(`Seeded ${seeded} default accounts`);
      })
      .catch(() => setSeedFailed(true));
  }, [accounts, seedAccounts]);

  const balanceMap = new Map(
    balances?.map((b) => [b.accountId, b.balance]) ?? [],
  );

  const filteredAccounts =
    accounts?.filter(
      (a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.code.includes(search),
    ) ?? [];

  // Group by type
  const grouped = TYPE_ORDER.reduce<Record<string, typeof filteredAccounts>>(
    (acc, type) => {
      acc[type] = filteredAccounts.filter((a) => a.type === type);
      return acc;
    },
    {},
  );

  if (accounts === undefined || (accounts.length === 0 && !seedFailed)) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or code…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {isOwner && (
          <Button onClick={() => setNewAccountOpen(true)}>
            <Plus className="size-4" /> New Account
          </Button>
        )}
      </div>

      {filteredAccounts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen />
            </EmptyMedia>
            <EmptyTitle>No accounts found</EmptyTitle>
            <EmptyDescription>Try a different search term</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        TYPE_ORDER.map((type) => {
          const typeAccounts = grouped[type];
          if (!typeAccounts?.length) return null;
          return (
            <div key={type} className="space-y-1">
              <div className="flex items-center gap-2 pb-1">
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-semibold",
                    ACCOUNT_TYPE_COLORS[type],
                  )}
                >
                  {ACCOUNT_TYPE_LABELS[type]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {typeAccounts.length} accounts
                </span>
              </div>
              <div className="rounded-lg border bg-card divide-y">
                {typeAccounts.map((account) => {
                  const balance = balanceMap.get(account._id) ?? 0;
                  return (
                    <div
                      key={account._id}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40"
                    >
                      <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">
                        {account.code}
                      </span>
                      <Link
                        to={`/accounting/ledger/${account._id}`}
                        className="flex-1 text-sm font-medium hover:text-primary hover:underline"
                      >
                        {account.name}
                      </Link>
                      <span className="hidden text-xs text-muted-foreground sm:block">
                        {ACCOUNT_GROUP_LABELS[account.group]}
                      </span>
                      <span
                        className={cn(
                          "min-w-[90px] text-right text-sm font-medium tabular-nums",
                          balance < 0 ? "text-destructive" : "",
                        )}
                      >
                        {formatCompactInr(Math.abs(balance))}
                      </span>
                      {!account.isActive && (
                        <Badge variant="secondary" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                      {account.isSystem && (
                        <Badge variant="outline" className="text-xs">
                          System
                        </Badge>
                      )}
                      {isOwner && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => setEditingAccount(account)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          {!account.isSystem && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() =>
                                  updateAccount({
                                    accountId: account._id,
                                    isActive: !account.isActive,
                                  }).then(() =>
                                    toast.success(
                                      account.isActive
                                        ? "Account deactivated"
                                        : "Account activated",
                                    ),
                                  )
                                }
                              >
                                {account.isActive ? (
                                  <XCircle className="size-3.5 text-muted-foreground" />
                                ) : (
                                  <CheckCircle className="size-3.5 text-green-600" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 hover:text-destructive"
                                onClick={() => setConfirmDelete(account._id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      <AccountFormDialog
        open={newAccountOpen || !!editingAccount}
        onOpenChange={(o) => {
          if (!o) {
            setNewAccountOpen(false);
            setEditingAccount(undefined);
          } else setNewAccountOpen(true);
        }}
        editing={editingAccount}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Accounts with transactions cannot be
              deleted — deactivate them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await deleteAccount({ accountId: confirmDelete });
                  toast.success("Account deleted");
                } catch (err) {
                  if (err instanceof ConvexError) {
                    const { message } = err.data as { message: string };
                    toast.error(message);
                  } else {
                    toast.error("Failed to delete account");
                  }
                }
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Journal Entries Tab ───────────────────────────────────────────────────────

function JournalTab() {
  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
  );
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [newEntryOpen, setNewEntryOpen] = useState(false);

  const entries = useQuery(api.accounting.listJournalEntries, {
    fromDate,
    toDate,
  });
  const postEntry = useMutation(api.accounting.postJournalEntry);
  const cancelEntry = useMutation(api.accounting.cancelJournalEntry);
  const { isOwner } = useRole();

  const statusColor: Record<string, string> = {
    posted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    draft: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
    cancelled: "bg-muted text-muted-foreground line-through",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-36"
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-36"
          />
        </div>
        {isOwner && (
          <Button onClick={() => setNewEntryOpen(true)} className="ml-auto">
            <Plus className="size-4" /> New Entry
          </Button>
        )}
      </div>

      {entries === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>No journal entries</EmptyTitle>
            <EmptyDescription>
              No entries found in this date range
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {isOwner && (
              <Button size="sm" onClick={() => setNewEntryOpen(true)}>
                <Plus className="size-4" /> New Entry
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <div className="rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Entry No.</th>
                <th className="px-3 py-2">Narration</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Status</th>
                {isOwner && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((entry) => (
                <tr key={entry._id} className="hover:bg-muted/40">
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDate(entry.date)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {entry.entryNumber}
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate">
                    {entry.narration}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCompactInr(entry.totalAmount)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        statusColor[entry.status],
                      )}
                    >
                      {entry.status.charAt(0).toUpperCase() +
                        entry.status.slice(1)}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {entry.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              postEntry({ entryId: entry._id }).then(() =>
                                toast.success("Entry posted"),
                              )
                            }
                          >
                            Post
                          </Button>
                        )}
                        {entry.status !== "cancelled" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              cancelEntry({ entryId: entry._id }).then(() =>
                                toast.success("Entry cancelled"),
                              )
                            }
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <JournalEntryDialog open={newEntryOpen} onOpenChange={setNewEntryOpen} />
    </div>
  );
}

// ── Day Book Tab ──────────────────────────────────────────────────────────────

function DayBookTab() {
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const data = useQuery(api.accounting.getDayBook, { fromDate, toDate });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="w-36"
        />
        <span className="text-muted-foreground">to</span>
        <Input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="w-36"
        />
      </div>

      {data === undefined ? (
        <Skeleton className="h-48 w-full" />
      ) : data.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookMarked />
            </EmptyMedia>
            <EmptyTitle>No entries for this period</EmptyTitle>
            <EmptyDescription>
              Post journal entries to see them here
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          {data.map((entry) => (
            <Card key={entry._id}>
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground">
                      {entry.entryNumber}
                    </span>
                    <span className="text-sm font-medium">
                      {entry.narration}
                    </span>
                    {entry.reference && (
                      <span className="text-xs text-muted-foreground">
                        Ref: {entry.reference}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(entry.date)}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {entry.lines.map((line) => (
                      <tr
                        key={line._id}
                        className="border-b last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-4 py-1.5 font-mono text-xs text-muted-foreground w-16">
                          {line.accountCode}
                        </td>
                        <td className="px-2 py-1.5 text-sm">
                          {line.accountName}
                        </td>
                        <td className="px-4 py-1.5 text-right tabular-nums text-sm">
                          {line.side === "debit"
                            ? formatCompactInr(line.amount)
                            : ""}
                        </td>
                        <td className="px-4 py-1.5 text-right tabular-nums text-sm">
                          {line.side === "credit"
                            ? formatCompactInr(line.amount)
                            : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/20 font-semibold text-xs">
                      <td
                        colSpan={2}
                        className="px-4 py-1.5 text-right text-muted-foreground"
                      >
                        Total
                      </td>
                      <td className="px-4 py-1.5 text-right tabular-nums">
                        {formatCompactInr(entry.totalAmount)}
                      </td>
                      <td className="px-4 py-1.5 text-right tabular-nums">
                        {formatCompactInr(entry.totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Cost Centers Tab ──────────────────────────────────────────────────────────

function CostCentersTab() {
  const centers = useQuery(api.accounting.listCostCenters, {});
  const updateCostCenter = useMutation(api.accounting.updateCostCenter);
  const deleteCostCenter = useMutation(api.accounting.deleteCostCenter);
  const { isOwner } = useRole();

  const [editingCenter, setEditingCenter] = useState<
    Doc<"costCenters"> | undefined
  >();
  const [newCenterOpen, setNewCenterOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Id<"costCenters"> | null>(
    null,
  );

  if (centers === undefined) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Tag journal lines with a cost center to see income and expenses by
          department, function, or team.
        </p>
        {isOwner && (
          <Button onClick={() => setNewCenterOpen(true)} className="shrink-0">
            <Plus className="size-4" /> New Cost Center
          </Button>
        )}
      </div>

      {centers.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Landmark />
            </EmptyMedia>
            <EmptyTitle>No cost centers yet</EmptyTitle>
            <EmptyDescription>
              Create cost centers like Sales, Admin, or Marketing to tag
              transactions.
            </EmptyDescription>
          </EmptyHeader>
          {isOwner && (
            <EmptyContent>
              <Button size="sm" onClick={() => setNewCenterOpen(true)}>
                <Plus className="size-4" /> New Cost Center
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="rounded-lg border bg-card divide-y">
          {centers.map((center) => (
            <div
              key={center._id}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40"
            >
              <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                {center.code}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{center.name}</p>
                {center.description && (
                  <p className="truncate text-xs text-muted-foreground">
                    {center.description}
                  </p>
                )}
              </div>
              {!center.isActive && (
                <Badge variant="secondary" className="text-xs">
                  Inactive
                </Badge>
              )}
              {isOwner && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setEditingCenter(center)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() =>
                      updateCostCenter({
                        costCenterId: center._id,
                        isActive: !center.isActive,
                      }).then(() =>
                        toast.success(
                          center.isActive
                            ? "Cost center deactivated"
                            : "Cost center activated",
                        ),
                      )
                    }
                  >
                    {center.isActive ? (
                      <XCircle className="size-3.5 text-muted-foreground" />
                    ) : (
                      <CheckCircle className="size-3.5 text-green-600" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 hover:text-destructive"
                    onClick={() => setConfirmDelete(center._id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CostCenterFormDialog
        open={newCenterOpen || !!editingCenter}
        onOpenChange={(o) => {
          if (!o) {
            setNewCenterOpen(false);
            setEditingCenter(undefined);
          } else setNewCenterOpen(true);
        }}
        editing={editingCenter}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete cost center?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Cost centers with transactions cannot be
              deleted — deactivate them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await deleteCostCenter({ costCenterId: confirmDelete });
                  toast.success("Cost center deleted");
                } catch (err) {
                  if (err instanceof ConvexError) {
                    const { message } = err.data as { message: string };
                    toast.error(message);
                  } else {
                    toast.error("Failed to delete cost center");
                  }
                }
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Vouchers Tab ──────────────────────────────────────────────────────────────

const VOUCHER_STATUS_COLOR: Record<string, string> = {
  posted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  cancelled: "bg-muted text-muted-foreground line-through",
};

function VouchersTab() {
  const [typeFilter, setTypeFilter] = useState<VoucherType | "all">("all");
  const [openType, setOpenType] = useState<VoucherType | null>(null);
  const { isOwner } = useRole();

  const vouchers = useQuery(api.accounting.listVouchers, {
    voucherType: typeFilter === "all" ? undefined : typeFilter,
  });
  const cancelEntry = useMutation(api.accounting.cancelJournalEntry);
  const postEntry = useMutation(api.accounting.postJournalEntry);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTypeFilter("all")}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
            typeFilter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          )}
        >
          All Vouchers
        </button>
        {VOUCHER_TYPE_ORDER.map((vt) => (
          <button
            key={vt}
            onClick={() => setTypeFilter(vt)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              typeFilter === vt
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            {VOUCHER_CONFIG[vt].label.replace(" Voucher", "")}
          </button>
        ))}
        {isOwner && (
          <div className="ml-auto flex flex-wrap gap-2">
            {VOUCHER_TYPE_ORDER.map((vt) => (
              <Button
                key={vt}
                size="sm"
                variant="secondary"
                onClick={() => setOpenType(vt)}
              >
                <Plus className="size-3.5" />{" "}
                {VOUCHER_CONFIG[vt].label.replace(" Voucher", "")}
              </Button>
            ))}
          </div>
        )}
      </div>

      {vouchers === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : vouchers.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Receipt />
            </EmptyMedia>
            <EmptyTitle>No vouchers yet</EmptyTitle>
            <EmptyDescription>
              Create a sales, purchase, payment, receipt, contra, or note
              voucher
            </EmptyDescription>
          </EmptyHeader>
          {isOwner && (
            <EmptyContent>
              <Button size="sm" onClick={() => setOpenType("payment")}>
                <Plus className="size-4" /> New Voucher
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Voucher No.</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Party / Account</th>
                <th className="px-3 py-2">Narration</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Status</th>
                {isOwner && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {vouchers.map((entry) => (
                <tr key={entry._id} className="hover:bg-muted/40">
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDate(entry.date)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {entry.entryNumber}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {entry.voucherType
                      ? VOUCHER_CONFIG[entry.voucherType].label.replace(
                          " Voucher",
                          "",
                        )
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {entry.primaryAccountName ?? "—"}
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate">
                    {entry.narration}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCompactInr(entry.totalAmount)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        VOUCHER_STATUS_COLOR[entry.status],
                      )}
                    >
                      {entry.status.charAt(0).toUpperCase() +
                        entry.status.slice(1)}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {entry.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              postEntry({ entryId: entry._id }).then(() =>
                                toast.success("Voucher posted"),
                              )
                            }
                          >
                            Post
                          </Button>
                        )}
                        {entry.status !== "cancelled" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              cancelEntry({ entryId: entry._id }).then(() =>
                                toast.success("Voucher cancelled"),
                              )
                            }
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openType && (
        <VoucherDialog
          open={!!openType}
          onOpenChange={(o) => !o && setOpenType(null)}
          voucherType={openType}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AccountingPage() {
  if (migrationApiEnabled) return <MigrationAccountingPage />;
  return (
    <Authenticated>
      <AccountingPageInner />
    </Authenticated>
  );
}

function AccountingPageInner() {
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const { isOwner } = useRole();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Accounting"
        subtitle="Double-entry ledger, chart of accounts and journal entries"
        actions={
          isOwner ? (
            <Button onClick={() => setNewEntryOpen(true)}>
              <Plus className="size-4" /> New Journal Entry
            </Button>
          ) : undefined
        }
      />

      {/* Quick nav to ledger */}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link to="/accounting/ledger">
            <TrendingUp className="size-4" /> Account Ledger
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="vouchers">
        <TabsList>
          <TabsTrigger value="vouchers">Vouchers</TabsTrigger>
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="cost-centers">Cost Centers</TabsTrigger>
          <TabsTrigger value="journal">Journal Entries</TabsTrigger>
          <TabsTrigger value="daybook">Day Book</TabsTrigger>
        </TabsList>

        <TabsContent value="vouchers" className="mt-4">
          <VouchersTab />
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          <AccountsTab />
        </TabsContent>

        <TabsContent value="cost-centers" className="mt-4">
          <CostCentersTab />
        </TabsContent>

        <TabsContent value="journal" className="mt-4">
          <JournalTab />
        </TabsContent>

        <TabsContent value="daybook" className="mt-4">
          <DayBookTab />
        </TabsContent>
      </Tabs>

      <JournalEntryDialog open={newEntryOpen} onOpenChange={setNewEntryOpen} />
    </div>
  );
}
