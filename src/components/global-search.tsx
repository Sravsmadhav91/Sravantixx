import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { Building2, Hash, Search, TrendingUp, Users } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command.tsx";
import { useDebounce } from "@/hooks/use-debounce.ts";

type GlobalSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 200);

  const hasQuery = open && debouncedQuery.trim().length >= 1;

  const buyers = useQuery(
    api.buyers.list,
    hasQuery ? { search: debouncedQuery.trim() } : "skip",
  );
  const projects = useQuery(
    api.projects.search,
    hasQuery ? { search: debouncedQuery.trim() } : "skip",
  );
  const leads = useQuery(
    api.leads.list,
    hasQuery ? { search: debouncedQuery.trim() } : "skip",
  );

  // Reset query when closed
  const handleOpenChange = (next: boolean) => {
    if (!next) setQuery("");
    onOpenChange(next);
  };

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const hasResults =
    (buyers?.length ?? 0) > 0 || (projects?.length ?? 0) > 0 || (leads?.length ?? 0) > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Quick search"
      description="Search buyers, projects, and leads"
    >
      <CommandInput
        placeholder="Search buyers, projects, leads…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {debouncedQuery.trim().length >= 1 ? (
          <>
            {!hasResults && (
              <CommandEmpty>No results for "{debouncedQuery}"</CommandEmpty>
            )}

            {(projects?.length ?? 0) > 0 && (
              <CommandGroup heading="Projects">
                {(projects ?? []).slice(0, 6).map((p) => (
                  <CommandItem
                    key={p._id}
                    value={`project-${p._id}`}
                    onSelect={() => go(`/projects/${p._id}`)}
                  >
                    <Building2 className="size-4 text-muted-foreground" />
                    <span>{p.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {p.code}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {(projects?.length ?? 0) > 0 && (buyers?.length ?? 0) > 0 && (
              <CommandSeparator />
            )}

            {(buyers?.length ?? 0) > 0 && (
              <CommandGroup heading="Buyers">
                {(buyers ?? []).slice(0, 6).map((b) => (
                  <CommandItem
                    key={b._id}
                    value={`buyer-${b._id}`}
                    onSelect={() => go(`/buyers/${b._id}`)}
                  >
                    <Users className="size-4 text-muted-foreground" />
                    <span>{b.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {b.phone}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {(buyers?.length ?? 0) > 0 && (leads?.length ?? 0) > 0 && (
              <CommandSeparator />
            )}

            {(leads?.length ?? 0) > 0 && (
              <CommandGroup heading="Leads">
                {(leads ?? []).slice(0, 6).map((l) => (
                  <CommandItem
                    key={l._id}
                    value={`lead-${l._id}`}
                    onSelect={() => go(`/leads`)}
                  >
                    <TrendingUp className="size-4 text-muted-foreground" />
                    <span>{l.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {l.phone}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        ) : (
          /* Shortcut hints when no query typed yet */
          <CommandGroup heading="Quick links">
            {[
              { label: "Dashboard", path: "/dashboard", icon: Hash },
              { label: "Projects", path: "/projects", icon: Building2 },
              { label: "Buyers", path: "/buyers", icon: Users },
              { label: "Bookings", path: "/bookings", icon: Hash },
              { label: "Collections", path: "/collections", icon: Hash },
              { label: "Leads", path: "/leads", icon: Hash },
            ].map(({ label, path, icon: Icon }) => (
              <CommandItem
                key={path}
                value={`nav-${path}`}
                onSelect={() => go(path)}
              >
                <Icon className="size-4 text-muted-foreground" />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      <div className="flex items-center gap-1 border-t px-3 py-2 text-xs text-muted-foreground">
        <Search className="size-3" />
        <span>Type to search buyers, projects, and leads by name</span>
        <span className="ml-auto flex items-center gap-1">
          <kbd className="rounded border px-1 font-mono">↑↓</kbd> to navigate
          <kbd className="rounded border px-1 font-mono">↵</kbd> to open
          <kbd className="rounded border px-1 font-mono">Esc</kbd> to close
        </span>
      </div>
    </CommandDialog>
  );
}
