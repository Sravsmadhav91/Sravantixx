import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase.ts";

type SupabaseAuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  signin: (email: string) => Promise<void>;
  signinWithGoogle: () => Promise<void>;
  signout: () => Promise<void>;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(null);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data, error: authError }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      if (authError) setError(authError);
      setIsLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<SupabaseAuthContextValue>(() => ({
    user,
    isAuthenticated: user !== null,
    isLoading,
    error,
    signin: async (email) => {
      if (!supabase) throw new Error("Supabase authentication is not configured");
      setError(null);
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (authError) {
        setError(authError);
        throw authError;
      }
    },
    signinWithGoogle: async () => {
      if (!supabase) throw new Error("Supabase authentication is not configured");
      setError(null);
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (authError) {
        setError(authError);
        throw authError;
      }
    },
    signout: async () => {
      if (!supabase) return;
      const { error: authError } = await supabase.auth.signOut();
      setUser(null);
      if (authError) throw authError;
    },
  }), [error, isLoading, user]);

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (!context) throw new Error("useSupabaseAuth must be used inside SupabaseAuthProvider");
  return context;
}

export function useOptionalSupabaseAuth() {
  return useContext(SupabaseAuthContext);
}