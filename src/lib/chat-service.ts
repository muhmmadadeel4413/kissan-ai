import { supabase } from "./supabase";
import { getGrowthStage } from "./growth-stage";
import type { ChatMessage, Diagnosis, Farm, Severity } from "../types";

/**
 * AI Assistant data layer.
 *
 * The real AI answer happens server-side in the `chat-assistant` Edge
 * Function (which owns the Gemini API key and builds the agricultural system
 * prompt). The browser only ever:
 *   1. lists/creates conversations for the active farm,
 *   2. saves the farmer's message (anon, via RLS),
 *   3. sends the message + a concise farm context to the Edge Function,
 *   4. reads back the persisted assistant reply.
 *
 * No AI key ever reaches client code.
 */

/* ------------------------------------------------------------------ */
/* Row shapes (snake_case, matches the schema)                         */
/* ------------------------------------------------------------------ */

export interface ChatConversationRow {
  id: string;
  farm_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  farm_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

/** Structured reply returned by the Edge Function (validated server-side). */
export interface ChatReply {
  answer: string;
  language: "en" | "ur";
  confidence: "low" | "moderate" | "high";
  needs_clarification: boolean;
  clarifying_question: string | null;
  key_points: string[];
  recommended_actions: string[];
}

export interface SendChatResult {
  /** The saved user message. */
  userMessage: ChatMessage;
  /** The saved assistant message. */
  assistantMessage: ChatMessage;
  /** Structured reply (display answer + optional extras). */
  reply: ChatReply;
}

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

function messageRowToMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

function conversationRowToConversation(row: ChatConversationRow): {
  id: string;
  farmId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: row.id,
    farmId: row.farm_id,
    title: row.title ?? "New conversation",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function friendlyError(err: unknown, fallback: string): never {
  console.error("chat-service:", err);
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
      return parsed.error || "Kissan AI is temporarily unavailable. Please try again.";
    } catch {
      return "Kissan AI is temporarily unavailable. Please try again.";
    }
  }
  return e?.message || "Kissan AI is temporarily unavailable. Please try again.";
}

/* ------------------------------------------------------------------ */
/* Conversations                                                       */
/* ------------------------------------------------------------------ */

/** Latest-first conversations for a farm (real rows only). */
export async function listConversations(farmId: string) {
  const { data, error } = await supabase
    .from("chat_conversations")
    .select("*")
    .eq("farm_id", farmId)
    .order("updated_at", { ascending: false });

  if (error) {
    friendlyError(error, "We couldn't load your conversations. Please try again.");
  }
  return ((data as ChatConversationRow[] | null) ?? []).map(conversationRowToConversation);
}

/** Create a new conversation for the active farm. */
export async function createConversation(
  farmId: string,
  title?: string
): Promise<{ id: string; farmId: string; title: string; createdAt: string; updatedAt: string }> {
  const { data, error } = await supabase
    .from("chat_conversations")
    .insert({ farm_id: farmId, title: title?.trim() || null })
    .select()
    .single();

  if (error) {
    friendlyError(error, "We couldn't start a new conversation. Please try again.");
  }
  return conversationRowToConversation(data as ChatConversationRow);
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

/** Chronological messages for a conversation. */
export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    friendlyError(error, "We couldn't load your messages. Please try again.");
  }
  return ((data as ChatMessageRow[] | null) ?? []).map(messageRowToMessage);
}

/** Save the farmer's message so it persists before the AI answers. */
export async function saveUserMessage(
  conversationId: string,
  farmId: string,
  content: string
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      farm_id: farmId,
      role: "user",
      content: content.trim(),
    })
    .select()
    .single();

  if (error) {
    friendlyError(error, "We couldn't save your message. Please try again.");
  }
  return messageRowToMessage(data as ChatMessageRow);
}

/* ------------------------------------------------------------------ */
/* Farm context payload (built from existing systems — never invented) */
/* ------------------------------------------------------------------ */

/**
 * Build the concise context payload sent to the AI. Growth stage comes from
 * the existing deterministic growth-stage engine; weather and diagnoses come
 * from the existing Weather Intelligence and Crop Doctor data. Only real,
 * saved values are included.
 */
export function buildChatContext(
  farm: Farm,
  weather: {
    temperature?: number;
    humidity?: number;
    rainProbability?: number;
    condition?: string;
  } | null,
  diagnoses: Diagnosis[],
  risks?: Array<{
    riskType: string;
    level: "low" | "medium" | "high";
    title: string;
  }>,
  todayActions?: Array<{
    title: string;
    priority: "low" | "medium" | "high";
    reason: string;
    timing: string | null;
    completed: boolean;
  }>
): {
  farm: {
    location: string;
    area: string;
    soilType: string;
    irrigationMethod: string;
  };
  crop: {
    name: string;
    variety: string | null;
    plantingDate: string | null;
  };
  growth: {
    ageDays: number | null;
    stage: string;
    stageLabel: string;
  };
  weather: {
    temperature: number;
    humidity: number;
    rainProbability: number;
    condition: string;
  } | null;
  recentDiagnoses: Array<{
    diagnosis: string;
    severity: Severity;
    confidence: number;
    createdAt: string;
  }>;
  risks: Array<{
    type: string;
    level: "low" | "medium" | "high";
    title: string;
  }>;
  todayActions: Array<{
    title: string;
    priority: "low" | "medium" | "high";
    reason: string;
    timing: string | null;
    completed: boolean;
  }>;
} {
  const growth = getGrowthStage(farm.currentCrop, farm.plantingDate);
  return {
    farm: {
      location: farm.location,
      area: farm.landArea,
      soilType: farm.soilType,
      irrigationMethod: farm.irrigationMethod,
    },
    crop: {
      name: farm.currentCrop,
      variety: farm.currentCropVariety ?? null,
      plantingDate: farm.plantingDate ?? null,
    },
    growth: {
      ageDays: growth.cropAgeDays,
      stage: growth.growthStage,
      stageLabel: growth.stageLabel,
    },
    weather: weather
      ? {
          temperature: weather.temperature ?? 0,
          humidity: weather.humidity ?? 0,
          rainProbability: weather.rainProbability ?? 0,
          condition: weather.condition ?? "",
        }
      : null,
    recentDiagnoses: diagnoses.slice(0, 3).map((d) => ({
      diagnosis: d.diagnosis,
      severity: d.severity,
      confidence: d.confidence,
      createdAt: d.createdAt,
    })),
    risks: (risks ?? []).slice(0, 5).map((r) => ({
      type: r.riskType,
      level: r.level,
      title: r.title,
    })),
    todayActions: (todayActions ?? []).slice(0, 4).map((a) => ({
      title: a.title,
      priority: a.priority,
      reason: a.reason,
      timing: a.timing,
      completed: a.completed,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Send a message (save user msg → Edge Function → assistant reply)    */
/* ------------------------------------------------------------------ */

export interface AskAssistantInput {
  farmId: string;
  conversationId: string;
  message: string;
  context: ReturnType<typeof buildChatContext>;
  preferredLanguage?: "auto" | "urdu" | "english";
}

/**
 * Send the farmer's message and get the assistant reply. The user message is
 * saved first (RLS/anon), then the Edge Function calls the AI provider and
 * persists the assistant reply via the service role. On AI failure no fake
 * assistant message is produced — a friendly error is thrown instead.
 */
export async function sendChatMessage(
  input: AskAssistantInput
): Promise<SendChatResult> {
  // 1) Persist the user message before calling the AI.
  const userMessage = await saveUserMessage(
    input.conversationId,
    input.farmId,
    input.message
  );

  // 2) Call the Edge Function with the message + concise farm context.
  const { data, error } = await supabase.functions.invoke("chat-assistant", {
    body: {
      farmId: input.farmId,
      conversationId: input.conversationId,
      message: input.message.trim(),
      preferredLanguage: input.preferredLanguage ?? "auto",
      context: input.context,
    },
  });

  if (error) {
    friendlyError(error, await edgeErrorToMessage(error));
  }

  const payload = data as {
    success?: boolean;
    reply?: ChatReply;
    message?: ChatMessageRow;
    error?: string;
  };

  if (!payload?.success || !payload.reply || !payload.message) {
    friendlyError(
      payload?.error,
      payload?.error || "Kissan AI is temporarily unavailable. Please try again."
    );
  }

  return {
    userMessage,
    assistantMessage: messageRowToMessage(payload.message as ChatMessageRow),
    reply: payload.reply as ChatReply,
  };
}