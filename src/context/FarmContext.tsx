import * as React from "react";
import { Farm, FarmSetupInput } from "../types";
import {
  createFarmRecord,
  deleteFarmRecord,
  fetchFarm,
  fetchFarmByOwner,
  updateFarmRecord,
} from "../lib/farm-service";
import { useAuth } from "./AuthContext";

/**
 * The active farm is identified by its Supabase UUID, persisted in
 * localStorage so the user's farm follows them across sessions/devices.
 *
 * IMPORTANT: the persisted ID is ONLY a UI/state convenience. It is never
 * treated as authorization — Row Level Security on the database scopes every
 * read/write to farms the authenticated user actually owns (user_id =
 * auth.uid()). If a stale or foreign ID is present in storage, the load
 * simply resolves to the user's real owned farm (or null when they have none).
 */
const ACTIVE_FARM_KEY = "kissanai.activeFarmId.v1";

type FarmStatus = "loading" | "ready" | "error";

interface FarmContextValue {
  farm: Farm | null;
  status: FarmStatus;
  error: string | null;
  saving: boolean;
  createFarm: (input: FarmSetupInput) => Promise<Farm>;
  updateFarm: (patch: Partial<FarmSetupInput>) => Promise<Farm>;
  clearFarm: () => Promise<void>;
  retry: () => void;
}

const FarmContext = React.createContext<FarmContextValue | null>(null);

function readActiveFarmId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_FARM_KEY);
  } catch {
    return null;
  }
}

function writeActiveFarmId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_FARM_KEY, id);
    else window.localStorage.removeItem(ACTIVE_FARM_KEY);
  } catch {
    // Storage may be unavailable (private mode etc.) — context still works.
  }
}

/**
 * Farm state backed by Supabase and scoped to the authenticated user.
 *
 * The provider observes the auth session: on sign-in it hydrates the user's
 * owned farm from the database (the persisted ID, when valid, is reused;
 * otherwise the user's real farm is discovered). On sign-out all farm state is
 * cleared. Because client queries run under Row Level Security, no foreign farm
 * can ever be loaded — the persisted id is merely a convenience.
 */
export function FarmProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [farm, setFarm] = React.useState<Farm | null>(null);
  const [status, setStatus] = React.useState<FarmStatus>("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);

  const loadForUser = React.useCallback(
    async (uid: string | null) => {
      // Not signed in → no farm, nothing persisted.
      if (!uid) {
        writeActiveFarmId(null);
        setFarm(null);
        setError(null);
        setStatus("ready");
        return;
      }

      setStatus("loading");
      setError(null);
      try {
        // 1) Try the persisted ID (UI convenience). RLS guarantees this only
        // matches a farm the user owns; a foreign/deleted id returns null.
        let loaded: Farm | null = null;
        const persistedId = readActiveFarmId();
        if (persistedId) {
          loaded = await fetchFarm(persistedId);
        }
        if (!loaded) {
          // 2) No valid persisted farm → discover the user's actual farm.
          loaded = await fetchFarmByOwner();
        }
        writeActiveFarmId(loaded ? loaded.id : null);
        setFarm(loaded);
        setStatus("ready");
      } catch (err) {
        console.error("FarmProvider load:", err);
        setError(
          err instanceof Error && err.message
            ? err.message
            : "We couldn't load your farm. Please check your connection and try again."
        );
        setStatus("error");
      }
    },
    []
  );

  // Whenever the auth user changes (or the session resolves, or a manual
  // retry happens) reload the owned farm. authLoading guards the initial mount
  // so we never flash protected content or a stale farm.
  React.useEffect(() => {
    if (authLoading) {
      setStatus("loading");
      return;
    }
    void loadForUser(userId);
  }, [authLoading, userId, reloadKey, loadForUser]);

  const retry = React.useCallback(() => setReloadKey((k) => k + 1), []);

  const createFarm = React.useCallback(
    async (input: FarmSetupInput) => {
      setSaving(true);
      setError(null);
      try {
        // The DB trigger sets user_id = auth.uid(); the browser cannot choose
        // another owner. Returns the created farm and persists it.
        const created = await createFarmRecord(input);
        writeActiveFarmId(created.id);
        setFarm(created);
        setStatus("ready");
        return created;
      } catch (err) {
        console.error("FarmProvider create:", err);
        setError("We couldn't save your farm. Please try again.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const updateFarm = React.useCallback(
    async (patch: Partial<FarmSetupInput>) => {
      if (!farm) throw new Error("No active farm to update.");
      setSaving(true);
      setError(null);
      try {
        // RLS restricts the UPDATE to the owned row only.
        const updated = await updateFarmRecord(farm.id, patch);
        setFarm(updated);
        setStatus("ready");
        return updated;
      } catch (err) {
        console.error("FarmProvider update:", err);
        setError("We couldn't save your changes. Please try again.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [farm]
  );

  const clearFarm = React.useCallback(async () => {
    setSaving(true);
    try {
      if (farm) await deleteFarmRecord(farm.id);
    } catch (err) {
      console.error("FarmProvider clear:", err);
    } finally {
      writeActiveFarmId(null);
      setFarm(null);
      setStatus("ready");
      setError(null);
      setSaving(false);
    }
  }, [farm]);

  const value = React.useMemo(
    () => ({ farm, status, error, saving, createFarm, updateFarm, clearFarm, retry }),
    [farm, status, error, saving, createFarm, updateFarm, clearFarm, retry]
  );

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm(): FarmContextValue {
  const ctx = React.useContext(FarmContext);
  if (!ctx) {
    throw new Error("useFarm must be used within a FarmProvider");
  }
  return ctx;
}