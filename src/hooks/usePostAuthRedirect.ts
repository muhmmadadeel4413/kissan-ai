import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFarm } from "../context/FarmContext";

/**
 * Whether an authenticated user has somewhere to go, and where.
 *
 * Works with the auth + farm providers: while the session or the user's owned
 * farm is still loading it stays "idle"; as soon as both are known it resolves
 * to `/dashboard` when the user owns a farm, or `/farm-setup` when they do not
 * (e.g. right after signup). This keeps post-login routing database-driven.
 */
export function useDestination(destination: "login" | "public" = "login") {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const { farm, status } = useFarm();

  const ready = !loading && status !== "loading";
  const target = farm ? "/dashboard" : "/farm-setup";

  // Auth-only pages (login/signup/forgot) bounce authenticated users away.
  const shouldLeaveAuthPage = destination === "login" && isAuthenticated && ready;

  const go = () => navigate(target, { replace: true });

  return {
    isAuthenticated,
    authLoading: loading,
    farmReady: status !== "loading",
    farmLoading: status === "loading",
    target,
    shouldLeaveAuthPage,
    go,
  };
}

/** Kept for backwards compatibility with the auth pages' import name. */
export const usePostAuthRedirect = useDestination;