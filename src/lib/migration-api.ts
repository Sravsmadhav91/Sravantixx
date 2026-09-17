import type { UnitWithBuyer } from "@/convex/units.ts";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { BookingWithDetails } from "@/convex/bookings.ts";
import { supabase } from "@/lib/supabase.ts";

export type MigrationProjectSummary = {
  totalUnits: number;
  available: number;
  onHold: number;
  booked: number;
  sold: number;
  inventoryValue: number;
  soldValue: number;
};

export type MigrationProject = {
  _id: string;
  name: string;
  code: string;
  city: string;
  address?: string;
  type: "apartment" | "plotted" | "villa" | "commercial";
  status: "planning" | "under_construction" | "ready" | "completed";
  reraNumber?: string;
  possessionDate?: string;
  constructionBudget?: number;
  summary: MigrationProjectSummary;
};

export type MigrationTeamRole = {
  role: "staff" | "accountant" | "sales" | "site_engineer";
  label: string;
  description: string;
};

export type MigrationTeamMember = Doc<"teamMembers">;

export type MigrationEmailSettings = {
  emailSenderName: string;
  emailSenderAddress: string;
  emailReplyTo: string;
};

const apiUrl = import.meta.env.VITE_MIGRATION_API_URL ?? "http://localhost:3000";
const ownerId = import.meta.env.VITE_MIGRATION_OWNER_ID;

function allowLegacyOwnerFallback() {
  return import.meta.env.MODE !== "production" || import.meta.env.VITE_MIGRATION_ALLOW_OWNER_FALLBACK === "true";
}

export const migrationApiEnabled = import.meta.env.VITE_MIGRATION_API === "true";

export async function migrationHeaders(): Promise<HeadersInit> {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) return { Authorization: `Bearer ${token}` };
  }
  if (allowLegacyOwnerFallback() && ownerId) {
    return { "X-Owner-Id": ownerId };
  }
  throw new Error("A Supabase session or a development-safe migration owner header is required");
}

export async function listMigrationProjects(): Promise<MigrationProject[]> {
  const response = await fetch(`${apiUrl}/api/projects`, {
    headers: await migrationHeaders(),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json();
}

export async function createMigrationProject(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/projects`, {
    method: "POST",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json() as Promise<MigrationProject>;
}

export async function migrationGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: await migrationHeaders(),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json();
}

export function getMigrationProject(projectId: string) {
  return migrationGet<MigrationProject>(`/api/projects/${encodeURIComponent(projectId)}`);
}

export function listMigrationUnits(projectId: string, status?: string) {
  const query = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
  return migrationGet<UnitWithBuyer[]>(
    `/api/projects/${encodeURIComponent(projectId)}/units${query}`,
  );
}

export function listMigrationBuyers(search?: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return migrationGet<Doc<"buyers">[]>(`/api/buyers${query}`);
}

export function getMigrationBuyer(buyerId: string) {
  return migrationGet<Doc<"buyers">>(`/api/buyers/${encodeURIComponent(buyerId)}`);
}

export function listMigrationBuyerBookings(buyerId: string) {
  return migrationGet<BookingWithDetails[]>(
    `/api/buyers/${encodeURIComponent(buyerId)}/bookings`,
  );
}

export function listMigrationBookings(status?: "active" | "cancelled") {
  const query = status ? `?status=${status}` : "";
  return migrationGet<BookingWithDetails[]>(`/api/bookings${query}`);
}

export type MigrationStatement = {
  booking: Doc<"bookings">;
  buyer: Doc<"buyers">;
  coBuyers: Doc<"buyers">[];
  unit: (Doc<"units"> & { projectName: string; projectRera?: string; projectCity?: string; projectAddress?: string }) | null;
  installments: Doc<"paymentInstallments">[];
  receipts: Doc<"receipts">[];
  totalReceived: number;
  outstanding: number;
  overdueCount: number;
};

export function getMigrationStatement(bookingId: string) {
  return migrationGet<MigrationStatement>(
    `/api/collections/${encodeURIComponent(bookingId)}/statement`,
  );
}

export type MigrationCollectionsDashboard = {
  kpis: {
    totalAgreementValue: number;
    totalCollected: number;
    totalOutstanding: number;
    collectionRate: number;
    overdueCount: number;
    overdueAmount: number;
    upcomingCount: number;
    upcomingAmount: number;
  };
  aging: { label: string; count: number; amount: number }[];
  trend: { month: string; sortKey: string; collectedAmount: number }[];
  byProject: { projectId: string; name: string; agreementValue: number; collectedAmount: number; outstanding: number }[];
};

export type MigrationDashboard = {
  kpis: {
    totalProjects: number;
    totalUnits: number;
    availableUnits: number;
    activeBookings: number;
    totalBookingValue: number;
    totalCollected: number;
    totalOutstanding: number;
    overdueCount: number;
    openLeads: number;
  };
  bookingsByMonth: { month: string; sortKey: string; count: number }[];
  collectionsByMonth: { month: string; sortKey: string; amount: number }[];
  projectStatus: { name: string; available: number; booked: number; sold: number; onHold: number }[];
  projects: MigrationProject[];
};

export function getMigrationDashboard() {
  return migrationGet<MigrationDashboard>("/api/dashboard");
}

export type MigrationGstSummary = {
  settings: { gstin?: string; legalName?: string; tradeName?: string; stateName?: string; stateCode?: string };
  gstr1: {
    totalInvoices: number; totalTaxableValue: number; totalTax: number;
    b2b: Array<Record<string, any>>; b2cLarge: Array<Record<string, any>>;
    advancesReceived: Array<Record<string, any>>;
    advancesReceivedTaxableValue: number; advancesReceivedCgst: number; advancesReceivedSgst: number; advancesReceivedIgst: number;
    b2cSmall: { taxableValue: number; cgst: number; sgst: number; igst: number };
    hsnSummary: Array<Record<string, any>>;
  };
  gstr3b: { outwardTaxableValue: number; outwardCgst: number; outwardSgst: number; outwardIgst: number; itcCgst: number; itcSgst: number; itcIgst: number; itcInvoiceCount: number; netCgstPayable: number; netSgstPayable: number; netIgstPayable: number; netTaxPayable: number };
};

export function getMigrationGstSummary(fromDate: string, toDate: string) {
  return migrationGet<MigrationGstSummary>(`/api/gst/summary?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`);
}

export function getMigrationCollectionsDashboard(options: { projectId?: string; fromDate?: string; toDate?: string }) {
  const params = new URLSearchParams();
  if (options.projectId && options.projectId !== "all") params.set("projectId", options.projectId);
  if (options.fromDate) params.set("fromDate", options.fromDate);
  if (options.toDate) params.set("toDate", options.toDate);
  const query = params.toString() ? `?${params.toString()}` : "";
  return migrationGet<MigrationCollectionsDashboard>(`/api/collections/dashboard${query}`);
}

export type MigrationInstallmentAlert = Doc<"paymentInstallments"> & {
  buyerName: string;
  buyerPhone: string;
  unitNumber: string;
  projectName: string;
  bookingId: Id<"bookings">;
};

export function getMigrationCollectionAlerts() {
  return migrationGet<{ overdue: MigrationInstallmentAlert[]; upcoming: MigrationInstallmentAlert[] }>(
    "/api/collections/alerts",
  );
}

export async function updateMigrationProject(projectId: string, input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json() as Promise<MigrationProject>;
}

export async function createMigrationUnit(projectId: string, input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/projects/${encodeURIComponent(projectId)}/units`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function createMigrationBuyer(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/buyers`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function createMigrationLoan(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/loans`, {
    method: "POST",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json();
}

export async function createMigrationEmployee(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/payroll/employees`, {
    method: "POST",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json();
}

export async function createMigrationPayrollRun(month: string) {
  const response = await fetch(`${apiUrl}/api/payroll/runs`, {
    method: "POST",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ month }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json();
}

export async function createMigrationSubcontract(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/subcontracts`, {
    method: "POST",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json();
}

export async function createMigrationStockItem(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/inventory/items`, {
    method: "POST",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json();
}

export async function createMigrationGodown(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/inventory/godowns`, {
    method: "POST",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json();
}

export async function saveMigrationGstSettings(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/gst/settings`, {
    method: "POST",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json();
}

export async function listMigrationTeamRoles() {
  return migrationGet<MigrationTeamRole[]>("/api/team/roles");
}

export async function listMigrationTeamMembers() {
  return migrationGet<MigrationTeamMember[]>("/api/team/members");
}

export async function inviteMigrationTeamMember(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/team/members`, {
    method: "POST",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json();
}

export async function removeMigrationTeamMember(teamMemberId: string) {
  const response = await fetch(`${apiUrl}/api/team/members/${encodeURIComponent(teamMemberId)}`, {
    method: "DELETE",
    headers: await migrationHeaders(),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

export async function updateMigrationTeamMemberRole(teamMemberId: string, role: string) {
  const response = await fetch(`${apiUrl}/api/team/members/${encodeURIComponent(teamMemberId)}/role`, {
    method: "PATCH",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json();
}

export async function getMigrationEmailSettings() {
  return migrationGet<MigrationEmailSettings>("/api/email-settings");
}

export async function saveMigrationEmailSettings(input: MigrationEmailSettings) {
  const response = await fetch(`${apiUrl}/api/email-settings`, {
    method: "PATCH",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

export type MigrationSalesDashboard = {
  kpis: { bookingCount: number; bookingValue: number; collectedAmount: number; avgTicketSize: number; leadToBookingRate: number; totalLeads: number };
  trend: { month: string; sortKey: string; bookingCount: number; bookingValue: number; collectedAmount: number }[];
  byProject: { projectId: string; name: string; bookingCount: number; bookingValue: number; collectedAmount: number }[];
  bySalesRep: { userId: string | null; name: string; bookingCount: number; bookingValue: number }[];
};

export function getMigrationSalesDashboard(options: { projectId: string; fromDate: string; toDate: string }) {
  const params = new URLSearchParams({ fromDate: options.fromDate, toDate: options.toDate });
  if (options.projectId !== "all") params.set("projectId", options.projectId);
  return migrationGet<MigrationSalesDashboard>(`/api/sales-dashboard?${params.toString()}`);
}

export async function createMigrationLead(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/leads`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export function listMigrationTasksForEntity(linkedType: string, linkedId: string) {
  const params = new URLSearchParams({ linkedType, linkedId });
  return migrationGet<any[]>(`/api/crm/tasks?${params.toString()}`);
}

export async function createMigrationTask(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/crm/tasks`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function updateMigrationTask(taskId: string, input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/crm/tasks/${encodeURIComponent(taskId)}`, { method: "PATCH", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function toggleMigrationTask(taskId: string, status: "open" | "done") {
  return updateMigrationTask(taskId, { status });
}

export async function deleteMigrationTask(taskId: string) {
  const response = await fetch(`${apiUrl}/api/crm/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE", headers: await migrationHeaders() });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.status === 204 ? null : response.json();
}

export async function createMigrationLabourer(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/labourers`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function createMigrationMaterialRequest(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/material-requests`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function createMigrationLabourEntry(labourerId: string, input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/labourers/${encodeURIComponent(labourerId)}/entries`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function createMigrationVendor(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/payables/vendors`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function createMigrationJournalEntry(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/accounting/journal-entries`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export type MigrationTopBuyer = {
  buyerId: string;
  buyerName: string;
  bookingCount: number;
  bookingValue: number;
  collected: number;
  outstanding: number;
};

export function getMigrationTopBuyers(fromDate: string, toDate: string) {
  return migrationGet<MigrationTopBuyer[]>(`/api/reports/top-buyers?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`);
}

export async function updateMigrationUnit(projectId: string, unitId: string, input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/projects/${encodeURIComponent(projectId)}/units/${encodeURIComponent(unitId)}`, {
    method: "PATCH",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json();
}

export async function cancelMigrationBooking(bookingId: string) {
  const response = await fetch(`${apiUrl}/api/bookings/${encodeURIComponent(bookingId)}`, {
    method: "PATCH",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ status: "cancelled" }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json();
}

export async function deleteMigrationBankStatement(statementId: string) {
  const response = await fetch(`${apiUrl}/api/banking/statements/${encodeURIComponent(statementId)}`, {
    method: "DELETE",
    headers: await migrationHeaders(),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

export async function matchMigrationBankTransaction(transactionId: string, input: { entityType: "vendor" | "contract" | "labourer" | "employee" | "account"; entityId: string }) {
  const response = await fetch(`${apiUrl}/api/banking/transactions/${encodeURIComponent(transactionId)}/match`, {
    method: "PATCH",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json();
}

export async function autoMatchMigrationBankStatement(statementId: string) {
  const response = await fetch(`${apiUrl}/api/banking/statements/${encodeURIComponent(statementId)}/auto-match`, {
    method: "POST",
    headers: await migrationHeaders(),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json() as Promise<{ matched: number; unmatched: number }>;
}

export async function importMigrationBankStatement(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/banking/statements`, {
    method: "POST",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Migration API request failed (${response.status})`);
  }
  return response.json();
}

export async function createMigrationAccount(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/accounting/accounts`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function updateMigrationAccount(accountId: string, input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/accounting/accounts/${encodeURIComponent(accountId)}`, { method: "PATCH", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function createMigrationVoucher(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/accounting/vouchers`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}