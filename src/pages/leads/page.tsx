import { useState } from "react";
import { useQuery, usePaginatedQuery } from "convex/react";
import {
  CalendarDays,
  Edit2,
  Phone,
  Plus,
  Trash2,
  TrendingUp,
  UserCheck,
  UserCog,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { cn } from "@/lib/utils.ts";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_CLASSES,
  LEAD_SOURCE_LABELS,
  ALL_STATUSES,
  type LeadStatus,
} from "@/lib/leads.ts";
import LeadCard from "./_components/lead-card.tsx";
import LeadFormDialog from "./_components/lead-form-dialog.tsx";
import LoadMoreButton from "@/components/load-more-button.tsx";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { useMigrationLeads } from "@/hooks/use-migration-leads.ts";
import {
  convertMigrationLead,
  createMigrationLead,
  deleteMigrationLead,
  updateMigrationLead,
  updateMigrationLeadStatus,
} from "@/lib/migration-api.ts";
import { toast } from "sonner";

function MigrationLeadsPage() {
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [search, setSearch] = useState("");
  const leads = useMigrationLeads(status, search.trim());
  const [followUpsToday, setFollowUpsToday] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    source: "walk_in",
    status: "new",
    budget: "",
    projectInterest: "",
    notes: "",
    lastFollowUpAt: "",
  });
  const resetForm = (lead?: any) =>
    setForm({
      name: lead?.name ?? "",
      phone: lead?.phone ?? "",
      email: lead?.email ?? "",
      source: lead?.source ?? "walk_in",
      status: lead?.status ?? "new",
      budget: lead?.budget ? String(lead.budget) : "",
      projectInterest: lead?.projectInterest ?? "",
      notes: lead?.notes ?? "",
      lastFollowUpAt: lead?.lastFollowUpAt
        ? String(lead.lastFollowUpAt).slice(0, 10)
        : "",
    });
  const openAdd = () => {
    resetForm();
    setEditingLead(null);
    setAddOpen(true);
  };
  const openEdit = (lead: any) => {
    resetForm(lead);
    setEditingLead(lead);
    setAddOpen(true);
  };
  const submit = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    try {
      const payload = {
        ...form,
        budget: form.budget ? Number(form.budget) : undefined,
        lastFollowUpAt: form.lastFollowUpAt || undefined,
      };
      if (editingLead) {
        await updateMigrationLead(editingLead._id, payload);
        toast.success("Lead updated");
      } else {
        await createMigrationLead(payload);
        toast.success("Lead added");
      }
      setAddOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save lead",
      );
    }
  };
  const changeStatus = async (lead: any, nextStatus: string) => {
    try {
      await updateMigrationLeadStatus(lead._id, nextStatus);
      toast.success("Lead status updated");
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update status",
      );
    }
  };
  const remove = async (lead: any) => {
    if (!window.confirm(`Delete ${lead.name}?`)) return;
    try {
      await deleteMigrationLead(lead._id);
      toast.success("Lead deleted");
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete lead",
      );
    }
  };
  const convert = async (lead: any) => {
    try {
      const result = await convertMigrationLead(lead._id);
      toast.success("Lead converted to buyer");
      window.location.href = `/buyers/${result.buyerId}`;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not convert lead",
      );
    }
  };
  const counts = ALL_STATUSES.reduce<Record<string, number>>(
    (result, value) => {
      result[value] =
        leads?.filter((lead) => lead.status === value).length ?? 0;
      return result;
    },
    {},
  );
  const today = new Date().toISOString().slice(0, 10);
  const todayFollowUpCount =
    leads?.filter(
      (lead) => String(lead.lastFollowUpAt || "").slice(0, 10) === today,
    ).length ?? 0;
  const visibleLeads = leads?.filter(
    (lead) =>
      !followUpsToday ||
      String(lead.lastFollowUpAt || "").slice(0, 10) === today,
  );
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Lead Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Track enquiries from first contact to booking.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="size-4" />
          Add lead
        </Button>
      </div>
      {leads && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-7">
          {ALL_STATUSES.map((value) => (
            <button
              key={value}
              onClick={() => {
                setFollowUpsToday(false);
                setStatus(value);
              }}
              className={cn(
                "rounded-lg border px-3 py-2 text-left",
                status === value
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card",
              )}
            >
              <p
                className={cn(
                  "text-xs font-medium",
                  LEAD_STATUS_CLASSES[value],
                )}
              >
                {LEAD_STATUS_LABELS[value]}
              </p>
              <p className="text-2xl font-semibold">{counts[value] ?? 0}</p>
            </button>
          ))}
          <button
            onClick={() => {
              setFollowUpsToday((value) => !value);
              setStatus("all");
              setSearch("");
            }}
            className={cn(
              "rounded-lg border px-3 py-2 text-left",
              followUpsToday
                ? "border-primary bg-primary/5"
                : "border-border bg-card",
            )}
          >
            <p className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              <CalendarDays className="size-3.5" />
              Follow-ups today
            </p>
            <p className="text-2xl font-semibold">{todayFollowUpCount}</p>
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name or mobile..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-sm text-muted-foreground">
          {visibleLeads?.length ?? 0} leads
          {followUpsToday ? " with follow-ups today" : ""}
        </span>
      </div>
      {leads === undefined ? (
        <Skeleton className="h-52 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Lead name</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3">Project interest</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last follow-up</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleLeads?.map((lead, index) => (
                <tr
                  key={lead._id}
                  className="border-b last:border-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    L{String(index + 1).padStart(3, "0")}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {lead.name}
                    <div className="text-xs text-muted-foreground">
                      {lead.email || ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                      href={`tel:${lead.phone}`}
                    >
                      <Phone className="size-3.5" />
                      {lead.phone}
                    </a>
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3">
                    {lead.projectInterest || "-"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {LEAD_SOURCE_LABELS[
                      lead.source as keyof typeof LEAD_SOURCE_LABELS
                    ] ||
                      lead.source ||
                      "-"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {lead.budget
                      ? `₹${Number(lead.budget).toLocaleString("en-IN")}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Status for ${lead.name}`}
                      value={lead.status || "new"}
                      onChange={(event) =>
                        void changeStatus(lead, event.target.value)
                      }
                      className={cn(
                        "rounded-full border-0 px-2 py-1 text-xs font-medium",
                        LEAD_STATUS_CLASSES[lead.status as LeadStatus],
                      )}
                    >
                      {ALL_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {LEAD_STATUS_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {lead.lastFollowUpAt
                      ? new Date(lead.lastFollowUpAt).toLocaleDateString(
                          "en-IN",
                        )
                      : lead.lastActivityAt
                        ? new Date(lead.lastActivityAt).toLocaleDateString(
                            "en-IN",
                          )
                        : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Call ${lead.name}`}
                      >
                        <a href={`tel:${lead.phone}`}>
                          <Phone className="size-4" />
                        </a>
                      </Button>
                      {lead.convertedBuyerId ? (
                        <Button asChild variant="secondary" size="sm">
                          <a href={`/buyers/${lead.convertedBuyerId}`}>Buyer</a>
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void convert(lead)}
                        >
                          <UserCheck className="size-3.5" />
                          Convert
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openEdit(lead)}
                        aria-label={`Edit ${lead.name}`}
                      >
                        <Edit2 className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => void remove(lead)}
                        aria-label={`Delete ${lead.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleLeads?.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No leads found.
            </p>
          )}
        </div>
      )}{" "}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg space-y-3 rounded-lg bg-card p-6">
            <h2 className="text-xl font-semibold">
              {editingLead ? "Edit lead" : "Add new lead"}
            </h2>
            <Input
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Phone *"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <Input
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              >
                <option value="walk_in">Walk-in</option>
                <option value="referral">Referral</option>
                <option value="advertisement">Advertisement</option>
                <option value="website">Website</option>
                <option value="social_media">Social media</option>
                <option value="other">Other</option>
              </select>
              <Input
                type="number"
                placeholder="Budget (₹)"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {ALL_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {LEAD_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
              <Input
                type="date"
                aria-label="Last follow-up"
                value={form.lastFollowUpAt}
                onChange={(e) =>
                  setForm({ ...form, lastFollowUpAt: e.target.value })
                }
              />
            </div>
            <Input
              placeholder="Project interest"
              value={form.projectInterest}
              onChange={(e) =>
                setForm({ ...form, projectInterest: e.target.value })
              }
            />
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void submit()}>
                {editingLead ? "Save changes" : "Add lead"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 24;

const STATUS_COUNTS_LABELS: { status: LeadStatus | "all"; label: string }[] = [
  { status: "all", label: "All" },
  { status: "new", label: "New" },
  { status: "contacted", label: "Contacted" },
  { status: "site_visit", label: "Site Visit" },
  { status: "negotiation", label: "Negotiation" },
  { status: "won", label: "Won" },
  { status: "lost", label: "Lost" },
];

export default function LeadsPage() {
  if (migrationApiEnabled) return <MigrationLeadsPage />;
  const [activeStatus, setActiveStatus] = useState<LeadStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [myLeadsOnly, setMyLeadsOnly] = useState(false);

  const currentUser = useQuery(api.users.getCurrentUser, {});

  const {
    results: leads,
    status: pageStatus,
    loadMore,
    isLoading,
  } = usePaginatedQuery(
    api.leads.listPaginated,
    search.trim()
      ? { search: search.trim() }
      : {
          ...(activeStatus === "all" ? {} : { status: activeStatus }),
          ...(myLeadsOnly && currentUser
            ? { assignedToId: currentUser._id }
            : {}),
        },
    { initialNumItems: PAGE_SIZE },
  );

  // Count per status for the pipeline summary
  const allLeads = useQuery(api.leads.list, {});

  const counts = ALL_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = allLeads?.filter((l) => l.status === s).length ?? 0;
    return acc;
  }, {});
  const openCount = (
    ["new", "contacted", "site_visit", "negotiation"] as LeadStatus[]
  ).reduce((s, k) => s + (counts[k] ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Lead Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Track enquiries from first contact to booking.
            {allLeads !== undefined && openCount > 0 && (
              <span className="ml-1 font-medium text-primary">
                {openCount} open lead{openCount !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Add lead
        </Button>
      </div>

      {/* Pipeline summary tiles */}
      {allLeads !== undefined && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setActiveStatus(s);
                setSearch("");
              }}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer",
                activeStatus === s
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              <p className={cn("text-xs font-medium", LEAD_STATUS_CLASSES[s])}>
                {LEAD_STATUS_LABELS[s]}
              </p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums">
                {counts[s] ?? 0}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {STATUS_COUNTS_LABELS.map(({ status, label }) => (
            <button
              key={status}
              onClick={() => {
                setActiveStatus(status);
                setSearch("");
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                activeStatus === status && !search
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setMyLeadsOnly((v) => !v)}
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
            myLeadsOnly
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          )}
        >
          <UserCog className="size-3.5" />
          My leads
        </button>
      </div>

      {/* Lead cards */}
      {pageStatus === "LoadingFirstPage" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : leads.length === 0 && !isLoading ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TrendingUp />
            </EmptyMedia>
            <EmptyTitle>
              {search ? "No leads found" : "No leads yet"}
            </EmptyTitle>
            <EmptyDescription>
              {search
                ? "Try a different name."
                : "Add your first lead to start tracking your pipeline."}
            </EmptyDescription>
          </EmptyHeader>
          {!search && (
            <div className="mt-4">
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" />
                Add lead
              </Button>
            </div>
          )}
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {leads.map((lead) => (
              <LeadCard key={lead._id} lead={lead} />
            ))}
          </div>
          <LoadMoreButton
            status={pageStatus}
            onLoadMore={() => loadMore(PAGE_SIZE)}
            pageSize={PAGE_SIZE}
          />
        </>
      )}

      <LeadFormDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
