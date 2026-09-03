import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bot,
  Languages,
  Loader2,
  MapPin,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Sprout,
  User,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { EmptyState } from "../components/layout/empty-state";
import { NotificationBell } from "../components/layout/notification-bell";
import { useFarm } from "../context/FarmContext";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import { useFarmWeather } from "../hooks/useFarmWeather";
import { fetchDiagnoses } from "../lib/diagnosis-service";
import { fetchActiveRisks } from "../lib/risk-service";
import { fetchTodayActions } from "../lib/actions-service";
import type { RiskAlert } from "../types";
import {
  buildChatContext,
  createConversation,
  listConversations,
  listMessages,
  sendChatMessage,
  type ChatReply,
} from "../lib/chat-service";
import type { ChatMessage } from "../types";
import { cn } from "../lib/utils";

const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto (Urdu / English)" },
  { value: "urdu", label: "Urdu" },
  { value: "english", label: "English" },
] as const;

type LanguagePref = (typeof LANGUAGE_OPTIONS)[number]["value"];

export default function AssistantPage() {
  const { farm } = useFarm();
  const { user } = useAuth();
  const { t, language: uiLanguage } = usePreferences();
  const { status: weatherStatus, weather } = useFarmWeather();

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedConversationId = searchParams.get("conversation");

  const [conversations, setConversations] = React.useState<
    Array<{ id: string; title: string }>
  >([]);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [structuredReplies, setStructuredReplies] = React.useState<Record<string, ChatReply>>({});
  const [input, setInput] = React.useState("");
  const [language, setLanguage] = React.useState<LanguagePref>("auto");
  const [isThinking, setIsThinking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [initializing, setInitializing] = React.useState(true);
  const [loadingConversation, setLoadingConversation] = React.useState(false);

  const [diagnoses, setDiagnoses] = React.useState<Awaited<ReturnType<typeof fetchDiagnoses>>>([]);
  const [activeRisks, setActiveRisks] = React.useState<RiskAlert[]>([]);
  const [todayActions, setTodayActions] = React.useState<
    Awaited<ReturnType<typeof fetchTodayActions>>
  >([]);
  const [contextError, setContextError] = React.useState<string | null>(null);
  const [failedMessage, setFailedMessage] = React.useState<string | null>(null);

  const endRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);

  /* ------------------------------------------------------------------ */
  /* Load real diagnosis history for context (never invented)            */
  /* ------------------------------------------------------------------ */
  React.useEffect(() => {
    if (!farm) {
      setDiagnoses([]);
      return;
    }
    let cancelled = false;
    fetchDiagnoses(farm.id)
      .then((rows) => {
        if (!cancelled) setDiagnoses(rows);
      })
      .catch(() => {
        if (!cancelled) setContextError("We couldn't load your recent diagnoses.");
      });
    return () => {
      cancelled = true;
    };
  }, [farm]);

  /* ------------------------------------------------------------------ */
  /* Load active risk alerts for context (never invented)                */
  /* ------------------------------------------------------------------ */
  React.useEffect(() => {
    if (!farm) {
      setActiveRisks([]);
      return;
    }
    let cancelled = false;
    fetchActiveRisks(farm.id)
      .then((rows) => {
        if (!cancelled) setActiveRisks(rows);
      })
      .catch(() => {
        // Risks are optional context — never block the chat on them.
        if (!cancelled) setActiveRisks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [farm]);

  /* ------------------------------------------------------------------ */
  /* Load today's Decision Engine actions for context (never invented)   */
  /* ------------------------------------------------------------------ */
  React.useEffect(() => {
    if (!farm) {
      setTodayActions([]);
      return;
    }
    let cancelled = false;
    fetchTodayActions(farm.id)
      .then((rows) => {
        if (!cancelled) setTodayActions(rows);
      })
      .catch(() => {
        // Today's actions are optional context — never block the chat on them.
        if (!cancelled) setTodayActions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [farm]);

  /* ------------------------------------------------------------------ */
  /* Load conversations for the active farm                              */
  /* ------------------------------------------------------------------ */
  React.useEffect(() => {
    if (!farm) return;
    let cancelled = false;

    setInitializing(true);
    listConversations(farm.id)
      .then((rows) => {
        if (cancelled) return;
        setConversations(rows);

        // Prefer the conversation requested via ?conversation=… (Chat History).
        if (requestedConversationId && rows.some((r) => r.id === requestedConversationId)) {
          setActiveConversationId(requestedConversationId);
        } else if (rows.length > 0) {
          setActiveConversationId(rows[0].id);
        } else {
          // No conversations yet — start a fresh one for this farm.
          return createConversation(farm.id).then((created) => {
            if (cancelled) return;
            setConversations([{ id: created.id, title: created.title }]);
            setActiveConversationId(created.id);
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "We couldn't load your conversations. Please try again."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [farm, requestedConversationId]);

  /* ------------------------------------------------------------------ */
  /* Load messages whenever the active conversation changes              */
  /* ------------------------------------------------------------------ */
  React.useEffect(() => {
    if (!activeConversationId) return;
    let cancelled = false;

    setLoadingConversation(true);
    setMessages([]);
    setStructuredReplies({});
    listMessages(activeConversationId)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "We couldn't load your messages. Please try again."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingConversation(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  /* ------------------------------------------------------------------ */
  /* Scroll to the latest message                                        */
  /* ------------------------------------------------------------------ */
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isThinking]);

  /* ------------------------------------------------------------------ */
  /* Sending                                                             */
  /* ------------------------------------------------------------------ */

  /** Farm context — from real saved data + existing Weather + Diagnoses + Risks + Today's Actions. */
  const chatContext = React.useMemo(() => {
    if (!farm) return null;
    return buildChatContext(
      farm,
      weather?.current ?? null,
      diagnoses,
      activeRisks,
      todayActions.map((a) => ({
        title: a.title,
        priority: a.priority,
        reason: a.reason,
        timing: a.timing,
        completed: a.completed,
      }))
    );
  }, [farm, weather, diagnoses, activeRisks, todayActions]);

  const contextRef = React.useRef(chatContext);
  contextRef.current = chatContext;

  async function runTurn(text: string) {
    const content = text.trim();
    if (!content || isThinking) return;
    if (!farm || !activeConversationId) return;

    // Clear any previous failure so a retry starts fresh.
    setError(null);
    setFailedMessage(null);

    const optimisticUser: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: activeConversationId,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUser]);
    setInput("");
    setIsThinking(true);

    try {
      const result = await sendChatMessage({
        farmId: farm.id,
        conversationId: activeConversationId,
        message: content,
        context: contextRef.current ?? {
          farm: { location: "", area: "", soilType: "", irrigationMethod: "" },
          crop: { name: farm.currentCrop, variety: farm.currentCropVariety ?? null, plantingDate: farm.plantingDate ?? null },
          growth: { ageDays: null, stage: "unknown", stageLabel: "Growth stage unavailable" },
          weather: null,
          recentDiagnoses: [],
          risks: [],
          todayActions: [],
        },
        preferredLanguage: language,
      });

      // Replace the optimistic user message with the persisted one.
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticUser.id ? result.userMessage : m))
      );
      setMessages((prev) => [...prev, result.assistantMessage]);
      setStructuredReplies((prev) => ({
        ...prev,
        [result.assistantMessage.id]: result.reply,
      }));
    } catch (err) {
      // Remove the optimistic message so we never show a message that wasn't saved.
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
      setFailedMessage(content);
      setError(
        err instanceof Error
          ? err.message
          : "Kissan AI is temporarily unavailable. Please try again."
      );
    } finally {
      setIsThinking(false);
    }
  }

  function handleSend() {
    void runTurn(input);
  }

  function handleRetry() {
    if (failedMessage) void runTurn(failedMessage);
  }

  /** Start a brand-new conversation — previous ones stay saved. */
  async function handleNewConversation() {
    if (!farm) return;
    setError(null);
    try {
      const created = await createConversation(farm.id);
      setConversations((prev) => [
        { id: created.id, title: created.title },
        ...prev,
      ]);
      // Clear any deep-link so we don't fight it.
      setSearchParams({}, { replace: true });
      setActiveConversationId(created.id);
      setInput("");
      inputRef.current?.focus();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't start a new conversation. Please try again."
      );
    }
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  if (!farm) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={<MessageCircle className="h-6 w-6" />}
          title="Set up your farm to talk to Kissan AI"
          description="The assistant answers with your farm, crop, growth stage, and weather in mind — set up your farm first."
          action={
            <Button asChild size="lg">
              <Link to="/farm-setup">Create Farm</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const activeConversationTitle =
    conversations.find((c) => c.id === activeConversationId)?.title ?? "New conversation";

  const hasContext =
    chatContext && (chatContext.crop.name || chatContext.farm.location || chatContext.growth.stageLabel);

  const farmerName = farm.farmerName.trim();
  const farmerInitial = farmerName.charAt(0).toUpperCase() || "?";
  const farmerLocation = farm.location || "";
  const farmerEmail = user?.email ?? "";

  // The title shows the reply-language mode (English / Urdu) in the app's
  // active UI language — matching the reference header.
  const languageName = language === "urdu" ? "اردو" : "English";
  const headerTitle = t("assistant.chatTitle", { language: languageName });
  const placeholder =
    uiLanguage === "ur" ? "اپنا سوال یہاں لکھیں…" : t("assistant.placeholder");

  return (
    <div className="flex h-[calc(100dvh-4.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft card-sheen lg:h-[calc(100dvh-9.5rem)]">
      {/* ===================== Chat header ===================== */}
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-heading text-lg font-bold tracking-tight text-foreground sm:text-xl">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Bot className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            {headerTitle}
          </h1>
          <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
            {t("assistant.chatSubtitle")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Reply language preference (existing control, restyled) */}
          <Select value={language} onValueChange={(v) => setLanguage(v as LanguagePref)}>
            <SelectTrigger
              className="h-9 w-auto gap-1 rounded-lg px-2 text-xs"
              aria-label={t("common.language")}
            >
              <Languages className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <SelectValue placeholder={t("common.language")} />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleNewConversation()}
            disabled={isThinking}
            aria-label={t("assistant.newConversation")}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">{t("assistant.newConversation")}</span>
          </Button>

          <NotificationBell />

          {/* Real authenticated farmer/profile info from farm + auth */}
          <div className="hidden items-center gap-2 rounded-xl border border-border bg-background/60 py-1.5 pl-1.5 pr-3 sm:flex">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-1 ring-inset ring-primary/20">
              {farmerInitial}
            </span>
            <span className="min-w-0 text-left">
              <span className="block max-w-[9rem] truncate text-sm font-semibold leading-tight text-foreground">
                {farmerName}
              </span>
              <span className="block max-w-[9rem] truncate text-xs leading-tight text-muted-foreground">
                {farmerLocation || farmerEmail || "Farmer"}
              </span>
            </span>
          </div>
        </div>
      </header>

      {/* Context indicator — real farm data only */}
      {hasContext ? (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/70 bg-background/40 px-4 py-2 text-xs text-muted-foreground sm:px-5">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <Sprout className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {chatContext!.crop.name || "Your farm"}
          </span>
          {chatContext!.growth.stageLabel ? (
            <>
              <span aria-hidden="true">•</span>
              <span>{chatContext!.growth.stageLabel}</span>
            </>
          ) : null}
          {chatContext!.farm.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {chatContext!.farm.location}
            </span>
          ) : null}
          {weatherStatus === "error" ? (
            <span className="text-warning">Weather unavailable</span>
          ) : null}
        </div>
      ) : null}

      {contextError ? (
        <p className="shrink-0 px-4 pt-2 text-xs text-muted-foreground sm:px-5">{contextError}</p>
      ) : null}

      {/* Error banner */}
      {error ? (
        <Alert variant="danger" className="mx-4 mt-3 shrink-0 sm:mx-5">
          <AlertTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {failedMessage ? "Couldn't get an answer" : "Something went wrong"}
          </AlertTitle>
          <AlertDescription>
            {error}
            {failedMessage ? (
              <Button variant="outline" size="sm" className="mt-2" onClick={handleRetry}>
                Try again
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* ===================== Message history ===================== */}
      <div
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5"
        aria-live="polite"
      >
        {initializing ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Loading your conversation…
          </div>
        ) : null}

        {!initializing && !loadingConversation && messages.length === 0 ? (
          <EmptyState
            icon={<MessageCircle className="h-6 w-6" />}
            title="Ask Kissan AI anything about your farm"
            description={
              "Try “What crop am I growing?”, “What stage is my crop in?”, or ask in Urdu: “میری فصل کے لیے آج کیا کرنا چاہیے؟”"
            }
            className="my-4"
          />
        ) : null}

        {loadingConversation ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Opening conversation…
          </div>
        ) : null}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            reply={structuredReplies[msg.id]}
          />
        ))}

        {isThinking ? (
          <div className="flex items-start gap-2.5">
            <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Bot className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="rounded-2xl rounded-bl-sm border border-border bg-muted px-4 py-3">
              <span className="mr-2 text-xs text-muted-foreground">
                {t("assistant.thinking")}
              </span>
              <span className="inline-flex gap-1 align-middle">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:100ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:200ms]" />
              </span>
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {/* ===================== Chat input ===================== */}
      <form
        className="shrink-0 border-t border-border px-4 pb-3 pt-3 sm:px-5"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1 rounded-2xl border border-input bg-background px-4 shadow-soft transition-colors duration-150 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
            <label htmlFor="message" className="sr-only">
              {placeholder}
            </label>
            <textarea
              id="message"
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              dir="auto"
              className="max-h-40 min-h-[52px] w-full resize-none bg-transparent py-3.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>
          <Button
            type="submit"
            size="icon"
            className="h-[52px] w-[52px] shrink-0 rounded-full shadow-soft"
            disabled={!input.trim() || isThinking}
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>

        {/* Language preference */}
        <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
          <Languages className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{activeConversationId ? activeConversationTitle : "New conversation"}</span>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Message bubble                                                      */
/* ------------------------------------------------------------------ */

function MessageBubble({
  message,
  reply,
}: {
  message: ChatMessage;
  reply?: ChatReply;
}) {
  const isUser = message.role === "user";
  const content = message.content || reply?.answer || "";

  return (
    <div className={cn("flex items-start gap-2.5", isUser && "flex-row-reverse")}>
      {!isUser ? (
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Bot className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : (
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <User className="h-4 w-4" aria-hidden="true" />
        </span>
      )}

      <div
        className={cn(
          "min-w-0 max-w-[85%] sm:max-w-[78%]",
          isUser && "flex flex-col items-end"
        )}
      >
        <div
          dir="auto"
          className={cn(
            "whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-soft",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "border border-border bg-muted text-foreground rounded-bl-sm"
          )}
        >
          {content}
        </div>

        {!isUser && reply && reply.key_points.length > 0 ? (
          <div className="mt-2 w-full rounded-xl border border-border bg-card/70 px-4 py-3">
            <p className="mb-1.5 text-xs font-semibold text-foreground">Key points</p>
            <ul className="list-disc space-y-1 pl-4 text-sm text-foreground/90">
              {reply.key_points.map((point, i) => (
                <li key={i} className="break-words">{point}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {!isUser && reply && reply.recommended_actions.length > 0 ? (
          <div className="mt-2 w-full rounded-xl border border-border bg-primary-soft/60 px-4 py-3">
            <p className="mb-1.5 text-xs font-semibold text-foreground">Recommended next steps</p>
            <ol className="list-decimal space-y-1 pl-4 text-sm text-foreground/90">
              {reply.recommended_actions.map((action, i) => (
                <li key={i} className="break-words">{action}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </div>
  );
}
