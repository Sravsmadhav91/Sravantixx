import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthCallback } from "@usehercules/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Button } from "@/components/ui/button.tsx";
import { supabaseAuthEnabled } from "@/components/providers/auth.tsx";
import { supabase } from "@/lib/supabase.ts";

function SupabaseCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    const finishSignIn = async () => {
      if (!supabase) {
        navigate("/", { replace: true });
        return;
      }
      const code = new URL(window.location.href).searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } else {
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.getSession();
          if (error) throw error;
        }
      }
      window.history.replaceState({}, document.title, `${window.location.origin}/`);
      navigate("/", { replace: true });
    };
    void finishSignIn().catch(() => {
      window.history.replaceState({}, document.title, `${window.location.origin}/`);
      navigate("/", { replace: true });
    });
  }, [navigate]);
  return (
    <div className="flex flex-col items-center justify-center h-svh gap-4">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">Signing you in...</p>
    </div>
  );
}

export default function AuthCallback() {
  if (supabaseAuthEnabled) return <SupabaseCallback />;

  const navigate = useNavigate();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);

  const onSync = useCallback(async () => {
    await updateCurrentUser();
  }, [updateCurrentUser]);

  const navigateHome = useCallback(
    () => navigate("/", { replace: true }),
    [navigate],
  );

  const { status, error, retry } = useAuthCallback({
    isBackendAuthenticated: isConvexAuthenticated,
    onSync,
    onSuccess: navigateHome,
    onNoAuthParams: navigateHome,
  });

  if (status === "error" && error) {
    return (
      <div className="flex flex-col items-center justify-center h-svh gap-6 px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-destructive font-medium">Something went wrong</p>
          <p className="text-sm text-muted-foreground max-w-md">{error}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={navigateHome}>
            Return home
          </Button>
          <Button onClick={retry}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-svh gap-4">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}
