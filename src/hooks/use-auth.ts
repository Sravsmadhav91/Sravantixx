import { useAuth as useHerculesAuth, useUser as useHerculesUser } from "@usehercules/auth/react";
import { supabaseAuthEnabled } from "@/components/providers/auth.tsx";
import { useOptionalSupabaseAuth } from "@/components/providers/supabase-auth.tsx";

export type AuthUser = {
	profile: {
		name?: string;
		email?: string;
		avatar?: string;
	};
};

export type AppAuth = {
  user: AuthUser | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	error: Error | null;
	signin: (email?: string) => Promise<void>;
  signout: () => Promise<void>;
};

export function useAuth(): AppAuth {
	if (supabaseAuthEnabled) {
		const supabaseAuth = useOptionalSupabaseAuth();
		return {
			user: supabaseAuth!.user
				? {
						profile: {
							name: supabaseAuth!.user.user_metadata?.name ?? supabaseAuth!.user.email ?? "User",
							email: supabaseAuth!.user.email,
							avatar: supabaseAuth!.user.user_metadata?.avatar_url,
						},
					}
				: null,
			isAuthenticated: supabaseAuth!.isAuthenticated,
			isLoading: supabaseAuth!.isLoading,
			error: supabaseAuth!.error,
				signin: async (email) => {
					if (email) await supabaseAuth!.signin(email);
			},
			signout: supabaseAuth!.signout,
		};
	}
	const herculesAuth = useHerculesAuth();
	return {
		user: (herculesAuth.user as AuthUser | null) ?? null,
		isAuthenticated: herculesAuth.isAuthenticated,
		isLoading: herculesAuth.isLoading,
		error: herculesAuth.error ?? null,
		signin: async () => { await herculesAuth.signin(); },
		signout: herculesAuth.signout,
	};
}

export function useUser(): AuthUser | null {
	if (supabaseAuthEnabled) {
		const supabaseAuth = useOptionalSupabaseAuth();
		const user = supabaseAuth?.user ?? null;
		return user
			? {
					profile: {
						name: user.user_metadata?.name ?? user.email ?? "User",
						email: user.email,
						avatar: user.user_metadata?.avatar_url,
					},
				}
			: null;
	}
	const user = useHerculesUser();
	return user ? (user as AuthUser) : null;
}
