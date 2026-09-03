import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { LoadingState } from "../layout/loading-state";
import { usePreferences } from "../../context/PreferencesContext";
import { SupabaseSetupScreen } from "./SupabaseSetupScreen";
import { supabaseReady } from "../../lib/supabase";

/**
 * Route guard for private app pages.
 *
 * While the auth session is still resolving it shows a loading state (never a
 * flash of protected content). If no valid session exists once resolved, the
 * user is redirected to /login — remembering where they wanted to go so they
 * can be returned there after signing in.
 */
export function RequireAuth() {
  const { isAuthenticated, loading } = useAuth();
  const { t } = usePreferences();
  const location = useLocation();

  // If the Supabase integration isn't configured, no session can ever exist —
  // show the friendly setup screen instead of redirecting into a broken login.
  if (!supabaseReady) {
    return <SupabaseSetupScreen />;
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <LoadingState title={t("auth.loadingSession")} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}