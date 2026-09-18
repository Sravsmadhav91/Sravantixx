import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { useQuery } from "convex/react";
import { LogOut, ScrollText, Wallet } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { useAuth } from "@/hooks/use-auth.ts";
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
import { cn } from "@/lib/utils.ts";
import { migrationApiEnabled } from "@/lib/migration-api.ts";

const PORTAL_NAV = [
  { label: "My Bookings", to: "/portal", icon: ScrollText },
];

function PortalUserCard() {
  const { user, signout } = useAuth();
  const name = user?.profile.name ?? "Buyer";
  const avatar = typeof user?.profile.avatar === "string" ? user.profile.avatar : undefined;
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex items-center gap-3 border-t border-sidebar-border p-3">
      <Avatar className="size-9">
        <AvatarImage src={avatar} alt={name} />
        <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
          {initials || "BU"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-sidebar-foreground">{name}</p>
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

function NoBuyerAccount() {
  const navigate = useNavigate();
  const { user, signout } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Empty className="max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Wallet />
          </EmptyMedia>
          <EmptyTitle>No booking found</EmptyTitle>
          <EmptyDescription>
            We could not find a buyer account linked to{" "}
            <span className="font-medium">{user?.profile.email ?? "your email"}</span>. Please
            check with your developer, or sign in with the email you used for your booking.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => void signout()}>
            Switch account
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate("/")}>
            Back home
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

function PortalShell() {
  const myBuyers = useQuery(api.portal.getMyBuyerRecords, {});

  if (myBuyers === undefined) {
    return (
      <div className="flex min-h-screen">
        <Skeleton className="hidden h-screen w-64 md:block" />
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (myBuyers.length === 0) {
    return <NoBuyerAccount />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar md:flex">
        <div className="px-5 py-5">
          <Logo onDark />
        </div>
        <div className="px-3 pb-2">
          <p className="px-3 text-xs font-medium uppercase tracking-wide text-sidebar-foreground/50">
            Buyer Portal
          </p>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {PORTAL_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  cn(
                    "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )
                }
              >
                <Icon className="size-4.5 shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="flex-1" />
        <PortalUserCard />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
          <Logo />
          <SignInButton size="sm" variant="secondary" />
        </header>
        <main className="flex-1 pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function PortalSignInPrompt() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Empty className="max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Lock />
          </EmptyMedia>
          <EmptyTitle>Sign in to your buyer portal</EmptyTitle>
          <EmptyDescription>
            View your unit, payment schedule, receipts and documents, all in one place.
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

function MigrationPortalLayout() {
  const { user, signout, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Skeleton className="h-10 w-48" /></div>;
  if (!isAuthenticated) return <PortalSignInPrompt />;
  const name = user?.profile.name ?? "Buyer";
  const initials = name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar md:flex">
        <div className="px-5 py-5"><Logo onDark /></div>
        <p className="px-6 text-xs font-medium uppercase tracking-wide text-sidebar-foreground/50">Buyer Portal</p>
        <nav className="flex flex-col gap-1 px-3 pt-3">
          <NavLink to="/portal" end className={({ isActive }) => cn("rounded-md px-3 py-2 text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60")}>My Bookings</NavLink>
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-3 border-t border-sidebar-border p-3">
          <Avatar className="size-9"><AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">{initials || "BU"}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-sidebar-foreground">{name}</p><p className="truncate text-xs text-sidebar-foreground/60">{user?.profile.email ?? "Signed in"}</p></div>
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => void signout()} className="text-sidebar-foreground/70"><LogOut className="size-4" /></Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col"><header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden"><Logo /><SignInButton size="sm" variant="secondary" /></header><main className="flex-1 pb-6"><Outlet /></main></div>
    </div>
  );
}

export default function PortalLayout() {
  if (migrationApiEnabled) return <MigrationPortalLayout />;

  return (
    <>
      <AuthLoading>
        <div className="flex min-h-screen">
          <Skeleton className="hidden h-screen w-64 md:block" />
          <div className="flex-1 space-y-4 p-6">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <PortalSignInPrompt />
      </Unauthenticated>
      <Authenticated>
        <PortalShell />
      </Authenticated>
    </>
  );
}
