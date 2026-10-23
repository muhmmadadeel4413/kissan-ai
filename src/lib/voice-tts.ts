
import { supabase } from "./supabase";

export type TTSLanguageCode = "en" | "ur" | "pa" | "skr";

export interface TTSVoicePick {
  voice: SpeechSynthesisVoice;
  note?: string;
}

const VOICE_PREFERENCE: Record<TTSLanguageCode, string[]> = {
  en: ["en", "en-US", "en-IN", "en-GB"],
  ur: ["ur", "ur-PK", "ur-IN"],
  pa: ["pa", "pa-PK", "pa-IN", "pa-Arab"],
  skr: ["skr", "ur-PK", "ur"],
};

function allVoices(): SpeechSynthesisVoice[] {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window)
  ) {
    return [];
  }

  return window.speechSynthesis.getVoices();
}

export function loadVoices(): void {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window)
  ) {
    return;
  }

  window.speechSynthesis.onvoiceschanged = () => {
    // Browser voices have loaded.
  };

  void allVoices();
}

export function pickVoice(
  lang: TTSLanguageCode,
): TTSVoicePick | null {
  const voices = allVoices();
  if (!voices.length) return null;

  const prefs = VOICE_PREFERENCE[lang];

  for (const preference of prefs) {
    const exact = voices.find(
      (voice) =>
        voice.lang.replace("_", "-").toLowerCase() ===
        preference.toLowerCase(),
    );

    if (exact) return { voice: exact };
  }

  for (const preference of prefs.slice(0, 3)) {
    const matchingVoice = voices.find((voice) =>
      voice.lang
        .replace("_", "-")
        .toLowerCase()
        .startsWith(preference.toLowerCase()),
    );

    if (matchingVoice) {
      return {
        voice: matchingVoice,
        note:
          lang === "skr"
            ? "Using the closest available voice for Saraiki."
            : undefined,
      };
    }
  }

  return null;
}

/**
 * Server-side TTS is available as a fallback when a browser
 * does not have a suitable voice.
 */
export function ttsAvailable(_lang: TTSLanguageCode): boolean {
  return true;
}

let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let playbackRequestId = 0;

function cleanupAudio(audio: HTMLAudioElement): void {
  if (activeAudio !== audio) return;

  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();

  activeAudio = null;

  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

export async function speak(
  text: string,
  lang: TTSLanguageCode,
  handlers?: {
    onEnd?: () => void;
    onError?: () => void;
  },
): Promise<boolean> {
  const cleanText = text.trim();

  if (!cleanText || typeof window === "undefined") {
    return false;
  }

  stopSpeech();

  const requestId = playbackRequestId;
  const browserVoice = pickVoice(lang);

  // Prefer the deployed Gemini TTS function for Urdu,
  // Punjabi and Saraiki. English uses browser speech when available.
  const useRemoteTTS =
    lang !== "en" || browserVoice === null;

  if (!useRemoteTTS && browserVoice) {
    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);

      utterance.voice = browserVoice.voice;
      utterance.lang = browserVoice.voice.lang;
      utterance.rate = 1;
      utterance.pitch = 1;

      utterance.onend = () => {
        if (requestId === playbackRequestId) {
          handlers?.onEnd?.();
        }
      };

      utterance.onerror = () => {
        if (requestId === playbackRequestId) {
          handlers?.onError?.();
        }
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (error) {
      console.error("Browser TTS failed:", error);
      handlers?.onError?.();
      return false;
    }
  }

  try {
    const serverLanguage =
      lang === "en" ? "en" : lang === "pa" ? "pa" : "ur";

    const { data, error } = await supabase.functions.invoke(
      "speak-answer",
      {
        body: {
          text: cleanText.slice(0, 2500),
          language: serverLanguage,
        },
      },
    );

    // Ignore an older request if the user pressed Stop
    // or started speaking another answer.
    if (requestId !== playbackRequestId) {
      return false;
    }

    if (error) throw error;

    if (
      !data ||
      typeof data.audioBase64 !== "string" ||
      !data.audioBase64
    ) {
      throw new Error(
        data?.error || "The TTS function returned no audio.",
      );
    }

    const binary = atob(data.audioBase64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], {
      type: data.mimeType || "audio/wav",
    });

    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);

    activeAudio = audio;
    activeObjectUrl = objectUrl;

    audio.onended = () => {
      cleanupAudio(audio);
      handlers?.onEnd?.();
    };

    audio.onerror = () => {
      cleanupAudio(audio);
      handlers?.onError?.();
    };

    await audio.play();
    return true;
  } catch (error) {
    if (requestId === playbackRequestId) {
      console.error("TTS playback failed:", error);
      handlers?.onError?.();
    }

    return false;
  }
}

export function pauseSpeech(): void {
  if (typeof window === "undefined") return;

  if (activeAudio) {
    activeAudio.pause();
  } else if ("speechSynthesis" in window) {
    window.speechSynthesis.pause();
  }
}

export function resumeSpeech(): void {
  if (typeof window === "undefined") return;

  if (activeAudio) {
    void activeAudio.play().catch((error) => {
      console.error("TTS resume failed:", error);
    });
  } else if ("speechSynthesis" in window) {
    window.speechSynthesis.resume();
  }
}

export function stopSpeech(): void {
  playbackRequestId++;

  if (
    typeof window !== "undefined" &&
    "speechSynthesis" in window
  ) {
    window.speechSynthesis.cancel();
  }

  if (activeAudio) {
    cleanupAudio(activeAudio);
  }
}
