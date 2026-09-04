import * as React from "react";
import {
  LANG_CONFIG,
  type VoiceLang,
  type VoiceState,
  type TtsState,
} from "../lib/voice-languages";
import { startSTT } from "../lib/voice-stt";
import {
  pauseSpeech,
  resumeSpeech,
  speak as ttsSpeak,
  stopSpeech,
  ttsAvailable,
} from "../lib/voice-tts";

/**
 * Voice input hook for AI Chat.
 *
 * Extracts the voice recording, STT, and TTS logic from VoicePage into a
 * reusable hook. Manages the full voice lifecycle:
 *
 * 1. User taps mic → startRecording()
 * 2. AudioWorklet captures PCM → micLevel for waveform
 * 3. User taps mic again → stopRecording() → WAV upload → final transcript
 * 4. Transcript returned via onTranscript callback
 * 5. speak() for TTS playback of AI responses
 *
 * The hook does NOT send messages — it only provides the transcript. The
 * calling component decides what to do with it (e.g., send as chat message).
 */

export interface UseVoiceInputOptions {
  /** Called when a final transcript is ready (user should send this as a message). */
  onTranscript?: (text: string) => void;
  /** Initial language (default: "auto"). */
  initialLanguage?: VoiceLang;
}

export interface UseVoiceInputReturn {
  /** Current voice state (idle, listening, transcribing, etc.). */
  voiceState: VoiceState;
  /** Mic level 0-1 for waveform visualization. */
  micLevel: number;
  /** Finalized transcript (empty until stopRecording completes). */
  transcript: string;
  /** Partial transcript during recording (empty for Sarvam non-streaming). */
  partial: string;
  /** TTS playback state. */
  ttsState: TtsState;
  /** True when browser TTS is unavailable for the selected language. */
  ttsUnavailable: boolean;
  /** Current voice language. */
  language: VoiceLang;
  /** Change voice language (cancels any active recording). */
  setLanguage: (lang: VoiceLang) => void;
  /** Start recording (requests mic permission if needed). */
  startRecording: () => Promise<void>;
  /** Stop recording and finalize transcript. */
  stopRecording: () => void;
  /** Cancel recording without finalizing. */
  cancelRecording: () => void;
  /** Speak text aloud using TTS. */
  speak: (text: string) => void;
  /** Pause TTS playback. */
  pauseSpeech: () => void;
  /** Resume TTS playback. */
  resumeSpeech: () => void;
  /** Stop TTS playback. */
  stopSpeech: () => void;
  /** Current error message (null if no error). */
  error: string | null;
  /** Clear the current error. */
  clearError: () => void;
  /** True when voice is busy (recording, transcribing, or thinking). */
  isBusy: boolean;
}

/** Timeout for final transcript after stop() (ms). */
const FINAL_TIMEOUT_MS = 15_000;

export function useVoiceInput(
  options: UseVoiceInputOptions = {}
): UseVoiceInputReturn {
  const { onTranscript, initialLanguage = "auto" } = options;

  const [language, setLanguageState] = React.useState<VoiceLang>(initialLanguage);
  const [voiceState, setVoiceState] = React.useState<VoiceState>("idle");
  const [ttsState, setTtsState] = React.useState<TtsState>("idle");
  const [partial, setPartial] = React.useState("");
  const [transcript, setTranscript] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [ttsUnavailable, setTtsUnavailable] = React.useState(false);
  const [micLevel, setMicLevel] = React.useState(0);

  const sttRef = React.useRef<Awaited<ReturnType<typeof startSTT>> | null>(null);
  const finalTimerRef = React.useRef<number | null>(null);
  const gotFinalRef = React.useRef(false);
  const levelRef = React.useRef(0);
  const onTranscriptRef = React.useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const cfg = LANG_CONFIG[language];
  const isBusy =
    voiceState === "listening" ||
    voiceState === "transcribing" ||
    voiceState === "thinking";

  /* ------------------------------------------------------------------ */
  /* Cleanup on unmount                                                 */
  /* ------------------------------------------------------------------ */
  React.useEffect(() => {
    return () => {
      sttRef.current?.cancel();
      stopSpeech();
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* Language change                                                    */
  /* ------------------------------------------------------------------ */
  function setLanguage(next: VoiceLang) {
    if (next === language) return;

    // Cancel any active recording.
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
    setTtsUnavailable(false);
    setLanguageState(next);
    setError(null);
    levelRef.current = 0;
    setMicLevel(0);
  }

  /* ------------------------------------------------------------------ */
  /* Error handling                                                     */
  /* ------------------------------------------------------------------ */
  function clearError() {
    setError(null);
    if (voiceState === "error") setVoiceState("idle");
  }

  /* ------------------------------------------------------------------ */
  /* Start recording                                                    */
  /* ------------------------------------------------------------------ */
  async function startRecording() {
    if (!cfg.sttSupported) {
      setVoiceState("error");
      setError(cfg.note ?? "Voice input is not supported for this language.");
      return;
    }

    // If already listening, stop instead.
    if (voiceState === "listening") {
      stopRecording();
      return;
    }

    if (voiceState !== "idle" && voiceState !== "error") return;

    setError(null);
    setPartial("");
    setTranscript("");
    setTtsUnavailable(false);
    stopSpeech();
    setTtsState("idle");
    setVoiceState("requesting_permission");
    levelRef.current = 0;
    setMicLevel(0);

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
          levelRef.current = 0;
          setMicLevel(0);

          // Notify the caller that a transcript is ready.
          if (t.trim() && onTranscriptRef.current) {
            onTranscriptRef.current(t);
          }
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
          levelRef.current = 0;
          setMicLevel(0);
        },
        onLevel: (v) => {
          // Exponential smoothing for fluid waveform.
          levelRef.current = levelRef.current * 0.6 + Math.min(1, v * 1.5) * 0.4;
          setMicLevel(levelRef.current);
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
          : "Microphone access is required for voice input."
      );
    }
  }

  /* ------------------------------------------------------------------ */
  /* Stop recording                                                     */
  /* ------------------------------------------------------------------ */
  function stopRecording() {
    if (voiceState !== "listening") return;

    sttRef.current?.stop();
    setVoiceState("transcribing");
    setPartial("");
    gotFinalRef.current = false;

    if (finalTimerRef.current) {
      window.clearTimeout(finalTimerRef.current);
    }

    // Timeout: if no final transcript after 15s, show error.
    finalTimerRef.current = window.setTimeout(() => {
      if (!gotFinalRef.current) {
        setVoiceState("error");
        setError("We couldn't hear a clear question. Please try again or type it.");
        setPartial("");
      }
    }, FINAL_TIMEOUT_MS);
  }

  /* ------------------------------------------------------------------ */
  /* Cancel recording                                                   */
  /* ------------------------------------------------------------------ */
  function cancelRecording() {
    if (sttRef.current) {
      sttRef.current.cancel();
      sttRef.current = null;
    }
    if (finalTimerRef.current) {
      window.clearTimeout(finalTimerRef.current);
      finalTimerRef.current = null;
    }
    setPartial("");
    setVoiceState("idle");
    levelRef.current = 0;
    setMicLevel(0);
  }

  /* ------------------------------------------------------------------ */
  /* TTS                                                                */
  /* ------------------------------------------------------------------ */
  function speak(text: string) {
    const ttsLang = cfg.tts;
    if (!ttsAvailable(ttsLang)) {
      setTtsUnavailable(true);
      return;
    }
    setTtsUnavailable(false);
    setVoiceState("speaking");
    setTtsState("playing");

    ttsSpeak(text, ttsLang, {
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

  function handlePause() {
    pauseSpeech();
    setTtsState("paused");
  }

  function handleResume() {
    resumeSpeech();
    setTtsState("playing");
    setVoiceState("speaking");
  }

  function handleStop() {
    stopSpeech();
    setTtsState("idle");
    setVoiceState("idle");
  }

  return {
    voiceState,
    micLevel,
    transcript,
    partial,
    ttsState,
    ttsUnavailable,
    language,
    setLanguage,
    startRecording,
    stopRecording,
    cancelRecording,
    speak,
    pauseSpeech: handlePause,
    resumeSpeech: handleResume,
    stopSpeech: handleStop,
    error,
    clearError,
    isBusy,
  };
}
