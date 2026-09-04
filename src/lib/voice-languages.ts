import type { STTLanguageCode } from "./voice-stt";
import type { TTSLanguageCode } from "./voice-tts";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type VoiceLang = "auto" | "english" | "urdu" | "punjabi" | "saraiki";

export type VoiceState =
  | "idle"
  | "requesting_permission"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

export type TtsState = "idle" | "playing" | "paused";

/* ------------------------------------------------------------------ */
/* Language configuration                                              */
/* ------------------------------------------------------------------ */

export const LANG_CONFIG: Record<
  VoiceLang,
  {
    label: string;
    native: string;
    stt: STTLanguageCode;
    chat: "auto" | "urdu" | "english";
    tts: TTSLanguageCode;
    /** Honest provider capability — Saraiki STT isn't supported by Sarvam. */
    sttSupported: boolean;
    /** Which STT provider handles this language (or "none" if unsupported). */
    provider: "sarvam" | "none";
    note?: string;
  }
> = {
  auto: {
    label: "Auto",
    native: "خودکار",
    stt: "auto",
    chat: "auto",
    tts: "ur",
    sttSupported: true,
    provider: "sarvam",
    note: "Auto detects your language automatically.",
  },
  english: {
    label: "English",
    native: "English",
    stt: "en-IN",
    chat: "english",
    tts: "en",
    sttSupported: true,
    provider: "sarvam",
  },
  urdu: {
    label: "Urdu",
    native: "اردو",
    stt: "ur-IN",
    chat: "urdu",
    tts: "ur",
    sttSupported: true,
    provider: "sarvam",
  },
  punjabi: {
    label: "Punjabi",
    native: "پنجابی",
    stt: "pa-IN",
    chat: "auto",
    tts: "pa",
    sttSupported: true,
    provider: "sarvam",
    note: "Punjabi voice recognition may vary by device.",
  },
  saraiki: {
    label: "Saraiki",
    native: "سرائیکی",
    stt: "auto",
    chat: "auto",
    tts: "skr",
    sttSupported: false,
    provider: "none",
    note: "Saraiki is not yet supported by any speech provider. You can type your question instead.",
  },
};

/** The three main voice languages shown as pills. */
export const MAIN_LANGS: { key: VoiceLang; label: string; native: string }[] = [
  { key: "urdu", label: "Urdu", native: "اردو" },
  { key: "punjabi", label: "Punjabi", native: "پنجابی" },
  { key: "saraiki", label: "Saraiki", native: "سرائیکی" },
];
