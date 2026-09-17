import { Outlet, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useRole } from "@/hooks/use-role.ts";
import { NAV_ITEMS } from "./nav-items.ts";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";

/**
 * Blocks access to a route whose module the current role can't reach (e.g. a Sales
 * team member typing /accounting directly into the address bar). The sidebar/bottom
 * nav already hide these links, so this only matters for direct navigation.
 */
export default function RequireModuleAccess() {
  const { canAccess, isLoading } = useRole();
  const location = useLocation();

  // Not every route has a nav entry (e.g. detail pages nested under a listed module).
  // Match by longest "to" prefix so /collections/:id inherits the /collections module.
  const matched = [...NAV_ITEMS]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

  if (isLoading) return null;
  if (!matched || canAccess(matched.module)) {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Empty className="max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldAlert />
          </EmptyMedia>
          <EmptyTitle>You don't have access to this section</EmptyTitle>
          <EmptyDescription>
            Your role doesn't include {matched.label}. Contact your account owner if you need access.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
