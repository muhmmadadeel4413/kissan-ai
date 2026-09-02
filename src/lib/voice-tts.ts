/**
 * Voice Assistant — Text-to-Speech.
 *
 * Uses the browser's built-in `speechSynthesis` (no API key, nothing leaves
 * the device). Voices are selected by the closest supported language:
 *   en → en / en-US / en-IN / en-GB
 *   ur → ur / ur-PK / ur-IN
 *   pa → pa / pa-PK / pa-IN / pa-Arab
 *   skr → skr (rare) → falls back to Urdu with an honest note
 *
 * If no suitable voice exists, the caller gets `false` and must fall back to
 * showing the answer as text — we never fabricate audio.
 */

export type TTSLanguageCode = "en" | "ur" | "pa" | "skr";

export interface TTSVoicePick {
  voice: SpeechSynthesisVoice;
  /** Set when we used a fallback voice for a rarely-supported language. */
  note?: string;
}

const VOICE_PREFERENCE: Record<TTSLanguageCode, string[]> = {
  en: ["en", "en-US", "en-IN", "en-GB"],
  ur: ["ur", "ur-PK", "ur-IN"],
  pa: ["pa", "pa-PK", "pa-IN", "pa-Arab"],
  skr: ["skr", "ur-PK", "ur"],
};

function allVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return [];
  }
  return window.speechSynthesis.getVoices();
}

/** Warm the voice cache (voices load async on some browsers). */
export function loadVoices(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.onvoiceschanged = () => {
    /* voices are now available in getVoices() */
  };
  // Force an initial read so some browsers populate early.
  void allVoices();
}

/** Pick the closest available voice for a language, or null if none exists. */
export function pickVoice(lang: TTSLanguageCode): TTSVoicePick | null {
  const voices = allVoices();
  if (!voices.length) return null;
  const prefs = VOICE_PREFERENCE[lang];

  for (const p of prefs) {
    const exact = voices.find(
      (v) => v.lang.replace("_", "-").toLowerCase() === p.toLowerCase()
    );
    if (exact) return { voice: exact };
  }
  for (const p of prefs.slice(0, 3)) {
    const startsWith = voices.find((v) =>
      v.lang.toLowerCase().startsWith(p.toLowerCase())
    );
    if (startsWith) {
      return {
        voice: startsWith,
        note:
          lang === "skr"
            ? "Using the closest available voice for Saraiki."
            : undefined,
      };
    }
  }
  return null;
}

/** True when the browser can speak this language with a usable voice. */
export function ttsAvailable(lang: TTSLanguageCode): boolean {
  return pickVoice(lang) !== null;
}

/**
 * Speak text aloud. Returns false when no usable voice exists (caller must
 * fall back to showing the answer as text).
 */
export function speak(
  text: string,
  lang: TTSLanguageCode,
  handlers?: { onEnd?: () => void; onError?: () => void }
): boolean {
  if (!("speechSynthesis" in window)) return false;
  const pick = pickVoice(lang);
  if (!pick) return false;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = pick.voice;
  utterance.lang = pick.voice.lang;
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.onend = () => handlers?.onEnd?.();
  utterance.onerror = () => handlers?.onError?.();

  window.speechSynthesis.cancel(); // avoid overlapping utterances
  window.speechSynthesis.speak(utterance);
  return true;
}

export function pauseSpeech(): void {
  if ("speechSynthesis" in window) window.speechSynthesis.pause();
}

export function resumeSpeech(): void {
  if ("speechSynthesis" in window) window.speechSynthesis.resume();
}

export function stopSpeech(): void {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}