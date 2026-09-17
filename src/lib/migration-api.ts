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

export async function getMigrationTallyCompanies() {
  const response = await fetch(`${apiUrl}/api/tally/companies`, { headers: await migrationHeaders() });
  if (!response.ok) throw new Error(`Tally request failed (${response.status})`);
  const xml = await response.text();
  // Tally returns company names either as a NAME attribute (<COMPANY NAME="...">) or a child <NAME> tag.
  const attributeNames = [...xml.matchAll(/<COMPANY\s[^>]*\bNAME="([^"]*)"/gi)].map((match) => match[1].trim());
  const childTagNames = [...xml.matchAll(/<NAME>([^<]+)<\/NAME>/gi)].map((match) => match[1].trim());
  const companies = [...attributeNames, ...childTagNames].filter(Boolean);
  return { xml, companies: [...new Set(companies)] };
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

export type MigrationPurchaseOrder = Doc<"purchaseOrders"> & { vendorName: string };
export type MigrationPurchaseInvoice = Doc<"purchaseInvoices"> & { vendorName: string; outstanding: number };
export type MigrationApAgingRow = { vendorId: string; name: string; current: number; days30: number; days60: number; days90: number; over90: number; total: number };

export function listMigrationPurchaseOrders(status?: string) {
  const query = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
  return migrationGet<MigrationPurchaseOrder[]>(`/api/purchase-orders${query}`);
}

export function listMigrationPurchaseInvoices(status?: string) {
  const query = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
  return migrationGet<MigrationPurchaseInvoice[]>(`/api/payables/invoices${query}`);
}

export function getMigrationApAging() {
  return migrationGet<MigrationApAgingRow[]>("/api/payables/aging");
}

export async function importMigrationImsInvoices(rows: Record<string, unknown>[]) {
  const response = await fetch(`${apiUrl}/api/payables/import-ims`, {
    method: "POST",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json() as Promise<{ imported: number; skippedDuplicates: number; vendorsCreated: number; vendorsMatched: number }>;
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

export async function matchMigrationBankTransaction(transactionId: string, input: { entityType: "buyer" | "vendor" | "contract" | "labourer" | "employee" | "account"; entityId: string; tdsEnabled?: boolean; tdsSection?: string; tdsRate?: number; gstRegistered?: boolean; gstRate?: number }) {
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

export async function createMigrationConstructionStage(projectId: string, input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/projects/${encodeURIComponent(projectId)}/construction/stages`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function createMigrationConstructionExpense(projectId: string, input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/projects/${encodeURIComponent(projectId)}/construction/expenses`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function saveMigrationTdsSettings(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/tds/settings`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function createMigrationTdsDeduction(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/tds/deductions`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function createMigrationTdsChallan(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/tds/challans`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export function getMigrationTdsReturnSummary(quarter: string, returnType: string) {
  return migrationGet<{ rows: any[]; deducteeCount: number; totalGross: number; totalTds: number; challanCount: number }>(`/api/tds/returns/summary?quarter=${encodeURIComponent(quarter)}&returnType=${encodeURIComponent(returnType)}`);
}

export async function updateMigrationLabourer(labourerId: string, input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/labourers/${encodeURIComponent(labourerId)}`, { method: "PATCH", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function deleteMigrationBankTransaction(transactionId: string) {
  const response = await fetch(`${apiUrl}/api/banking/transactions/${encodeURIComponent(transactionId)}`, { method: "DELETE", headers: await migrationHeaders() });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.status === 204 ? null : response.json();
}

export async function convertMigrationMaterialRequest(requestId: string, input: { vendorId: string; rates: number[]; expectedDeliveryDate?: string }) {
  const response = await fetch(`${apiUrl}/api/material-requests/${encodeURIComponent(requestId)}/convert-to-po`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function listMigrationTdsDeductees() {
  return migrationGet<any[]>("/api/tds/deductees");
}

export async function importMigrationTdsDeductees(rows: Record<string, unknown>[]) {
  const response = await fetch(`${apiUrl}/api/tds/deductees/import`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json() as Promise<{ imported: number; updated: number; skipped: number }>;
}

export async function updateMigrationTdsDeductee(deducteeId: string, input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/tds/deductees/${encodeURIComponent(deducteeId)}`, { method: "PATCH", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function deleteMigrationTdsDeductee(deducteeId: string) {
  const response = await fetch(`${apiUrl}/api/tds/deductees/${encodeURIComponent(deducteeId)}`, { method: "DELETE", headers: await migrationHeaders() });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.status === 204 ? null : response.json();
}

export async function createMigrationTdsDeductee(input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/tds/deductees`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function deleteMigrationAccount(accountId: string) {
  const response = await fetch(`${apiUrl}/api/accounting/accounts/${encodeURIComponent(accountId)}`, { method: "DELETE", headers: await migrationHeaders() });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.status === 204 ? null : response.json();
}

export async function updateMigrationJournalEntry(entryId: string, input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/accounting/journal-entries/${encodeURIComponent(entryId)}`, { method: "PATCH", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function deleteMigrationJournalEntry(entryId: string) {
  const response = await fetch(`${apiUrl}/api/accounting/journal-entries/${encodeURIComponent(entryId)}`, { method: "DELETE", headers: await migrationHeaders() });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.status === 204 ? null : response.json();
}

export async function updateMigrationSubcontract(subcontractId: string, input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/subcontracts/${encodeURIComponent(subcontractId)}`, { method: "PATCH", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function updateMigrationConstructionStage(projectId: string, stageId: string, input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/projects/${encodeURIComponent(projectId)}/construction/stages/${encodeURIComponent(stageId)}`, { method: "PATCH", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function deleteMigrationConstructionStage(projectId: string, stageId: string) {
  const response = await fetch(`${apiUrl}/api/projects/${encodeURIComponent(projectId)}/construction/stages/${encodeURIComponent(stageId)}`, { method: "DELETE", headers: await migrationHeaders() });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.status === 204 ? null : response.json();
}

export async function updateMigrationConstructionExpense(projectId: string, expenseId: string, input: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/api/projects/${encodeURIComponent(projectId)}/construction/expenses/${encodeURIComponent(expenseId)}`, { method: "PATCH", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json();
}

export async function deleteMigrationConstructionExpense(projectId: string, expenseId: string) {
  const response = await fetch(`${apiUrl}/api/projects/${encodeURIComponent(projectId)}/construction/expenses/${encodeURIComponent(expenseId)}`, { method: "DELETE", headers: await migrationHeaders() });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.status === 204 ? null : response.json();
}

export async function importMigrationPurchaseInvoices(rows: Record<string, unknown>[]) {
  const response = await fetch(`${apiUrl}/api/payables/import-invoices`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Migration API request failed (${response.status})`); }
  return response.json() as Promise<{ imported: number; vendorsCreated: number }>;
}

export async function previewMigrationTallyXml(kind: "ledgers" | "vouchers", xml: string) {
  const response = await fetch(`${apiUrl}/api/tally/preview`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ kind, xml }) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Tally import request failed (${response.status})`); }
  return response.json() as Promise<{ kind: string; records: number; preview: string[] }>;
}

export async function importMigrationTallyLedgers(company: string) {
  const response = await fetch(`${apiUrl}/api/tally/import-ledgers`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ company }) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Tally ledger import failed (${response.status})`); }
  return response.json() as Promise<{ accountsCreated: number; openingBalancesApplied: number; vendorsCreated: number; skipped: number; unmapped: Array<{ name: string; parent: string }> }>;
}

export async function importMigrationTallyVouchers(company: string, fromDate: string, toDate: string) {
  const response = await fetch(`${apiUrl}/api/tally/import-vouchers`, { method: "POST", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ company, fromDate, toDate }) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Tally voucher import failed (${response.status})`); }
  return response.json() as Promise<{ journalEntriesCreated: number; purchaseInvoicesCreated: number; skipped: number; skippedDetails: Array<{ voucherNumber: string; reason: string }> }>;
}

export type MigrationDocument = {
  _id: string;
  ownerId: string;
  linkedType: "buyer" | "booking" | "project";
  linkedId: string;
  linkedName?: string;
  fileName: string;
  contentType?: string;
  size?: number;
  docType: string;
  label?: string;
  notes?: string;
  uploadedAt: string;
};

export function listMigrationDocuments(options: { linkedType?: string; linkedId?: string; docType?: string; search?: string } = {}) {
  const params = new URLSearchParams();
  if (options.linkedType) params.set("linkedType", options.linkedType);
  if (options.linkedId) params.set("linkedId", options.linkedId);
  if (options.docType) params.set("docType", options.docType);
  if (options.search) params.set("search", options.search);
  const query = params.toString() ? `?${params.toString()}` : "";
  return migrationGet<MigrationDocument[]>(`/api/documents${query}`);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).slice(String(reader.result).indexOf(",") + 1));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function uploadMigrationDocument(input: { linkedType: string; linkedId: string; linkedName?: string; file: File; docType: string; label?: string; notes?: string }) {
  const dataBase64 = await fileToBase64(input.file);
  const response = await fetch(`${apiUrl}/api/documents`, {
    method: "POST",
    headers: { ...await migrationHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      linkedType: input.linkedType, linkedId: input.linkedId, linkedName: input.linkedName,
      fileName: input.file.name, contentType: input.file.type, size: input.file.size,
      docType: input.docType, label: input.label, notes: input.notes, dataBase64,
    }),
  });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Upload failed (${response.status})`); }
  return response.json() as Promise<MigrationDocument>;
}

export async function updateMigrationDocument(documentId: string, input: { label?: string; docType?: string; notes?: string }) {
  const response = await fetch(`${apiUrl}/api/documents/${encodeURIComponent(documentId)}`, { method: "PATCH", headers: { ...await migrationHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Could not update document (${response.status})`); }
  return response.json() as Promise<MigrationDocument>;
}

export async function deleteMigrationDocument(documentId: string) {
  const response = await fetch(`${apiUrl}/api/documents/${encodeURIComponent(documentId)}`, { method: "DELETE", headers: await migrationHeaders() });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Could not delete document (${response.status})`); }
  return response.status === 204 ? null : response.json();
}

export async function fetchMigrationDocumentBlob(documentId: string) {
  const response = await fetch(`${apiUrl}/api/documents/${encodeURIComponent(documentId)}/download`, { headers: await migrationHeaders() });
  if (!response.ok) throw new Error(`Could not download document (${response.status})`);
  return response.blob();
}