import { forwardRef, useCallback, useEffect, useState } from "react";
import { type VariantProps } from "class-variance-authority";
import { ArrowRight, Loader2, LogIn, LogOut, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth.ts";
import { supabaseAuthEnabled } from "@/components/providers/auth.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { buttonVariants } from "@/components/ui/button.tsx";
import Logo from "@/components/logo.tsx";

export interface SignInButtonProps
  extends
    Omit<React.ComponentProps<"button">, "onClick">,
    VariantProps<typeof buttonVariants> {
  /**
   * Custom onClick handler that runs before authentication action
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /**
   * Whether to show icons in the button
   * @default true
   */
  showIcon?: boolean;
  /**
   * Custom text for sign in state
   * @default "Sign In"
   */
  signInText?: string;
  /**
   * Custom text for sign out state
   * @default "Sign Out"
   */
  signOutText?: string;
  /**
   * Custom text for loading state
   * @default "Signing In..." or "Signing Out..."
   */
  loadingText?: string;
  /**
   * Whether to use the asChild pattern
   * @default false
   */
  asChild?: boolean;
}

/**
 * A button component that handles authentication sign in/out with proper loading states
 * and accessibility features.
 */
export const SignInButton = forwardRef<HTMLButtonElement, SignInButtonProps>(
  (
    {
      onClick,
      disabled,
      showIcon = true,
      signInText = "Sign In",
      signOutText = "Sign Out",
      loadingText,
      className,
      variant,
      size,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const activeAuth = useAuth();
    const [emailOpen, setEmailOpen] = useState(false);
    const [email, setEmail] = useState("");
    const { isAuthenticated, isLoading, error } = activeAuth;

    useEffect(() => {
      if (error) {
        toast.error("Login error", {
          description: error.message,
        });
        console.error("Login error", error);
      }
    }, [error]);

    const handleClick = useCallback(
      async (event: React.MouseEvent<HTMLButtonElement>) => {
        // Run custom onClick first
        onClick?.(event);

        try {
          if (isAuthenticated) {
            await activeAuth.signout();
          } else if (supabaseAuthEnabled) {
            setEmailOpen(true);
          } else {
            await activeAuth.signin();
          }
        } catch (err) {
          console.error("Authentication error:", err);
          // Don't prevent the default here as the auth library handles errors
        }
      },
      [activeAuth, isAuthenticated, onClick],
    );

    const isDisabled = disabled || isLoading;
    const defaultLoadingText = isAuthenticated
      ? "Signing Out..."
      : "Signing In...";
    const currentLoadingText = loadingText || defaultLoadingText;

    const buttonText = isLoading
      ? currentLoadingText
      : isAuthenticated
        ? signOutText
        : signInText;

    const icon = isLoading ? (
      <Loader2 className="size-4 animate-spin" />
    ) : isAuthenticated ? (
      <LogOut className="size-4" />
    ) : (
      <LogIn className="size-4" />
    );

    return (
      <>
      <Button
        ref={ref}
        onClick={handleClick}
        disabled={isDisabled}
        variant={variant}
        size={size}
        className={className}
        asChild={asChild}
        aria-label={
          isAuthenticated
            ? "Sign out of your account"
            : "Sign in to your account"
        }
        aria-describedby={error ? "auth-error" : undefined}
        {...props}
      >
        {showIcon && icon}
        {buttonText}
      </Button>
      {supabaseAuthEnabled && <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="overflow-hidden border-border/80 bg-background p-0 shadow-2xl sm:max-w-md">
          <div className="border-b border-emerald-900/10 bg-emerald-50 px-6 pb-5 pt-7 dark:bg-emerald-950/30">
            <div className="mb-6 flex items-start justify-between gap-4">
              <Logo className="[&_img]:h-12" />
              <span className="rounded-full border border-amber-300/70 bg-amber-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-200">
                Secure access
              </span>
            </div>
            <DialogHeader className="gap-2 text-left">
              <DialogTitle className="text-2xl tracking-tight">Welcome back</DialogTitle>
              <DialogDescription className="max-w-sm text-sm leading-6">
                Sign in to manage projects, bookings, collections and documents in one place.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-5 px-6 py-6">
            <Button variant="outline" className="h-11 w-full justify-between border-slate-300 bg-white px-4 text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900" onClick={() => { void activeAuth.signinWithGoogle().catch((error) => toast.error(error instanceof Error ? error.message : "Google sign-in failed")); }}>
              <span className="flex items-center gap-3"><span className="flex size-6 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-[#4285f4] shadow-sm">G</span>Continue with Google</span>
              <ArrowRight className="size-4" />
            </Button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" /><span>or continue with email</span><div className="h-px flex-1 bg-border" /></div>
            <div className="space-y-2">
              <label htmlFor="signin-email" className="text-sm font-medium">Work email</label>
              <Input id="signin-email" type="email" placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} autoFocus />
              <p className="text-xs leading-5 text-muted-foreground">We will send a one-time sign-in link. No password required.</p>
            </div>
            <DialogFooter className="sm:justify-between">
              <Button variant="ghost" onClick={() => setEmailOpen(false)}>Cancel</Button>
              <Button className="gap-2" onClick={() => { if (email.trim()) { void activeAuth.signin(email.trim()); setEmailOpen(false); } }}><Mail className="size-4" />Send sign-in link</Button>
            </DialogFooter>
            <div className="flex items-center justify-center gap-2 border-t border-border/70 pt-4 text-xs text-muted-foreground"><ShieldCheck className="size-3.5 text-primary" />Your account and business data stay protected.</div>
          </div>
        </DialogContent>
      </Dialog>}
      </>
    );
  },
);

SignInButton.displayName = "SignInButton";
