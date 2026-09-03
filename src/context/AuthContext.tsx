import * as React from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseReady } from "../lib/supabase";
import { isNetworkError } from "../lib/supabase-errors";

/**
 * Centralized authentication state for Kissan AI.
 *
 * Supabase Auth is the single source of truth. This provider:
 *   - hydrates the current session once on mount,
 *   - subscribes to `onAuthStateChange` so sign-in / sign-out / token refresh
 *     are reflected immediately across the app,
 *   - exposes `user`, `session`, `loading`, and `isAuthenticated`,
 *   - wraps every auth call (signUp / signIn / signOut / password reset) with
 *     safe, human-friendly error mapping so raw Supabase errors never reach
 *     the user.
 */

interface AuthContextValue {
  /** The authenticated Supabase user, or null when signed out. */
  user: User | null;
  /** The raw session (includes the access/refresh tokens). */
  session: Session | null;
  /** True while the initial session is being resolved (prevents flash). */
  loading: boolean;
  isAuthenticated: boolean;
  /** Optional full name is stored as Supabase user metadata (`full_name`). */
  signUp: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

/** Map a Supabase error to a short, human-friendly message (never raw internals). */
function friendlyMessage(error: { code?: string; message?: string }, fallback: string): string {
  const code = (error?.code ?? "").toLowerCase();
  const raw = (error?.message ?? "").toLowerCase();
  if (
    code === "user_already_exists" ||
    raw.includes("already registered") ||
    raw.includes("already exists")
  ) {
    return "An account with this email already exists.";
  }
  if (code === "invalid_credentials" || raw.includes("invalid login credentials")) {
    return "Incorrect email or password. Please try again.";
  }
  if (raw.includes("email not confirmed")) {
    return "Please confirm your email address, then log in.";
  }
  if (code === "email_address_invalid") {
    return "Please enter a valid email address.";
  }
  if (code === "weak_password") {
    return "Password must be at least 6 characters.";
  }
  return fallback;
}

const NETWORK_BODY = "We couldn't reach the server. Check your connection and try again.";

/** Wrap an auth failure, converting network errors into a friendly message. */
function asFriendlyError(err: unknown, fallback: string): Error {
  if (isNetworkError(err)) return new Error(NETWORK_BODY);
  return new Error(friendlyMessage((err as { message?: string }) || {}, fallback));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    // When Supabase isn't configured yet, don't touch the client — the setup
    // gate screen is shown instead, and we must not even read `supabase.auth`
    // here (it would throw the "not configured" error during mount).
    if (!supabaseReady) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    // Hydrate the persisted session (also detects password-recovery redirects,
    // which Supabase places into the URL fragment).
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // React to sign-in, sign-out, user updates, and token refresh.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      isAuthenticated: Boolean(user),

      async signUp(email, password, fullName) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          // Redirect back to the app origin (required for NativelyAI preview
          // environments so the post-confirmation redirect lands inside the
          // preview panel). Supabase's redirect allowlist already includes the
          // ephemeral preview origins.
          options: {
            emailRedirectTo: window.location.origin,
            ...(fullName ? { data: { full_name: fullName } } : {}),
          },
        });
        if (error) {
          // A network error usually means the browser never got the response —
          // but the request may well have reached Supabase and created the
          // account anyway (e.g. a dropped mobile connection). Try to sign in
          // to recover instead of leaving the user at a dead-end error.
          if (isNetworkError(error)) {
            const login = await supabase.auth.signInWithPassword({ email, password });
            if (!login.error) {
              // Account was actually created — the session is now set and the
              // app continues as a normal sign-in.
              return { needsEmailConfirmation: false };
            }
          }
          throw asFriendlyError(error, "We couldn't create your account. Please try again.");
        }
        // If email confirmation is enabled, Supabase returns no session; if it
        // is disabled, the returned session is non-null. Report the real state.
        const needsEmailConfirmation = !data.session;
        return { needsEmailConfirmation };
      },

      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          throw asFriendlyError(error, "Incorrect email or password. Please try again.");
        }
      },

      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw new Error("We couldn't log you out. Please try again.");
        }
      },

      async resetPasswordForEmail(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) {
          throw asFriendlyError(
            error,
            "We couldn't send a reset link. Please try again."
          );
        }
      },

      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          throw asFriendlyError(
            error,
            "We couldn't update your password. Please try again."
          );
        }
      },
    }),
    [user, session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}