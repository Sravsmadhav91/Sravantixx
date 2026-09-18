import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  BarChart3,
  Building2,
  Check,
  HardHat,
  IndianRupee,
  LayoutGrid,
  ScrollText,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Authenticated, Unauthenticated } from "convex/react";
import { supabaseAuthEnabled } from "@/components/providers/auth.tsx";
import { migrationApiEnabled } from "@/lib/migration-api.ts";
import { useAuth } from "@/hooks/use-auth.ts";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import Logo from "@/components/logo.tsx";

type Feature = {
  title: string;
  body: string;
  icon: LucideIcon;
};

const FEATURES: Feature[] = [
  {
    title: "Project inventory",
    body: "Every tower, layout and plot in one place, with live availability at a glance.",
    icon: Building2,
  },
  {
    title: "Unit-wise site plan",
    body: "See each flat or plot as available, on hold, booked or sold. Generate a whole block in one go.",
    icon: LayoutGrid,
  },
  {
    title: "Bookings and agreements",
    body: "Link a buyer to a unit with agreement value, booking amount and the paperwork trail.",
    icon: ScrollText,
  },
  {
    title: "Payment schedules",
    body: "Milestone-based demands, receipts and a clear list of who is overdue.",
    icon: Wallet,
  },
  {
    title: "Construction and costs",
    body: "Track stage-wise progress and project spend against budget.",
    icon: HardHat,
  },
  {
    title: "Sales reports",
    body: "Bookings, collections and project-wise absorption whenever you need them.",
    icon: BarChart3,
  },
];

const HIGHLIGHTS = [
  "Unlimited projects, units and buyers",
  "Your data stays private to your account",
  "Works on the site as well as the office",
];

export default function Index() {
  const year = new Date().getFullYear();
  const independentMode = supabaseAuthEnabled || migrationApiEnabled;
  const { isAuthenticated } = useAuth();
  const showDashboard = isAuthenticated || (import.meta.env.DEV && migrationApiEnabled && import.meta.env.VITE_MIGRATION_ALLOW_OWNER_FALLBACK === "true");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
          <Logo />
          <div className="flex items-center gap-2">
            {independentMode ? showDashboard && (
              <Button asChild size="sm">
                <Link to="/dashboard">Open dashboard</Link>
              </Button>
            ) : <Authenticated>
              <Button asChild size="sm">
                <Link to="/dashboard">Open dashboard</Link>
              </Button>
            </Authenticated>}
            {independentMode ? !showDashboard && <SignInButton size="sm" /> : <Unauthenticated>
              <SignInButton size="sm" />
            </Unauthenticated>}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_18%_0%,var(--accent)_0%,transparent_60%),radial-gradient(50%_45%_at_88%_10%,color-mix(in_oklch,var(--primary)_28%,transparent)_0%,transparent_65%)] opacity-70 dark:opacity-40"
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="space-y-7"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" />
              Built for Indian developers and builders
            </span>
            <h1 className="font-serif text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Run your projects, inventory and sales in one place
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground text-balance">
              Sravantix replaces the availability chart on the wall, the booking
              register and the collection follow-up sheet with one live
              dashboard for your whole site.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {independentMode ? !showDashboard && (
                <SignInButton size="lg" signInText="Start free" />
              ) : <Unauthenticated><SignInButton size="lg" signInText="Start free" /></Unauthenticated>}
              {independentMode ? showDashboard && (
                <Button asChild size="lg">
                  <Link to="/dashboard">Go to dashboard</Link>
                </Button>
              ) : <Authenticated><Button asChild size="lg"><Link to="/dashboard">Go to dashboard</Link></Button></Authenticated>}
              <Button asChild size="lg" variant="secondary">
                <a href="#features">See what is inside</a>
              </Button>
            </div>
            <ul className="grid gap-2 pt-2 text-sm text-muted-foreground sm:grid-cols-2">
              {HIGHLIGHTS.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            className="lg:pt-6"
          >
            <Card className="overflow-hidden border-border/70 shadow-xl">
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Today
                  </p>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    Live
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Units sold", value: "84 / 120" },
                    { label: "Booking value", value: "₹42.6 Cr" },
                    { label: "Collected", value: "₹28.1 Cr" },
                    { label: "Overdue", value: "6 buyers" },
                  ].map((tile) => (
                    <div
                      key={tile.label}
                      className="rounded-lg border border-border bg-muted/50 p-4"
                    >
                      <p className="text-xs text-muted-foreground">
                        {tile.label}
                      </p>
                      <p className="pt-1 text-xl font-semibold tabular-nums">
                        {tile.value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="space-y-3 rounded-lg border border-border p-4">
                  {[
                    { name: "A-1203 · Sharma", amount: "₹4,50,000", tone: "in" },
                    { name: "Cement · Ultratech", amount: "₹1,85,000", tone: "out" },
                    { name: "P-14 · Anita Patil", amount: "₹2,60,000", tone: "in" },
                  ].map((row) => (
                    <div
                      key={row.name}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <IndianRupee className="size-4 text-muted-foreground" />
                        {row.name}
                      </span>
                      <span
                        className={
                          row.tone === "in"
                            ? "font-medium tabular-nums text-primary"
                            : "font-medium tabular-nums text-destructive"
                        }
                      >
                        {row.tone === "in" ? "+" : "-"}
                        {row.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      <section id="features" className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-8">
          <div className="max-w-2xl space-y-3">
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-balance">
              Everything a developer actually needs
            </h2>
            <p className="text-muted-foreground">
              No accounting degree required. Each part connects to the next, so
              one booking updates inventory, collections and reports together.
            </p>
          </div>
          <div className="grid gap-4 pt-10 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="h-full">
                  <CardContent className="space-y-3">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="font-medium">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.body}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-20 text-center md:px-8">
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-balance">
            Know your availability before the buyer asks
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Sign in once and your projects are ready on every device.
          </p>
          {independentMode ? !showDashboard && (
            <SignInButton size="lg" signInText="Start free" />
          ) : <Unauthenticated><SignInButton size="lg" signInText="Start free" /></Unauthenticated>}
          {independentMode ? showDashboard && (
            <Button asChild size="lg">
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
          ) : <Authenticated><Button asChild size="lg"><Link to="/dashboard">Go to dashboard</Link></Button></Authenticated>}
        </div>
      </section>

      <footer className="border-t border-border bg-card/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row md:px-8">
          <Logo />
          <p className="text-sm text-muted-foreground">
            {`© ${year} Mighty Homes. Built on Sravantix Real Estate ERP.`}
          </p>
        </div>
      </footer>
    </div>
  );
}
