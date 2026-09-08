
import { supabase } from "./supabase";

import {
  LANG_CONFIG,
  type VoiceLang,
} from "./voice-languages";

export type STTLanguageCode =
  | "unknown"
  | "auto"
  | "en-IN"
  | "ur-IN"
  | "pa-IN"
  | `${string}-${string}`;

export interface STTResult {
  transcript: string;
  languageCode?: string;
}

export interface STTCallbacks {
  onPartial?: (text: string) => void;
  onFinal?: (result: STTResult) => void;
  onError?: (error: Error) => void;
  onVolume?: (level: number) => void;
}

export interface StartSTTOptions {
  language?: VoiceLang;
  callbacks: STTCallbacks;
}

export interface STTController {
  stop: () => void;
  cancel: () => void;
}

export function normalizeSttLanguage(
  language?: string | null,
): STTLanguageCode {
  const trimmed = language?.trim();

  if (!trimmed) {
    return "unknown";
  }

  const value = trimmed.toLowerCase();

  if (value === "auto" || value === "unknown") {
    return "unknown";
  }

  if (
    value === "urdu" ||
    value === "ur" ||
    value === "ur-pk" ||
    value === "ur-in"
  ) {
    return "ur-IN";
  }

  if (
    value === "english" ||
    value === "en" ||
    value === "en-us" ||
    value === "en-gb" ||
    value === "en-in"
  ) {
    return "en-IN";
  }

  if (
    value === "punjabi" ||
    value === "pa" ||
    value === "pa-pk" ||
    value === "pa-in"
  ) {
    return "pa-IN";
  }

  // Preserve unknown valid BCP-47 style language codes.
  // Example: hi-IN, bn-IN
  if (/^[a-z]{2,3}-[A-Za-z]{2,4}$/.test(trimmed)) {
    return trimmed as STTLanguageCode;
  }

  return "unknown";
}

async function uploadToWhisper(
  audioBlob: Blob,
  language?: STTLanguageCode,
): Promise<STTResult> {
  const formData = new FormData();

  formData.append("file", audioBlob, "recording.wav");

  if (
    language &&
    language !== "unknown" &&
    language !== "auto"
  ) {
    let whisperLanguage: string | undefined;

    switch (language) {
      case "en-IN":
        whisperLanguage = "en";
        break;

      case "ur-IN":
        whisperLanguage = "ur";
        break;

      case "pa-IN":
        whisperLanguage = "pa";
        break;

      default:
        whisperLanguage = undefined;
    }

    if (whisperLanguage) {
      formData.append("language_code", whisperLanguage);
    }
  }

  const { data, error } = await supabase.functions.invoke(
    "whisper-stt",
    {
      body: formData,
    },
  );

  if (error) {
    throw new Error(
      error.message || "Whisper speech recognition failed.",
    );
  }

  if (!data) {
    throw new Error("Whisper returned an empty response.");
  }

  if (data.error) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Whisper speech recognition failed.",
    );
  }

  const transcript =
    typeof data.transcript === "string"
      ? data.transcript.trim()
      : "";

  if (!transcript) {
    throw new Error(
      "We couldn't hear a clear question. Please try again or type your question.",
    );
  }

  return {
    transcript,
    languageCode:
      typeof data.language_code === "string"
        ? data.language_code
        : undefined,
  };
}

export async function uploadToSarvam(
  audioBlob: Blob,
  language?: STTLanguageCode,
): Promise<STTResult> {
  const normalizedLanguage =
    normalizeSttLanguage(language);

  const formData = new FormData();

  formData.append(
    "file",
    audioBlob,
    "recording.wav",
  );

  formData.append(
    "language_code",
    normalizedLanguage,
  );

  formData.append(
    "model",
    "saaras:v4",
  );

  formData.append(
    "mode",
    "transcribe",
  );

  const { data, error } =
    await supabase.functions.invoke(
      "sarvam-stt",
      {
        body: formData,
      },
    );

  if (error) {
    const responseError =
      data?.error;

    if (
      typeof responseError === "string" &&
      responseError.trim()
    ) {
      throw new Error(responseError);
    }

    throw new Error(
      error.message ||
        "Sarvam speech recognition failed.",
    );
  }

  if (!data) {
    throw new Error(
      "Sarvam returned an empty response.",
    );
  }

  if (data.error) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Sarvam speech recognition failed.",
    );
  }

  const transcript =
    typeof data.transcript === "string"
      ? data.transcript.trim()
      : "";

  if (!transcript) {
    throw new Error(
      "We couldn't hear a clear question. Please try again or type your question.",
    );
  }

  return {
    transcript,
    languageCode:
      typeof data.language_code === "string"
        ? data.language_code
        : undefined,
  };
}

async function uploadToSTT(
  audioBlob: Blob,
  language?: STTLanguageCode,
): Promise<STTResult> {
  const normalizedLanguage =
    normalizeSttLanguage(language);

  // Saraiki is handled before upload in startSTT()
  // because Saraiki is a VoiceLang, not an STTLanguageCode.

  // Primary provider: Whisper.
  try {
    return await uploadToWhisper(
      audioBlob,
      normalizedLanguage,
    );
  } catch (whisperError) {
    console.warn(
      "Whisper STT failed, trying Sarvam backup:",
      whisperError,
    );
  }

  // Backup provider: Sarvam Saaras v4.
  try {
    return await uploadToSarvam(
      audioBlob,
      normalizedLanguage,
    );
  } catch (sarvamError) {
    console.error(
      "Both Whisper and Sarvam STT failed:",
      sarvamError,
    );

    throw new Error(
      "We couldn't hear a clear question. Please try again or type your question.",
    );
  }
}

function mergeFloat32Arrays(
  arrays: Float32Array[],
): Float32Array {
  const totalLength = arrays.reduce(
    (total, array) => total + array.length,
    0,
  );

  const result = new Float32Array(
    totalLength,
  );

  let offset = 0;

  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
}

function downsampleBuffer(
  buffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
): Float32Array {
  if (outputSampleRate === inputSampleRate) {
    return buffer;
  }

  if (outputSampleRate > inputSampleRate) {
    throw new Error(
      "Output sample rate must be lower than input sample rate.",
    );
  }

  const sampleRateRatio =
    inputSampleRate / outputSampleRate;

  const newLength = Math.round(
    buffer.length / sampleRateRatio,
  );

  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round(
      (offsetResult + 1) * sampleRateRatio,
    );

    let accum = 0;
    let count = 0;

    for (
      let i = offsetBuffer;
      i < nextOffsetBuffer &&
      i < buffer.length;
      i++
    ) {
      accum += buffer[i];
      count++;
    }

    result[offsetResult] =
      count > 0 ? accum / count : 0;

    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

function encodeWav(
  samples: Float32Array,
  sampleRate: number,
): Blob {
  const buffer = new ArrayBuffer(
    44 + samples.length * 2,
  );

  const view = new DataView(buffer);

  const writeString = (
    offset: number,
    value: string,
  ) => {
    for (
      let i = 0;
      i < value.length;
      i++
    ) {
      view.setUint8(
        offset + i,
        value.charCodeAt(i),
      );
    }
  };

  writeString(0, "RIFF");

  view.setUint32(
    4,
    36 + samples.length * 2,
    true,
  );

  writeString(8, "WAVE");
  writeString(12, "fmt ");

  view.setUint32(
    16,
    16,
    true,
  );

  view.setUint16(
    20,
    1,
    true,
  );

  view.setUint16(
    22,
    1,
    true,
  );

  view.setUint32(
    24,
    sampleRate,
    true,
  );

  view.setUint32(
    28,
    sampleRate * 2,
    true,
  );

  view.setUint16(
    32,
    2,
    true,
  );

  view.setUint16(
    34,
    16,
    true,
  );

  writeString(36, "data");

  view.setUint32(
    40,
    samples.length * 2,
    true,
  );

  let offset = 44;

  for (
    let i = 0;
    i < samples.length;
    i++
  ) {
    const sample = Math.max(
      -1,
      Math.min(1, samples[i]),
    );

    const value =
      sample < 0
        ? sample * 0x8000
        : sample * 0x7fff;

    view.setInt16(
      offset,
      value,
      true,
    );

    offset += 2;
  }

  return new Blob([buffer], {
    type: "audio/wav",
  });
}

export async function startSTT(
  language: VoiceLang,
  callbacks: STTCallbacks,
): Promise<STTController> {
  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null =
    null;
  let workletNode: AudioWorkletNode | null =
    null;

  let stopped = false;
  let cancelled = false;
  let chunks: Float32Array[] = [];

  const startedAt = Date.now();

  const cleanup = () => {
    if (workletNode) {
      try {
        workletNode.disconnect();
      } catch {
        // Ignore cleanup errors.
      }

      workletNode = null;
    }

    if (source) {
      try {
        source.disconnect();
      } catch {
        // Ignore cleanup errors.
      }

      source = null;
    }

    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }

      stream = null;
    }

    if (audioContext) {
      void audioContext.close().catch(() => {
        // Ignore cleanup errors.
      });

      audioContext = null;
    }
  };

  const cancelRecording = () => {
    if (stopped) {
      return;
    }

    cancelled = true;
    stopped = true;
    chunks = [];
    cleanup();
  };

  try {
    stream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

    if (stopped) {
      cleanup();

      return {
        stop: () => undefined,
        cancel: () => undefined,
      };
    }

    audioContext = new AudioContext();

    await audioContext.audioWorklet.addModule(
      "/audio-processor.js",
    );

    source =
      audioContext.createMediaStreamSource(
        stream,
      );

    workletNode =
      new AudioWorkletNode(
        audioContext,
        "audio-processor",
      );

    workletNode.port.onmessage = (
      event: MessageEvent,
    ) => {
      if (stopped) {
        return;
      }

      const data = event.data;

      if (
        data &&
        data.type === "audio" &&
        data.samples instanceof Float32Array
      ) {
        chunks.push(data.samples);

        let sum = 0;

        for (
          const sample of data.samples
        ) {
          sum += sample * sample;
        }

        const rms =
          data.samples.length > 0
            ? Math.sqrt(
                sum / data.samples.length,
              )
            : 0;

        callbacks.onVolume?.(
          Math.min(1, rms * 8),
        );
      }
    };

    source.connect(workletNode);

    workletNode.connect(
      audioContext.destination,
    );

    const stopRecording = async () => {
      if (stopped) {
        return;
      }

      stopped = true;

      const recordingSampleRate =
        audioContext?.sampleRate ?? 48000;

      cleanup();

      const duration =
        Date.now() - startedAt;

      if (duration < 500) {
        callbacks.onError?.(
          new Error(
            "Recording was too short. Please speak for a moment and try again.",
          ),
        );

        return;
      }

      const merged =
        mergeFloat32Arrays(chunks);

      chunks = [];

      if (merged.length === 0) {
        callbacks.onError?.(
          new Error(
            "No audio was captured. Please try again.",
          ),
        );

        return;
      }

      const downsampled =
        downsampleBuffer(
          merged,
          recordingSampleRate,
          16000,
        );

      const wavBlob =
        encodeWav(
          downsampled,
          16000,
        );

      if (wavBlob.size < 1000) {
        callbacks.onError?.(
          new Error(
            "The recording was too short or empty. Please try again.",
          ),
        );

        return;
      }

      try {
        const config =
          LANG_CONFIG[language];

        if (!config.sttSupported) {
          throw new Error(
            config.note ||
              "Voice recognition for this language isn't available. You can type your question instead.",
          );
        }

        const result =
          await uploadToSTT(
            wavBlob,
            config.stt,
          );

        if (!cancelled) {
          callbacks.onFinal?.(result);
        }
      } catch (error) {
        const normalizedError =
          error instanceof Error
            ? error
            : new Error(
                String(error),
              );

        if (!cancelled) {
          callbacks.onError?.(
            normalizedError,
          );
        }
      }
    };

    return {
      stop: () => {
        void stopRecording();
      },
      cancel: cancelRecording,
    };
  } catch (error) {
    cleanup();

    const normalizedError =
      error instanceof Error
        ? error
        : new Error(String(error));

    callbacks.onError?.(
      normalizedError,
    );

    return {
      stop: () => undefined,
      cancel: () => undefined,
    };
  }
}
