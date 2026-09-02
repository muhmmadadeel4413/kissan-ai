import * as React from "react";
import { fetchRecentActivity, type ActivityItem } from "../lib/activity-service";

export type RecentActivityStatus = "loading" | "ready" | "error";

/**
 * Loads the recent-activity timeline for a farm. Independent of every other
 * dashboard section — a failure here never blocks the rest of the page, and
 * an empty result maps to a proper empty state (not an error).
 */
export function useRecentActivity(farmId: string | null | undefined) {
  const [items, setItems] = React.useState<ActivityItem[]>([]);
  const [status, setStatus] = React.useState<RecentActivityStatus>("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    if (!farmId) {
      setItems([]);
      setError(null);
      setStatus("ready");
      return;
    }

    setStatus("loading");
    setError(null);
    fetchRecentActivity(farmId)
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setError(result.error);
        setStatus(result.error ? "error" : "ready");
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setError("We couldn't load your recent activity. Please try again.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [farmId, reloadKey]);

  const retry = React.useCallback(() => setReloadKey((k) => k + 1), []);

  return { items, status, error, retry };
}