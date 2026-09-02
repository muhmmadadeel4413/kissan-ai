import * as React from "react";
import { useFarm } from "../context/FarmContext";
import { useFarmWeather } from "./useFarmWeather";
import { getGrowthStage } from "../lib/growth-stage";
import {
  assessFarmRisks,
  fetchActiveRisks,
} from "../lib/risk-service";
import type { RiskAlert } from "../types";

/**
 * Farm Risk hook (Prompt 8).
 *
 * Combines the existing Farm Context, Weather Intelligence, and Growth Stage
 * engine with the `assess-risks` Edge Function:
 *  - Loads persisted ACTIVE risk alerts immediately (fast, real data).
 *  - Auto-runs a fresh assessment when there is no stored assessment yet and
 *    weather has settled — so a newly set-up farm gets real risks right away.
 *  - Exposes a manual refresh, plus loading / error / retry states.
 *  - Never invents data: everything comes from real farm + weather + diagnosis
 *    inputs evaluated by the rule engine (with optional AI refinement).
 */

export type RiskViewStatus = "loading" | "ready" | "error";

const ASSESSED_KEY_PREFIX = "kissanai.risks.assessedAt.";

export function useFarmRisks() {
  const { farm } = useFarm();
  const { status: weatherStatus, weather } = useFarmWeather();

  const [risks, setRisks] = React.useState<RiskAlert[]>([]);
  const [limitations, setLimitations] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<RiskViewStatus>("loading");
  const [assessing, setAssessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [assessedAt, setAssessedAt] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [triedAssess, setTriedAssess] = React.useState(false);

  const farmId = farm?.id ?? null;

  const readStoredAssessedAt = React.useCallback(() => {
    if (!farmId) return null;
    try {
      return window.localStorage.getItem(ASSESSED_KEY_PREFIX + farmId);
    } catch {
      return null;
    }
  }, [farmId]);

  const writeStoredAssessedAt = React.useCallback(
    (iso: string) => {
      if (!farmId) return;
      try {
        window.localStorage.setItem(ASSESSED_KEY_PREFIX + farmId, iso);
      } catch {
        /* storage may be unavailable — non-critical */
      }
    },
    [farmId]
  );

  /* ------------------------------------------------------------------ */
  /* Load persisted active risks                                         */
  /* ------------------------------------------------------------------ */
  React.useEffect(() => {
    if (!farmId) {
      setRisks([]);
      setStatus("ready");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setError(null);

    fetchActiveRisks(farmId)
      .then((rows) => {
        if (cancelled) return;
        setRisks(rows);
        const latest = rows.length > 0 ? rows[0].createdAt : null;
        setAssessedAt(latest ?? readStoredAssessedAt());
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "We couldn't load your farm risks. Please try again."
        );
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [farmId, attempt, readStoredAssessedAt]);

  /* ------------------------------------------------------------------ */
  /* Run a fresh assessment                                              */
  /* ------------------------------------------------------------------ */
  const runAssessment = React.useCallback(async () => {
    if (!farm || !farmId) return;
    setAssessing(true);
    setError(null);
    try {
      const growth = getGrowthStage(farm.currentCrop, farm.plantingDate);
      const result = await assessFarmRisks({
        farmId,
        weather: weather
          ? {
              temperature: weather.current.temperature,
              humidity: weather.current.humidity,
              rainProbability: weather.current.rainProbability,
              windSpeed: weather.current.windSpeed,
              condition: weather.current.condition,
              forecast: weather.forecast.map((f) => ({
                rainProbability: f.rainProbability,
                temperatureMax: f.temperatureMax,
              })),
            }
          : null,
        growth: {
          cropAgeDays: growth.cropAgeDays,
          growthStage: growth.growthStage,
          stageLabel: growth.stageLabel,
        },
      });
      setRisks(result.risks);
      setLimitations(result.limitations);
      setAssessedAt(result.assessedAt);
      writeStoredAssessedAt(result.assessedAt);
      setStatus("ready");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't update your farm risk assessment right now. Please try again."
      );
      setStatus("error");
    } finally {
      setAssessing(false);
      setTriedAssess(true);
    }
  }, [farm, farmId, weather, writeStoredAssessedAt]);

  /* ------------------------------------------------------------------ */
  /* Auto-assess when no stored assessment exists and weather settled    */
  /* ------------------------------------------------------------------ */
  const hasAnyAssessment = assessedAt !== null || risks.length > 0;
  React.useEffect(() => {
    if (!farmId) return;
    if (triedAssess) return;
    if (hasAnyAssessment) return;
    if (weatherStatus === "loading") return; // wait for weather to settle
    void runAssessment();
  }, [farmId, triedAssess, hasAnyAssessment, weatherStatus, runAssessment]);

  const refresh = React.useCallback(() => {
    setAttempt((a) => a + 1);
    void runAssessment();
  }, [runAssessment]);

  const retry = React.useCallback(() => {
    setAttempt((a) => a + 1);
    setTriedAssess(false);
  }, []);

  const counts = React.useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    for (const r of risks) c[r.level] += 1;
    return c;
  }, [risks]);

  return {
    farm,
    risks,
    counts,
    limitations,
    status,
    assessing,
    error,
    assessedAt,
    refresh,
    retry,
  };
}