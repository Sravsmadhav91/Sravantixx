import {
  BarChart3,
  BookOpen,
  Building2,
  ClipboardList,
  FileSignature,
  FolderOpen,
  HardHat,
  HandCoins,
  LayoutDashboard,
  Landmark,
  LineChart,
  Package,
  Percent,
  Receipt,
  ScrollText,
  Settings,
  TrendingUp,
  Upload,
  Users,
  UsersRound,
  Wallet,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Module } from "@/convex/lib/rbac.ts";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  /** False until the milestone that builds the page ships. */
  available: boolean;
  /** Shown in the mobile bottom bar. */
  primary?: boolean;
  /** The module key this nav item belongs to (see convex/lib/rbac.ts). Used to hide it from roles without access. */
  module: Module;
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: LayoutDashboard,
    available: true,
    primary: true,
    module: "dashboard",
  },
  {
    label: "Projects",
    to: "/projects",
    icon: Building2,
    available: true,
    primary: true,
    module: "projects",
  },
  { label: "Buyers", to: "/buyers", icon: Users, available: true, primary: true, module: "buyers" },
  {
    label: "Bookings",
    to: "/bookings",
    icon: ScrollText,
    available: true,
    primary: true,
    module: "bookings",
  },
  { label: "Sales Dashboard", to: "/sales-dashboard", icon: LineChart, available: true, module: "salesDashboard" },
  { label: "Collections", to: "/collections", icon: Wallet, available: true, module: "collections" },
  { label: "Construction", to: "/construction", icon: HardHat, available: true, module: "construction" },
  { label: "Material Requests", to: "/material-requests", icon: ClipboardList, available: true, module: "materialRequests" },
  { label: "Subcontracts", to: "/subcontracts", icon: FileSignature, available: true, module: "subcontracts" },
  { label: "Labour", to: "/labour", icon: Wrench, available: true, module: "labour" },
  { label: "Loans", to: "/loans", icon: HandCoins, available: true, module: "loans" },
  { label: "Leads", to: "/leads", icon: TrendingUp, available: true, module: "leads" },
  { label: "Tasks", to: "/tasks", icon: ClipboardList, available: true, module: "tasks" },
  { label: "Documents", to: "/documents", icon: FolderOpen, available: true, module: "documents" },
  { label: "Accounting", to: "/accounting", icon: BookOpen, available: true, module: "accounting" },
  { label: "Payables", to: "/payables", icon: Receipt, available: true, module: "payables" },
  { label: "Banking", to: "/banking", icon: Landmark, available: true, module: "banking" },
  { label: "Inventory", to: "/inventory", icon: Package, available: true, module: "inventory" },
  { label: "GST Returns", to: "/gst", icon: Percent, available: true, module: "gst" },
  { label: "Payroll", to: "/payroll", icon: UsersRound, available: true, module: "payroll" },
  { label: "TDS Filing", to: "/tds", icon: Landmark, available: true, module: "tds" },
  { label: "Import", to: "/import", icon: Upload, available: true, module: "import" },
  {
    label: "Reports",
    to: "/reports",
    icon: BarChart3,
    available: true,
    primary: true,
    module: "reports",
  },
  {
    label: "Settings",
    to: "/settings",
    icon: Settings,
    available: true,
    module: "settings",
  },
];
