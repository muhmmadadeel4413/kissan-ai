import { supabase } from "./supabase";
import type { RiskAlert, RiskAssessment, RiskSource, RiskStatus, RiskType, Level } from "../types";

/**
 * Farm Risk Engine — client data layer (Prompt 8).
 *
 * The real assessment happens server-side in the `assess-risks` Edge Function,
 * which validates the farm, loads real farm + diagnosis data from the
 * database, runs the deterministic rule engine, optionally asks Gemini to
 * explain/prioritise, and persists `risk_alerts` rows via the service role.
 *
 * This module only:
 *   1. reads back persisted, active risk alerts for the farm, and
 *   2. asks the Edge Function to (re)assess.
 * No risk record is ever fabricated client-side.
 */

/* ------------------------------------------------------------------ */
/* Row shape from the `risk_alerts` table (snake_case)                 */
/* ------------------------------------------------------------------ */

export interface RiskAlertRow {
  id: string;
  farm_id: string;
  risk_type: RiskType;
  level: Level;
  title: string;
  explanation: string;
  evidence: string[] | null;
  recommended_actions: string[] | null;
  status: RiskStatus;
  source: RiskSource;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

function mapRow(row: RiskAlertRow): RiskAlert {
  return {
    id: row.id,
    farmId: row.farm_id,
    riskType: row.risk_type,
    level: row.level,
    title: row.title,
    explanation: row.explanation,
    evidence: row.evidence ?? [],
    recommendedActions: row.recommended_actions ?? [],
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

/** Never surface raw DB/network errors to the UI. */
function friendlyError(err: unknown, fallback: string): never {
  console.error("risk-service:", err);
  throw new Error(fallback);
}

/** Extract a human-friendly message from a Supabase Edge Function error. */
async function edgeErrorToMessage(err: unknown): Promise<string> {
  const e = err as {
    context?: { text?: () => Promise<string> };
    message?: string;
  };
  if (e?.context && typeof e.context.text === "function") {
    try {
      const text = await e.context.text();
      const parsed = JSON.parse(text) as { error?: string };
      return parsed.error || "We couldn't update your farm risk assessment right now. Please try again.";
    } catch {
      return "We couldn't update your farm risk assessment right now. Please try again.";
    }
  }
  return e?.message || "We couldn't update your farm risk assessment right now. Please try again.";
}

/* ------------------------------------------------------------------ */
/* Read persisted alerts                                               */
/* ------------------------------------------------------------------ */

/**
 * Fetch the currently-active risk alerts for a farm, strongest first
 * (high → medium → low, then most recent). Only real persisted rows.
 */
export async function fetchActiveRisks(farmId: string | null | undefined): Promise<RiskAlert[]> {
  if (!farmId) return [];

  const { data, error } = await supabase
    .from("risk_alerts")
    .select("*")
    .eq("farm_id", farmId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    friendlyError(error, "We couldn't load your farm risks. Please try again.");
  }

  const rows = (data as RiskAlertRow[] | null) ?? [];
  const ordered = orderByLevel(rows.map(mapRow));
  return ordered;
}

/** Sort active risks: high first, then medium, then low, most recent first. */
function orderByLevel(risks: RiskAlert[]): RiskAlert[] {
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return [...risks].sort(
    (a, b) =>
      rank[a.level] - rank[b.level] || +new Date(b.createdAt) - +new Date(a.createdAt)
  );
}

/* ------------------------------------------------------------------ */
/* Trigger a (re)assessment                                            */
/* ------------------------------------------------------------------ */

export interface AssessRisksInput {
  farmId: string;
  /** Real weather snapshot already fetched via the existing weather system. */
  weather?: {
    temperature?: number;
    humidity?: number;
    rainProbability?: number;
    windSpeed?: number;
    condition?: string;
    forecast?: Array<{ rainProbability?: number; temperatureMax?: number }>;
  } | null;
  /** Real growth stage from the existing growth-stage engine. */
  growth?: {
    cropAgeDays: number | null;
    growthStage: string;
    stageLabel: string;
  } | null;
}

/**
 * Ask the Edge Function to (re)assess risks for the farm. Returns the
 * freshly-persisted assessment (or an empty assessment when no risks found).
 */
export async function assessFarmRisks(input: AssessRisksInput): Promise<RiskAssessment> {
  const { data, error } = await supabase.functions.invoke("assess-risks", {
    body: {
      farmId: input.farmId,
      weather: input.weather ?? null,
      growth: input.growth ?? null,
    },
  });

  if (error) {
    friendlyError(error, await edgeErrorToMessage(error));
  }

  const payload = data as {
    success?: boolean;
    assessedAt?: string;
    risks?: RiskAlertRow[];
    limitations?: string[];
    error?: string;
  };

  if (!payload?.success) {
    friendlyError(
      payload?.error,
      payload?.error || "We couldn't update your farm risk assessment right now. Please try again."
    );
  }

  return {
    risks: orderByLevel((payload.risks ?? []).map(mapRow)),
    assessedAt: payload.assessedAt ?? new Date().toISOString(),
    limitations: payload.limitations ?? [],
  };
}