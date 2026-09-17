import { AuthProvider } from "./auth.tsx";
import { supabaseAuthEnabled } from "./auth.tsx";
import { ConvexProvider } from "./convex.tsx";
import { QueryClientProvider } from "./query-client.tsx";
import { ThemeProvider } from "./theme.tsx";
import { Toaster } from "../ui/sonner.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  const content = (
    <QueryClientProvider>
      <TooltipProvider>
        <ThemeProvider>
          <Toaster />
          {children}
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );

  return (
    <AuthProvider>
      {supabaseAuthEnabled ? content : <ConvexProvider>{content}</ConvexProvider>}
    </AuthProvider>
  );
}
