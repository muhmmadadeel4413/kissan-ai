import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bot,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Send,
  Square,
  Sprout,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { PageHeader } from "../components/layout/page-header";
import { EmptyState } from "../components/layout/empty-state";
import { useFarm } from "../context/FarmContext";
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
import { startSTT, type STTLanguageCode } from "../lib/voice-stt";
import {
  pauseSpeech,
  resumeSpeech,
  speak,
  stopSpeech,
  ttsAvailable,
  type TTSLanguageCode,
} from "../lib/voice-tts";
import type { ChatMessage } from "../types";
import { cn } from "../lib/utils";

/* ------------------------------------------------------------------ */
/* Language configuration                                              */
/* ------------------------------------------------------------------ */

type VoiceLang = "auto" | "english" | "urdu" | "punjabi" | "saraiki";

const LANG_CONFIG: Record<
  VoiceLang,
  {
    label: string;
    native: string;
    stt: STTLanguageCode;
    chat: "auto" | "urdu" | "english";
    tts: TTSLanguageCode;
    /** Honest provider capability — Saraiki STT isn't reliably supported. */
    sttSupported: boolean;
    note?: string;
  }
> = {
  auto: {
    label: "Auto",
    native: "خودکار",
    stt: "ur",
    chat: "auto",
    tts: "ur",
    sttSupported: true,
    note: "Auto listens in Urdu by default.",
  },
  english: {
    label: "English",
    native: "English",
    stt: "en",
    chat: "english",
    tts: "en",
    sttSupported: true,
  },
  urdu: {
    label: "Urdu",
    native: "اردو",
    stt: "ur",
    chat: "urdu",
    tts: "ur",
    sttSupported: true,
  },
  punjabi: {
    label: "Punjabi",
    native: "پنجابی",
    stt: "pa",
    chat: "auto",
    tts: "pa",
    sttSupported: true,
    note: "Punjabi voice recognition may vary by device.",
  },
  saraiki: {
    label: "Saraiki",
    native: "سرائیکی",
    stt: "skr",
    chat: "auto",
    tts: "skr",
    sttSupported: false,
    note: "Saraiki voice isn't supported on this device — type your question instead.",
  },
};

type VoiceState =
  | "idle"
  | "requesting_permission"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

type TtsState = "idle" | "playing" | "paused";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function VoicePage() {
  const { farm } = useFarm();
  const { status: weatherStatus, weather } = useFarmWeather();

  const [searchParams] = useSearchParams();
  const requestedConversationId = searchParams.get("conversation");

  const [language, setLanguage] = React.useState<VoiceLang>("auto");
  const [voiceState, setVoiceState] = React.useState<VoiceState>("idle");
  const [ttsState, setTtsState] = React.useState<TtsState>("idle");
  const [partial, setPartial] = React.useState("");
  const [transcript, setTranscript] = React.useState("");
  const [typedText, setTypedText] = React.useState("");
  const [reply, setReply] = React.useState<ChatReply | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [ttsUnavailable, setTtsUnavailable] = React.useState(false);

  const [activeConversationId, setActiveConversationId] = React.useState<
    string | null
  >(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [diagnoses, setDiagnoses] = React.useState<
    Awaited<ReturnType<typeof fetchDiagnoses>>
  >([]);
  const [activeRisks, setActiveRisks] = React.useState<RiskAlert[]>([]);
  const [todayActions, setTodayActions] = React.useState<
    Awaited<ReturnType<typeof fetchTodayActions>>
  >([]);
  const [initializing, setInitializing] = React.useState(true);

  const sttRef = React.useRef<Awaited<ReturnType<typeof startSTT>> | null>(null);
  const finalTimerRef = React.useRef<number | null>(null);
  const gotFinalRef = React.useRef(false);

  /* Farm context — real saved data + existing Weather + Diagnoses + Risks + Today's Actions. */
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

  /* Load real diagnosis history (never invented). */
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
        /* context is optional — non-blocking */
      });
    return () => {
      cancelled = true;
    };
  }, [farm]);

  /* Load active risk alerts for context (never invented). */
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
        /* risks are optional context — non-blocking */
        if (!cancelled) setActiveRisks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [farm]);

  /* Load today's Decision Engine actions for context (never invented). */
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
        /* today's actions are optional context — non-blocking */
        if (!cancelled) setTodayActions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [farm]);

  /* Load conversations for the active farm; reuse one or create it. */
  React.useEffect(() => {
    if (!farm) return;
    let cancelled = false;

    setInitializing(true);
    listConversations(farm.id)
      .then((rows) => {
        if (cancelled) return;
        if (
          requestedConversationId &&
          rows.some((r) => r.id === requestedConversationId)
        ) {
          setActiveConversationId(requestedConversationId);
        } else if (rows.length > 0) {
          setActiveConversationId(rows[0].id);
        } else {
          return createConversation(farm.id).then((created) => {
            if (cancelled) return;
            setActiveConversationId(created.id);
          });
        }
      })
      .catch(() => {
        if (!cancelled)
          setError("We couldn't load your conversation. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [farm, requestedConversationId]);

  /* Load messages whenever the active conversation changes. */
  React.useEffect(() => {
    if (!activeConversationId) return;
    let cancelled = false;
    setMessages([]);
    listMessages(activeConversationId)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch(() => {
        /* non-blocking */
      });
    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  /* Cleanup on unmount: stop mic session + any speech. */
  React.useEffect(() => {
    return () => {
      sttRef.current?.cancel();
      stopSpeech();
    };
  }, []);

  const cfg = LANG_CONFIG[language];
  const isBusy =
    voiceState === "listening" ||
    voiceState === "transcribing" ||
    voiceState === "thinking";

  function clearError() {
    setError(null);
    if (voiceState === "error") setVoiceState("idle");
  }

  function handleLanguageChange(next: VoiceLang) {
    if (next === language) return;
    // Never leave a mic session running across a language switch.
    if (sttRef.current) {
      sttRef.current.cancel();
      sttRef.current = null;
    }
    if (finalTimerRef.current) {
      window.clearTimeout(finalTimerRef.current);
      finalTimerRef.current = null;
    }
    stopSpeech();
    setPartial("");
    setTranscript("");
    setVoiceState("idle");
    setTtsState("idle");
    setReply(null);
    setTtsUnavailable(false);
    setLanguage(next);
    setError(null);
  }

  /* ---------------- Mic flow ---------------- */

  async function handleMicTap() {
    if (!cfg.sttSupported) {
      setVoiceState("error");
      setError(cfg.note ?? "");
      return;
    }

    // Stop an in-progress recording and finalize the transcript.
    if (voiceState === "listening") {
      sttRef.current?.stop();
      setVoiceState("transcribing");
      gotFinalRef.current = false;
      if (finalTimerRef.current) window.clearTimeout(finalTimerRef.current);
      finalTimerRef.current = window.setTimeout(() => {
        if (!gotFinalRef.current) {
          setVoiceState("error");
          setError(
            "We couldn't hear a clear question. Please try again or type it."
          );
          setPartial("");
        }
      }, 9000);
      return;
    }

    if (voiceState !== "idle" && voiceState !== "error") return;
    setError(null);
    setPartial("");
    setTranscript("");
    setReply(null);
    setTtsUnavailable(false);
    stopSpeech();
    setTtsState("idle");
    setVoiceState("requesting_permission");

    try {
      const session = await startSTT(cfg.stt, {
        onPartial: (t) => setPartial(t),
        onFinal: (t) => {
          gotFinalRef.current = true;
          if (finalTimerRef.current) {
            window.clearTimeout(finalTimerRef.current);
            finalTimerRef.current = null;
          }
          setTranscript(t);
          setPartial("");
          setVoiceState("idle");
        },
        onError: (m) => {
          gotFinalRef.current = true;
          if (finalTimerRef.current) {
            window.clearTimeout(finalTimerRef.current);
            finalTimerRef.current = null;
          }
          sttRef.current = null;
          setVoiceState("error");
          setError(m);
        },
      });
      sttRef.current = session;
      setVoiceState("listening");
    } catch (err) {
      sttRef.current = null;
      setVoiceState("error");
      setError(
        err instanceof Error
          ? err.message
          : "Microphone access is required for voice input. You can allow it in your browser settings or use text input instead."
      );
    }
  }

  /* ---------------- Send to the existing Chat Engine ---------------- */

  async function ask(text: string) {
    const content = text.trim();
    if (!content || isBusy || !farm || !activeConversationId) return;

    stopSpeech();
    setTtsState("idle");
    setError(null);
    setReply(null);
    setTtsUnavailable(false);

    const optimisticUser: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: activeConversationId,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setTranscript(content);
    setTypedText("");
    setVoiceState("thinking");

    try {
      const result = await sendChatMessage({
        farmId: farm.id,
        conversationId: activeConversationId,
        message: content,
        context:
          contextRef.current ?? {
            farm: {
              location: "",
              area: "",
              soilType: "",
              irrigationMethod: "",
            },
            crop: {
              name: farm.currentCrop,
              variety: farm.currentCropVariety ?? null,
              plantingDate: farm.plantingDate ?? null,
            },
            growth: {
              ageDays: null,
              stage: "unknown",
              stageLabel: "Growth stage unavailable",
            },
            weather: null,
            recentDiagnoses: [],
            risks: [],
            todayActions: [],
          },
        preferredLanguage: cfg.chat,
      });

      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticUser.id ? result.userMessage : m))
      );
      setMessages((prev) => [...prev, result.assistantMessage]);
      setReply(result.reply);
      setVoiceState("idle");
      speakAnswer(result.reply.answer);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
      setVoiceState("error");
      setError(
        err instanceof Error
          ? err.message
          : "Kissan AI is temporarily unavailable. Please try again."
      );
    }
  }

  /* ---------------- TTS ---------------- */

  function speakAnswer(text: string) {
    const ttsLang = cfg.tts;
    if (!ttsAvailable(ttsLang)) {
      setTtsUnavailable(true);
      return;
    }
    setTtsUnavailable(false);
    setVoiceState("speaking");
    setTtsState("playing");
    speak(text, ttsLang, {
      onEnd: () => {
        setVoiceState("idle");
        setTtsState("idle");
      },
      onError: () => {
        setVoiceState("idle");
        setTtsState("idle");
        setTtsUnavailable(true);
      },
    });
  }

  function handlePlay() {
    if (!reply) return;
    if (ttsState === "paused") {
      resumeSpeech();
      setTtsState("playing");
      setVoiceState("speaking");
      return;
    }
    speakAnswer(reply.answer);
  }

  function handlePause() {
    pauseSpeech();
    setTtsState("paused");
  }

  function handleStop() {
    stopSpeech();
    setTtsState("idle");
    setVoiceState("idle");
  }

  /* ---------------- Render ---------------- */

  if (!farm) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={<Mic className="h-6 w-6" />}
          title="Set up your farm to talk to Kissan AI"
          description="The voice assistant answers with your farm, crop, growth stage, and weather in mind — set up your farm first."
          action={
            <Button asChild size="lg">
              <Link to="/farm-setup">Create Farm</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const showTranscript = transcript.trim().length > 0;
  const liveText = partial || transcript;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Voice Assistant"
        subtitle="Speak in your language, hear the answer aloud"
      />

      {/* Language selector + farm context */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="voice-language"
              className="text-sm font-semibold text-foreground"
            >
              Language
            </label>
            <Select
              value={language}
              onValueChange={(v) => handleLanguageChange(v as VoiceLang)}
            >
              <SelectTrigger id="voice-language" className="w-52" aria-label="Language">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LANG_CONFIG) as VoiceLang[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    <span className="font-semibold">{LANG_CONFIG[key].native}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {LANG_CONFIG[key].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Sprout className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {farm.currentCrop || "Your farm"}
            </span>
            {chatContext?.growth.stageLabel ? (
              <>
                <span aria-hidden="true">•</span>
                <span>{chatContext.growth.stageLabel}</span>
              </>
            ) : null}
            {farm.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {farm.location}
              </span>
            ) : null}
            {weatherStatus === "error" ? (
              <span className="text-warning">Weather unavailable</span>
            ) : null}
          </div>

          {cfg.note ? (
            <p className="text-xs text-muted-foreground">{cfg.note}</p>
          ) : null}
        </CardContent>
      </Card>

      {/* Error banner */}
      {error ? (
        <Alert variant="danger">
          <AlertTitle className="flex items-center gap-2">
            <VolumeX className="h-4 w-4" aria-hidden="true" />
            {voiceState === "error" ? "Voice assistant" : "Something went wrong"}
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={clearError}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Mic control */}
      <Card className="flex flex-col items-center gap-4 px-6 py-8 text-center">
        <div aria-live="polite" aria-atomic="true" className="contents">
          <button
            type="button"
            onClick={() => void handleMicTap()}
            disabled={isBusy || initializing}
            aria-pressed={voiceState === "listening" || voiceState === "requesting_permission"}
            aria-label={
              voiceState === "listening"
                ? "Stop recording"
                : cfg.sttSupported
                ? "Tap to speak"
                : "Voice not available for this language"
            }
            className={cn(
              "relative flex h-24 w-24 items-center justify-center rounded-full shadow-pop transition-transform active:scale-95 disabled:opacity-60 cursor-pointer",
              voiceState === "listening"
                ? "bg-danger text-white hover:bg-danger-hover"
                : voiceState === "speaking"
                ? "bg-accent text-accent-foreground hover:bg-accent-hover"
                : "bg-primary text-primary-foreground hover:bg-primary-hover"
            )}
          >
            {voiceState === "listening" ? (
              <span className="absolute inset-0 animate-ping rounded-full bg-danger/40" />
            ) : null}
            {voiceState === "listening" ? (
              <Square className="h-8 w-8" aria-hidden="true" />
            ) : voiceState === "speaking" ? (
              <Volume2 className="h-9 w-9" aria-hidden="true" />
            ) : (
              <Mic className="h-10 w-10" aria-hidden="true" />
            )}
          </button>
        </div>

        <div>
          <p className="text-base font-semibold text-foreground">
            {voiceState === "idle" && "Tap to speak"}
            {voiceState === "requesting_permission" && "Requesting microphone…"}
            {voiceState === "listening" && "Listening… tap to stop"}
            {voiceState === "transcribing" && "Finishing your question…"}
            {voiceState === "thinking" && "Kissan AI is thinking…"}
            {voiceState === "speaking" && "Playing response"}
            {voiceState === "error" && "Let's try that again"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {voiceState === "speaking"
              ? ttsUnavailable
                ? "Voice playback isn't available for this language on this device, but here's the answer."
                : "Playing response"
              : `I'll use ${cfg.label} for voice.`}
          </p>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {voiceState === "listening" ? (
            <Badge variant="danger">
              <MicOff className="h-3 w-3" aria-hidden="true" />
              Recording
            </Badge>
          ) : null}
          {voiceState === "transcribing" ||
          voiceState === "thinking" ? (
            <Badge variant="default">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Processing
            </Badge>
          ) : null}
          {voiceState === "speaking" ? (
            <Badge variant="warning">
              <Volume2 className="h-3 w-3" aria-hidden="true" />
              Speaking
            </Badge>
          ) : null}
        </div>
      </Card>

      {/* Transcription — editable before sending */}
      {showTranscript || partial ? (
        <Card className="animate-fade-in">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center gap-2">
              <Badge variant="neutral">You said</Badge>
              {voiceState === "listening" && partial ? (
                <span className="text-xs text-muted-foreground">Listening…</span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Edit it, then ask Kissan AI.
                </span>
              )}
            </div>
            <label htmlFor="voice-transcript" className="sr-only">
              Your question
            </label>
            <textarea
              id="voice-transcript"
              rows={3}
              value={liveText}
              onChange={(e) => {
                setTranscript(e.target.value);
                if (error) setError(null);
              }}
              disabled={voiceState === "listening"}
              placeholder="What you said will appear here…"
              className="w-full resize-none rounded-2xl border border-input bg-card px-4 py-3 text-sm leading-relaxed text-foreground shadow-soft placeholder:text-muted-foreground/70 focus:outline-none focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-70"
            />
            {showTranscript && voiceState !== "listening" ? (
              <Button
                type="button"
                onClick={() => void ask(transcript)}
                disabled={!transcript.trim() || isBusy}
              >
                <Mic className="h-4 w-4" aria-hidden="true" />
                Ask Kissan AI
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* AI response + speaker controls */}
      {reply ? (
        <Card className="animate-fade-in">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Bot className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Kissan AI
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                  {reply.answer}
                </p>
              </div>
            </div>

            {ttsUnavailable ? (
              <p className="text-xs text-muted-foreground">
                Voice playback isn't available for this language on this device,
                but here's the answer.
              </p>
            ) : null}

            {reply.key_points.length > 0 ? (
              <div className="rounded-xl border border-border bg-card/70 px-4 py-3">
                <p className="mb-1.5 text-xs font-semibold text-foreground">
                  Key points
                </p>
                <ul className="list-disc space-y-1 pl-4 text-sm text-foreground/90">
                  {reply.key_points.map((point, i) => (
                    <li key={i} className="break-words">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Speaker controls */}
            <div className="flex items-center gap-2">
              <Button
                variant={ttsState === "playing" ? "accent" : "default"}
                size="sm"
                onClick={handlePlay}
                disabled={voiceState === "thinking"}
                aria-label={ttsState === "paused" ? "Resume response" : "Play response"}
              >
                {ttsState === "paused" ? (
                  <Play className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                )}
                {ttsState === "playing" ? "Playing" : "Play"}
              </Button>
              {ttsState === "playing" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePause}
                  aria-label="Pause response"
                >
                  <Pause className="h-4 w-4" aria-hidden="true" />
                  Pause
                </Button>
              ) : null}
              {ttsState === "playing" || ttsState === "paused" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStop}
                  aria-label="Stop response"
                >
                  <Square className="h-4 w-4" aria-hidden="true" />
                  Stop
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Conversation history — same messages as text chat */}
      {messages.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              This conversation
            </p>
            <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex items-start gap-2.5",
                    msg.role === "user" && "justify-end"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  ) : null}
                  <div
                    className={cn(
                      "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-soft",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "border border-border bg-card text-foreground rounded-bl-sm"
                    )}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" ? (
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <User className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Saved to your chat — you can keep talking from{" "}
              <Link to="/assistant" className="font-medium text-primary underline">
                text chat
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Text fallback — mandatory, same Chat Engine */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Can't use voice?{" "}
          <span className="text-muted-foreground">Type your question instead.</span>
        </p>
        <div className="flex items-end gap-2">
          <label htmlFor="voice-type" className="sr-only">
            Your question
          </label>
          <textarea
            id="voice-type"
            rows={2}
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(typedText);
              }
            }}
            placeholder="Meri fasal ke liye aaj kya karna chahiye?"
            className="min-h-[56px] flex-1 resize-none rounded-2xl border border-input bg-card px-4 py-3 text-sm text-foreground shadow-soft placeholder:text-muted-foreground/70 focus:outline-none focus-visible:outline-2 focus-visible:outline-ring"
          />
          <Button
            type="button"
            size="icon"
            className="h-[56px] w-[56px] shrink-0"
            disabled={!typedText.trim() || isBusy}
            onClick={() => void ask(typedText)}
            aria-label="Send question"
          >
            <Send className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}