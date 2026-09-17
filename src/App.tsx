import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import { useServiceWorker } from "@/hooks/use-service-worker.ts";
import AppLayout from "./components/layout/app-layout.tsx";
import RequireModuleAccess from "./components/layout/require-module-access.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import Index from "./pages/Index.tsx";
import DashboardPage from "./pages/dashboard/page.tsx";
import ProjectsPage from "./pages/projects/page.tsx";
import ProjectDetailPage from "./pages/projects/detail-page.tsx";
import BuyersPage from "./pages/buyers/page.tsx";
import BuyerDetailPage from "./pages/buyers/detail-page.tsx";
import BookingsPage from "./pages/bookings/page.tsx";
import SalesDashboardPage from "./pages/sales-dashboard/page.tsx";
import CollectionsPage from "./pages/collections/page.tsx";
import CollectionDetailPage from "./pages/collections/detail-page.tsx";
import ConstructionPage from "./pages/construction/page.tsx";
import ConstructionDetailPage from "./pages/construction/detail-page.tsx";
import MaterialRequestsPage from "./pages/material-requests/page.tsx";
import SubcontractsPage from "./pages/subcontracts/page.tsx";
import LabourPage from "./pages/labour/page.tsx";
import LoansPage from "./pages/loans/page.tsx";
import ReportsPage from "./pages/reports/page.tsx";
import LeadsPage from "./pages/leads/page.tsx";
import ImportPage from "./pages/import/page.tsx";
import SettingsPage from "./pages/settings/page.tsx";
import AccountingPage from "./pages/accounting/page.tsx";
import LedgerListPage from "./pages/accounting/ledger-list-page.tsx";
import AccountLedgerPage from "./pages/accounting/ledger-page.tsx";
import PayablesPage from "./pages/payables/page.tsx";
import VendorDetailPage from "./pages/payables/vendor-detail-page.tsx";
import BankingPage from "./pages/banking/page.tsx";
import InventoryPage from "./pages/inventory/page.tsx";
import GstReturnsPage from "./pages/gst/page.tsx";
import PayrollPage from "./pages/payroll/page.tsx";
import TdsFilingPage from "./pages/tds/page.tsx";
import TasksDashboardPage from "./pages/tasks/page.tsx";
import DocumentsPage from "./pages/documents/page.tsx";
import PortalLayout from "./pages/portal/_components/portal-layout.tsx";
import PortalHomePage from "./pages/portal/page.tsx";
import PortalBookingDetailPage from "./pages/portal/booking-detail-page.tsx";
import NotFound from "./pages/NotFound.tsx";

export default function App() {
  useServiceWorker();
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route element={<AppLayout />}>
            <Route element={<RequireModuleAccess />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
              <Route path="/buyers" element={<BuyersPage />} />
              <Route path="/buyers/:buyerId" element={<BuyerDetailPage />} />
              <Route path="/bookings" element={<BookingsPage />} />
              <Route path="/sales-dashboard" element={<SalesDashboardPage />} />
              <Route path="/collections" element={<CollectionsPage />} />
              <Route path="/collections/:bookingId" element={<CollectionDetailPage />} />
              <Route path="/construction" element={<ConstructionPage />} />
              <Route path="/construction/:projectId" element={<ConstructionDetailPage />} />
              <Route path="/material-requests" element={<MaterialRequestsPage />} />
              <Route path="/subcontracts" element={<SubcontractsPage />} />
              <Route path="/labour" element={<LabourPage />} />
              <Route path="/loans" element={<LoansPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/accounting" element={<AccountingPage />} />
              <Route path="/accounting/ledger" element={<LedgerListPage />} />
              <Route path="/accounting/ledger/:accountId" element={<AccountLedgerPage />} />
              <Route path="/payables" element={<PayablesPage />} />
              <Route path="/payables/vendor/:vendorId" element={<VendorDetailPage />} />
              <Route path="/banking" element={<BankingPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/gst" element={<GstReturnsPage />} />
              <Route path="/payroll" element={<PayrollPage />} />
              <Route path="/tds" element={<TdsFilingPage />} />
              <Route path="/tasks" element={<TasksDashboardPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
            </Route>
          </Route>
          <Route element={<PortalLayout />}>
            <Route path="/portal" element={<PortalHomePage />} />
            <Route path="/portal/bookings/:bookingId" element={<PortalBookingDetailPage />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
