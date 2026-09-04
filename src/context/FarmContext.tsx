import * as React from "react";
import { Farm, FarmSetupInput } from "../types";
import {
  createFarmRecord,
  deleteFarmRecord,
  fetchFarm,
  fetchFarmsByOwner,
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
  /** The currently active farm (null when user has no farms). */
  farm: Farm | null;
  /** All farms owned by the authenticated user. */
  farms: Farm[];
  status: FarmStatus;
  error: string | null;
  saving: boolean;
  createFarm: (input: FarmSetupInput) => Promise<Farm>;
  updateFarm: (id: string, patch: Partial<FarmSetupInput>) => Promise<Farm>;
  /** Switch the active farm by ID. Persists to localStorage. */
  switchFarm: (id: string) => Promise<void>;
  /** Delete a farm by ID. If it was the active farm, falls back to first remaining. */
  deleteFarm: (id: string) => Promise<void>;
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
 * The provider observes the auth session: on sign-in it hydrates ALL the
 * user's farms from the database, then selects the active one (persisted ID
 * or first farm). On sign-out all farm state is cleared. Because client
 * queries run under Row Level Security, no foreign farm can ever be loaded.
 */
export function FarmProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [farm, setFarm] = React.useState<Farm | null>(null);
  const [farms, setFarms] = React.useState<Farm[]>([]);
  const [status, setStatus] = React.useState<FarmStatus>("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);

  const loadForUser = React.useCallback(
    async (uid: string | null) => {
      if (!uid) {
        writeActiveFarmId(null);
        setFarm(null);
        setFarms([]);
        setError(null);
        setStatus("ready");
        return;
      }

      setStatus("loading");
      setError(null);
      try {
        // Load ALL farms owned by the user
        const allFarms = await fetchFarmsByOwner();
        setFarms(allFarms);

        // Determine the active farm:
        // 1) Try persisted ID (validate it exists in the list)
        // 2) Fall back to first farm in the list
        let active: Farm | null = null;
        const persistedId = readActiveFarmId();
        if (persistedId) {
          active = allFarms.find((f) => f.id === persistedId) ?? null;
        }
        if (!active && allFarms.length > 0) {
          active = allFarms[0];
        }

        writeActiveFarmId(active ? active.id : null);
        setFarm(active);
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
        const created = await createFarmRecord(input);
        writeActiveFarmId(created.id);
        setFarm(created);
        setFarms((prev) => [created, ...prev]);
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
    async (id: string, patch: Partial<FarmSetupInput>) => {
      setSaving(true);
      setError(null);
      try {
        const updated = await updateFarmRecord(id, patch);
        // Update in the farms list
        setFarms((prev) => prev.map((f) => (f.id === id ? updated : f)));
        // If this is the active farm, update that too
        setFarm((prev) => (prev?.id === id ? updated : prev));
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
    []
  );

  const switchFarm = React.useCallback(
    async (id: string) => {
      // Find the farm in the local list first (fast path)
      const target = farms.find((f) => f.id === id);
      if (target) {
        writeActiveFarmId(id);
        setFarm(target);
        return;
      }
      // Fallback: fetch from DB (handles stale local list)
      const fetched = await fetchFarm(id);
      if (fetched) {
        writeActiveFarmId(id);
        setFarm(fetched);
        setFarms((prev) => {
          const exists = prev.some((f) => f.id === id);
          return exists ? prev : [fetched, ...prev];
        });
      }
    },
    [farms]
  );

  const deleteFarm = React.useCallback(
    async (id: string) => {
      setSaving(true);
      try {
        await deleteFarmRecord(id);
        const remaining = farms.filter((f) => f.id !== id);
        setFarms(remaining);

        // If the deleted farm was active, switch to first remaining
        if (farm?.id === id) {
          const next = remaining.length > 0 ? remaining[0] : null;
          writeActiveFarmId(next ? next.id : null);
          setFarm(next);
        }
      } catch (err) {
        console.error("FarmProvider delete:", err);
        setError("We couldn't delete the farm. Please try again.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [farms, farm]
  );

  const value = React.useMemo(
    () => ({ farm, farms, status, error, saving, createFarm, updateFarm, switchFarm, deleteFarm, retry }),
    [farm, farms, status, error, saving, createFarm, updateFarm, switchFarm, deleteFarm, retry]
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
