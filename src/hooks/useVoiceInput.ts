
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
} from "../lib/voice-tts";

/**
 * Voice input hook for AI Chat.
 *
 * STT lifecycle is preserved. TTS supports browser speech
 * and the deployed speak-answer server function.
 */

export interface UseVoiceInputOptions {
  onTranscript?: (text: string) => void;
  initialLanguage?: VoiceLang;
}

export interface UseVoiceInputReturn {
  voiceState: VoiceState;
  micLevel: number;
  transcript: string;
  partial: string;
  ttsState: TtsState;
  ttsUnavailable: boolean;
  language: VoiceLang;
  setLanguage: (lang: VoiceLang) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  speak: (text: string) => void;
  pauseSpeech: () => void;
  resumeSpeech: () => void;
  stopSpeech: () => void;
  error: string | null;
  clearError: () => void;
  isBusy: boolean;
}

const FINAL_TIMEOUT_MS = 15_000;

export function useVoiceInput(
  options: UseVoiceInputOptions = {},
): UseVoiceInputReturn {
  const {
    onTranscript,
    initialLanguage = "auto",
  } = options;

  const [language, setLanguageState] =
    React.useState<VoiceLang>(initialLanguage);

  const [voiceState, setVoiceState] =
    React.useState<VoiceState>("idle");

  const [ttsState, setTtsState] =
    React.useState<TtsState>("idle");

  const [partial, setPartial] = React.useState("");
  const [transcript, setTranscript] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [ttsUnavailable, setTtsUnavailable] = React.useState(false);
  const [micLevel, setMicLevel] = React.useState(0);

  const sttRef = React.useRef<
    Awaited<ReturnType<typeof startSTT>> | null
  >(null);

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

  /* Cleanup on unmount */

  React.useEffect(() => {
    return () => {
      sttRef.current?.cancel();

      if (finalTimerRef.current !== null) {
        window.clearTimeout(finalTimerRef.current);
        finalTimerRef.current = null;
      }

      stopSpeech();
    };
  }, []);

  /* Language change */

  function setLanguage(next: VoiceLang) {
    if (next === language) return;

    if (sttRef.current) {
      sttRef.current.cancel();
      sttRef.current = null;
    }

    if (finalTimerRef.current !== null) {
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

  /* Error handling */

  function clearError() {
    setError(null);

    if (voiceState === "error") {
      setVoiceState("idle");
    }
  }

  /* Start recording — STT logic preserved */

  async function startRecording() {
    if (!cfg.sttSupported) {
      setVoiceState("error");
      setError(
        cfg.note ??
          "Voice input is not supported for this language.",
      );
      return;
    }

    if (voiceState === "listening") {
      stopRecording();
      return;
    }

    if (
      voiceState !== "idle" &&
      voiceState !== "error"
    ) {
      return;
    }

    setError(null);
    setPartial("");
    setTranscript("");
    setTtsUnavailable(false);

    stopSpeech();
    setTtsState("idle");
    setVoiceState("requesting_permission");

    levelRef.current = 0;
    setMicLevel(0);
    gotFinalRef.current = false;

    try {
      const session = await startSTT(language, {
        onPartial: (text) => {
          setPartial(text);
        },

        onFinal: (result) => {
          gotFinalRef.current = true;

          if (finalTimerRef.current !== null) {
            window.clearTimeout(finalTimerRef.current);
            finalTimerRef.current = null;
          }

          const finalText = result.transcript;

          setTranscript(finalText);
          setPartial("");
          setVoiceState("idle");
          sttRef.current = null;

          levelRef.current = 0;
          setMicLevel(0);

          if (
            finalText.trim() &&
            onTranscriptRef.current
          ) {
            onTranscriptRef.current(finalText);
          }
        },

        onError: (err) => {
          gotFinalRef.current = true;

          if (finalTimerRef.current !== null) {
            window.clearTimeout(finalTimerRef.current);
            finalTimerRef.current = null;
          }

          sttRef.current = null;
          setVoiceState("error");
          setError(err.message);

          levelRef.current = 0;
          setMicLevel(0);
        },

        onVolume: (value) => {
          levelRef.current =
            levelRef.current * 0.6 +
            Math.min(1, value * 1.5) * 0.4;

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
          : "Microphone access is required for voice input.",
      );

      levelRef.current = 0;
      setMicLevel(0);
    }
  }

  /* Stop recording — STT logic preserved */

  function stopRecording() {
    if (voiceState !== "listening") return;

    gotFinalRef.current = false;
    sttRef.current?.stop();

    setVoiceState("transcribing");
    setPartial("");

    if (finalTimerRef.current !== null) {
      window.clearTimeout(finalTimerRef.current);
    }

    finalTimerRef.current = window.setTimeout(() => {
      if (!gotFinalRef.current) {
        setVoiceState("error");

        setError(
          "Voice recognition is taking too long. Please check your connection and try again, or type your question.",
        );

        setPartial("");
        sttRef.current = null;
      }
    }, FINAL_TIMEOUT_MS);
  }

  /* Cancel recording — STT logic preserved */

  function cancelRecording() {
    if (sttRef.current) {
      sttRef.current.cancel();
      sttRef.current = null;
    }

    if (finalTimerRef.current !== null) {
      window.clearTimeout(finalTimerRef.current);
      finalTimerRef.current = null;
    }

    gotFinalRef.current = false;

    setPartial("");
    setVoiceState("idle");

    levelRef.current = 0;
    setMicLevel(0);
  }

  /* Text-to-Speech */

  function speak(text: string): void {
    if (!text.trim()) return;

    const ttsLang = cfg.tts;

    setError(null);
    setTtsUnavailable(false);
    setVoiceState("speaking");
    setTtsState("playing");

    void ttsSpeak(text, ttsLang, {
      onEnd: () => {
        setVoiceState("idle");
        setTtsState("idle");
      },

      onError: () => {
        setVoiceState("idle");
        setTtsState("idle");
        setTtsUnavailable(true);

        setError(
          "Audio playback failed. Please try again.",
        );
      },
    }).then((started) => {
      if (!started) {
        setVoiceState("idle");
        setTtsState("idle");
        setTtsUnavailable(true);
      }
    }).catch((err: unknown) => {
      console.error("TTS error:", err);

      setVoiceState("idle");
      setTtsState("idle");
      setTtsUnavailable(true);

      setError(
        "Audio playback failed. Please try again.",
      );
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
