import * as React from "react";
import { useFarm } from "../context/FarmContext";
import { useFarmWeather } from "./useFarmWeather";
import {
  fetchTodayActions,
  generateTodayActions,
  setActionCompleted,
  todayActionDate,
} from "../lib/actions-service";
import type { ActionItem } from "../types";

/**
 * "What Should I Do Today?" — Decision Engine hook (Prompt 10).
 *
 * Combines the existing Farm Context, Weather Intelligence, Growth Stage
 * engine, persisted diagnoses and risks (loaded server-side by the Edge
 * Function) into today's prioritized action feed:
 *  - Loads persisted actions for today immediately (fast, real data, NO AI).
 *  - Auto-runs the Decision Engine only when there are no saved actions for
 *    today and weather has settled — so a freshly set-up farm gets actions
 *    right away without calling Gemini on every page render.
 *  - Exposes a manual refresh, completion toggling, and loading/error states.
 *  - Never invents data; everything comes from the validated Edge Function.
 */

export type TodayActionsStatus = "loading" | "ready" | "error";

export function useTodayActions() {
  const { farm } = useFarm();
  const { status: weatherStatus, weather } = useFarmWeather();

  const [actions, setActions] = React.useState<ActionItem[]>([]);
  const [summary, setSummary] = React.useState("");
  const [limitations, setLimitations] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<TodayActionsStatus>("loading");
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [insufficientData, setInsufficientData] = React.useState(false);
  const [generatedAt, setGeneratedAt] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [triedGenerate, setTriedGenerate] = React.useState(false);

  const farmId = farm?.id ?? null;

  /* ------------------------------------------------------------------ */
  /* Load persisted actions for today (no AI on render)                  */
  /* ------------------------------------------------------------------ */
  React.useEffect(() => {
    if (!farmId) {
      setActions([]);
      setInsufficientData(false);
      setStatus("ready");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setError(null);

    fetchTodayActions(farmId)
      .then((rows) => {
        if (cancelled) return;
        setActions(rows);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "We couldn't load today's actions. Please try again."
        );
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [farmId, attempt]);

  /* ------------------------------------------------------------------ */
  /* Run the Decision Engine                                             */
  /* ------------------------------------------------------------------ */
  const runGenerate = React.useCallback(async () => {
    if (!farm || !farmId) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateTodayActions({
        farmId,
        weather: weather
          ? {
              temperature: weather.current.temperature,
              humidity: weather.current.humidity,
              rainProbability: weather.current.rainProbability,
              windSpeed: weather.current.windSpeed,
              condition: weather.current.condition,
              forecast: weather.forecast.map((f) => ({
                date: f.date,
                condition: f.condition ?? f.conditionCode,
                temperatureMax: f.temperatureMax,
                rainProbability: f.rainProbability,
                windSpeed: f.windSpeed,
              })),
            }
          : null,
      });
      setActions(result.actions);
      setSummary(result.summary);
      setLimitations(result.limitations);
      setInsufficientData(result.insufficientData);
      setGeneratedAt(result.generatedAt);
      setStatus("ready");
    } catch (err) {
      // On failure keep any previous valid actions visible and just indicate
      // that the refresh failed — never replace them with fake actions.
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't update today's actions right now. Please try again."
      );
      if (actions.length === 0) setStatus("error");
    } finally {
      setGenerating(false);
      setTriedGenerate(true);
    }
  }, [farm, farmId, weather, actions.length]);

  /* ------------------------------------------------------------------ */
  /* Auto-generate only when no actions exist for today + weather ready  */
  /* ------------------------------------------------------------------ */
  const hasActions = actions.length > 0;
  React.useEffect(() => {
    if (!farmId) return;
    if (triedGenerate) return;
    if (hasActions) return;
    if (weatherStatus === "loading") return; // wait for weather to settle
    void runGenerate();
  }, [farmId, triedGenerate, hasActions, weatherStatus, runGenerate]);

  const refresh = React.useCallback(() => {
    setAttempt((a) => a + 1);
    void runGenerate();
  }, [runGenerate]);

  const retry = React.useCallback(() => {
    setAttempt((a) => a + 1);
    setTriedGenerate(false);
  }, []);

  /* ------------------------------------------------------------------ */
  /* Completion                                                          */
  /* ------------------------------------------------------------------ */
  const markDone = React.useCallback(async (actionId: string, completed: boolean) => {
    try {
      const updated = await setActionCompleted(actionId, completed);
      setActions((prev) =>
        prev.map((a) => (a.id === actionId ? updated : a))
      );
      return updated;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't update this action. Please try again."
      );
      throw err;
    }
  }, []);

  return {
    farm,
    actions,
    summary,
    limitations,
    status,
    generating,
    error,
    insufficientData,
    generatedAt,
    actionDate: todayActionDate(),
    refresh,
    retry,
    markDone,
  };
}