import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { toast } from "sonner";
import { ChevronDown, Download, LogOut, Search, Share, ShieldAlert, X } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { useAuth } from "@/hooks/use-auth.ts";
import { useRole } from "@/hooks/use-role.ts";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Lock } from "lucide-react";
import Logo from "@/components/logo.tsx";
import GlobalSearch from "@/components/global-search.tsx";
import { cn } from "@/lib/utils.ts";
import { NAV_ITEMS, type NavItem } from "./nav-items.ts";
import { migrationApiEnabled } from "@/lib/migration-api.ts";

const ROLE_BADGE_LABELS: Record<string, string> = {
  staff: "Staff mode — read & edit only",
  accountant: "Accountant mode — finance modules only",
  sales: "Sales mode — buyers & bookings only",
  site_engineer: "Site Engineer mode — projects & construction only",
};

// ── Install prompt banner ─────────────────────────────────────────────────────

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Hide inside the App Builder iframe
  const inIframe = typeof window !== "undefined" && window.self !== window.top;

  // Compute at render time — these values never change after mount
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches;
  const showIosHint = isIos && !isStandalone;

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (inIframe || dismissed) return null;
  if (!deferredPrompt && !showIosHint) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDismissed(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 text-sm md:hidden">
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-tight">Install Sravantix</p>
        {showIosHint ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            Tap <Share className="inline size-3 mx-0.5" /> then &ldquo;Add to Home Screen&rdquo;
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Add to your home screen for quick access</p>
        )}
      </div>
      {!showIosHint && (
        <Button size="sm" variant="secondary" className="shrink-0 gap-1.5" onClick={() => void handleInstall()}>
          <Download className="size-3.5" />
          Install
        </Button>
      )}
      <button
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function comingSoon() {
  toast.info("Coming soon in a future milestone!");
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  if (migrationApiEnabled) {
    return <MigrationNavLinks onNavigate={onNavigate} />;
  }
  const { isOwner, canAccess } = useRole();
  const pendingCount = useQuery(api.bookings.getPendingApprovalsCount, isOwner ? {} : "skip");
  const visibleItems = NAV_ITEMS.filter((item) => canAccess(item.module));
  return <GroupedNavLinks items={visibleItems} onNavigate={onNavigate} badgeCount={pendingCount} />;
}

function MigrationNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <GroupedNavLinks items={NAV_ITEMS.filter((item) => item.available)} onNavigate={onNavigate} />;
}

function GroupedNavLinks({ items, onNavigate, badgeCount }: { items: NavItem[]; onNavigate?: () => void; badgeCount?: number }) {
  const location = useLocation();
  const siteItems = items.filter((item) => item.group === "site");
  const otherItems = items.filter((item) => item.group !== "site");
  const siteActive = siteItems.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));
  const [siteOpen, setSiteOpen] = useState(siteActive);
  useEffect(() => { if (siteActive) setSiteOpen(true); }, [siteActive]);
  return (
    <nav className="flex flex-col gap-1 px-3">
      {otherItems.map((item) => <NavItemLink key={item.to} item={item} onNavigate={onNavigate} badgeCount={item.to === "/bookings" ? badgeCount : undefined} />)}
      {siteItems.length > 0 && <>
        <button type="button" onClick={() => setSiteOpen((open) => !open)} className="mt-3 flex items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground">
          <span>Site</span><ChevronDown className={cn("size-4 transition-transform", siteOpen && "rotate-180")} />
        </button>
        {siteOpen && <div className="flex flex-col gap-1 border-l border-sidebar-border pl-2">{siteItems.map((item) => <NavItemLink key={item.to} item={item} onNavigate={onNavigate} />)}</div>}
      </>}
    </nav>
  );
}

function NavItemLink({
  item,
  onNavigate,
  badgeCount,
}: {
  item: NavItem;
  onNavigate?: () => void;
  badgeCount?: number;
}) {
  const Icon = item.icon;
  const base =
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors";

  if (!item.available) {
    return (
      <button
        type="button"
        onClick={comingSoon}
        className={cn(
          base,
          "cursor-pointer text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        <Icon className="size-4.5 shrink-0" />
        {item.label}
      </button>
    );
  }

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          base,
          "cursor-pointer",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )
      }
    >
      <Icon className="size-4.5 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {!!badgeCount && badgeCount > 0 && (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-semibold text-white">
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      )}
    </NavLink>
  );
}

function UserCard() {
  const { user, signout } = useAuth();
  const name = user?.profile.name ?? "Business owner";
  const avatar =
    typeof user?.profile.avatar === "string" ? user.profile.avatar : undefined;
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 border-t border-sidebar-border p-3">
      <Avatar className="size-9">
        <AvatarImage src={avatar} alt={name} />
        <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
          {initials || "VY"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-sidebar-foreground">
          {name}
        </p>
        <p className="truncate text-xs text-sidebar-foreground/60">
          {user?.profile.email ?? "Signed in"}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Sign out"
        onClick={() => void signout()}
        className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}

function MobileBottomNav() {
  if (migrationApiEnabled) {
    const primary = NAV_ITEMS.filter((item) => item.primary && item.available);
    return (
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card md:hidden">
        {primary.map((item) => {
          const Icon = item.icon;
          return <NavLink key={item.to} to={item.to} className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground"><Icon className="size-5" />{item.label}</NavLink>;
        })}
      </nav>
    );
  }
  const { canAccess } = useRole();
  const primary = NAV_ITEMS.filter((item) => item.primary && canAccess(item.module));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card md:hidden">
      {primary.map((item) => {
        const Icon = item.icon;
        if (!item.available) {
          return (
            <button
              key={item.to}
              type="button"
              onClick={comingSoon}
              className="flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground"
            >
              <Icon className="size-5" />
              {item.label}
            </button>
          );
        }
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            <Icon className="size-5" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

function SignedInShell() {
  const { isStaff, isScoped, role } = useRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (role === "customer" && !location.pathname.startsWith("/portal")) {
      navigate("/portal", { replace: true });
    }
  }, [location.pathname, navigate, role]);

  if (role === "customer") return null;

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar md:flex">
        <div className="px-5 py-5">
          <Logo onDark />
        </div>

        {/* Search button */}
        <div className="mx-3 mb-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <Search className="size-3.5 shrink-0" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="rounded border border-sidebar-border bg-sidebar-accent px-1 font-mono text-[10px]">⌘K</kbd>
          </button>
        </div>

        {(isStaff || isScoped) && (
          <div className="mx-3 mb-3 flex items-center gap-2 rounded-md bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-400">
            <ShieldAlert className="size-3.5 shrink-0" />
            {ROLE_BADGE_LABELS[role] ?? "Restricted mode"}
          </div>
        )}
        <div className="flex-1 overflow-y-auto pb-4">
          <NavLinks />
        </div>
        <UserCard />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
          <Logo />
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-4" />
            </Button>
            <SignInButton size="sm" variant="secondary" />
          </div>
        </header>
        <InstallBanner />
        <main className="flex-1 pb-20 md:pb-0">
          <Outlet />
        </main>
        <MobileBottomNav />
      </div>

      {!migrationApiEnabled && <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />}
    </div>
  );
}

function SignInPrompt() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Empty className="max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Lock />
          </EmptyMedia>
          <EmptyTitle>Sign in to your books</EmptyTitle>
          <EmptyDescription>
            Your invoices, stock and party balances are private to your account.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center gap-2">
          <SignInButton size="sm" />
          <Button size="sm" variant="ghost" onClick={() => navigate("/")}>
            Back home
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const allowLocalMigrationFallback = import.meta.env.DEV && import.meta.env.VITE_MIGRATION_ALLOW_OWNER_FALLBACK === "true";

  if (migrationApiEnabled) {
    if (isLoading) {
      return <div className="flex min-h-screen"><Skeleton className="hidden h-screen w-64 md:block" /><div className="flex-1 space-y-4 p-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-40 w-full" /></div></div>;
    }
    if (!isAuthenticated && !allowLocalMigrationFallback) return <SignInPrompt />;
    return <SignedInShell />;
  }

  return (
    <>
      <AuthLoading>
        <div className="flex min-h-screen">
          <Skeleton className="hidden h-screen w-64 md:block" />
          <div className="flex-1 space-y-4 p-6">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <SignInPrompt />
      </Unauthenticated>
      <Authenticated>
        <SignedInShell />
      </Authenticated>
    </>
  );
}
