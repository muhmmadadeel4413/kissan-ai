
import { supabase } from "./supabase";

export type STTLanguageCode =
  | "unknown"
  | "auto"
  | "en-IN"
  | "ur-IN"
  | "pa-IN";

export function normalizeSttLanguage(
  language?: string,
): STTLanguageCode {
  const value = language?.trim().toLowerCase();

  if (!value || value === "auto" || value === "unknown") {
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

  return "unknown";
}

export interface STTSession {
  stop: () => void;
  cancel: () => void;
}

export interface STTCallbacks {
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (error: Error) => void;
  onLevel?: (level: number) => void;
}

interface PCMMessage {
  type: "pcm";
  samples: Float32Array;
}

const TARGET_SAMPLE_RATE = 16000;
const MIN_RECORDING_MS = 500;

function encodeWav(
  samples: Int16Array,
  sampleRate = TARGET_SAMPLE_RATE,
): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (
    offset: number,
    value: string,
  ) => {
    for (let i = 0; i < value.length; i++) {
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

  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);

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

  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  writeString(36, "data");

  view.setUint32(
    40,
    samples.length * 2,
    true,
  );

  let offset = 44;

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(
      offset,
      samples[i],
      true,
    );

    offset += 2;
  }

  return new Blob(
    [buffer],
    { type: "audio/wav" },
  );
}

function downsampleTo16k(
  input: Float32Array,
  inputSampleRate: number,
): Float32Array {
  if (inputSampleRate === TARGET_SAMPLE_RATE) {
    return input;
  }

  const ratio =
    inputSampleRate / TARGET_SAMPLE_RATE;

  const outputLength = Math.round(
    input.length / ratio,
  );

  const output =
    new Float32Array(outputLength);

  let outputOffset = 0;
  let inputOffset = 0;

  while (outputOffset < outputLength) {
    const nextInputOffset = Math.round(
      (outputOffset + 1) * ratio,
    );

    let accumulator = 0;
    let count = 0;

    for (
      let i = inputOffset;
      i < nextInputOffset &&
      i < input.length;
      i++
    ) {
      accumulator += input[i];
      count++;
    }

    output[outputOffset] =
      count > 0
        ? accumulator / count
        : 0;

    outputOffset++;
    inputOffset = nextInputOffset;
  }

  return output;
}

function floatToInt16(
  samples: Float32Array,
): Int16Array {
  const output =
    new Int16Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(
      -1,
      Math.min(1, samples[i]),
    );

    output[i] =
      sample < 0
        ? sample * 0x8000
        : sample * 0x7fff;
  }

  return output;
}

function calculateRms(
  samples: Float32Array,
): number {
  if (!samples.length) {
    return 0;
  }

  let sum = 0;

  for (const sample of samples) {
    sum += sample * sample;
  }

  return Math.sqrt(
    sum / samples.length,
  );
}

/**
 * PRIMARY STT
 *
 * Whisper large-v3-turbo
 *
 * The actual model runs server-side through
 * the Supabase "whisper-stt" Edge Function.
 *
 * API keys must NEVER be exposed in the browser.
 */
async function uploadToWhisper(
  wavBlob: Blob,
  language?: string,
): Promise<{
  transcript: string;
  languageCode: string;
}> {
  const normalizedLanguage =
    normalizeSttLanguage(language);

  const formData = new FormData();

  formData.append(
    "file",
    new File(
      [wavBlob],
      "audio.wav",
      {
        type: "audio/wav",
      },
    ),
  );

  formData.append(
    "language_code",
    normalizedLanguage,
  );

  const { data, error } =
    await supabase.functions.invoke(
      "whisper-stt",
      {
        body: formData,
      },
    );

  if (error) {
    let message =
      error.message ||
      "Whisper speech recognition failed.";

    try {
      const context = (
        error as {
          context?: Response;
        }
      ).context;

      if (context) {
        const responseData =
          await context.json();

        if (
          typeof responseData?.error ===
          "string"
        ) {
          message =
            responseData.error;
        }
      }
    } catch {
      // Keep original error message.
    }

    throw new Error(message);
  }

  if (!data) {
    throw new Error(
      "Whisper returned no response.",
    );
  }

  if (
    typeof data.error === "string"
  ) {
    throw new Error(data.error);
  }

  const transcript =
    typeof data.transcript === "string"
      ? data.transcript.trim()
      : "";

  if (!transcript) {
    throw new Error(
      "Whisper returned an empty transcript.",
    );
  }

  return {
    transcript,
    languageCode:
      typeof data.language_code === "string"
        ? data.language_code
        : normalizedLanguage,
  };
}

/**
 * BACKUP STT
 *
 * Sarvam Saaras v4
 */
async function uploadToSarvam(
  wavBlob: Blob,
  language?: string,
): Promise<{
  transcript: string;
  languageCode: string;
}> {
  const normalizedLanguage =
    normalizeSttLanguage(language);

  const formData = new FormData();

  formData.append(
    "file",
    new File(
      [wavBlob],
      "audio.wav",
      {
        type: "audio/wav",
      },
    ),
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
    let message =
      error.message ||
      "Sarvam speech recognition failed.";

    try {
      const context = (
        error as {
          context?: Response;
        }
      ).context;

      if (context) {
        const responseData =
          await context.json();

        if (
          typeof responseData?.error ===
          "string"
        ) {
          message =
            responseData.error;
        }
      }
    } catch {
      // Keep original error message.
    }

    throw new Error(message);
  }

  if (!data) {
    throw new Error(
      "Sarvam returned no response.",
    );
  }

  if (
    typeof data.error === "string"
  ) {
    throw new Error(data.error);
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
      typeof data.language_code ===
      "string"
        ? data.language_code
        : normalizedLanguage,
  };
}

/**
 * STT ROUTER
 *
 * Primary:
 *   Whisper large-v3-turbo
 *
 * Backup:
 *   Sarvam Saaras v4
 */
async function uploadToSTT(
  wavBlob: Blob,
  language?: string,
): Promise<{
  transcript: string;
  languageCode: string;
}> {
  // Saraiki is intentionally unsupported.
  const normalizedLanguage =
    normalizeSttLanguage(language);

  if (
    language?.toLowerCase() === "saraiki"
  ) {
    throw new Error(
      "Saraiki voice recognition is not available yet. Please type your question instead.",
    );
  }

  // --------------------------------------------
  // PRIMARY: Whisper large-v3-turbo
  // --------------------------------------------
  try {
    console.log(
      "[STT] Trying Whisper large-v3-turbo...",
    );

    const result =
      await uploadToWhisper(
        wavBlob,
        normalizedLanguage,
      );

    console.log(
      "[STT] Whisper succeeded.",
    );

    return result;
  } catch (whisperError) {
    console.warn(
      "[STT] Whisper failed. Trying Sarvam backup.",
      whisperError,
    );
  }

  // --------------------------------------------
  // BACKUP: Sarvam Saaras v4
  // --------------------------------------------
  try {
    console.log(
      "[STT] Trying Sarvam Saaras v4 backup...",
    );

    const result =
      await uploadToSarvam(
        wavBlob,
        normalizedLanguage,
      );

    console.log(
      "[STT] Sarvam backup succeeded.",
    );

    return result;
  } catch (sarvamError) {
    console.error(
      "[STT] Both Whisper and Sarvam failed.",
      sarvamError,
    );

    throw new Error(
      "We couldn't understand your voice. Please try again or type your question.",
    );
  }
}

export async function startSTT(
  language: STTLanguageCode | string,
  callbacks: STTCallbacks,
): Promise<STTSession> {
  let stream:
    | MediaStream
    | null = null;

  let audioContext:
    | AudioContext
    | null = null;

  let source:
    | MediaStreamAudioSourceNode
    | null = null;

  let worklet:
    | AudioWorkletNode
    | null = null;

  let stopped = false;
  let cancelled = false;

  const pcmChunks: Float32Array[] = [];

  const startedAt = Date.now();

  try {
    // -----------------------------------------------------
    // Microphone
    // -----------------------------------------------------

    stream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

    audioContext =
      new AudioContext();

    await audioContext.audioWorklet.addModule(
      "/audio-processor.js",
    );

    source =
      audioContext.createMediaStreamSource(
        stream,
      );

    worklet =
      new AudioWorkletNode(
        audioContext,
        "audio-processor",
      );

    worklet.port.onmessage = (
      event: MessageEvent<PCMMessage>,
    ) => {
      if (
        stopped ||
        cancelled
      ) {
        return;
      }

      if (
        !event.data ||
        event.data.type !== "pcm"
      ) {
        return;
      }

      const samples =
        event.data.samples;

      if (
        !(samples instanceof Float32Array)
      ) {
        return;
      }

      const rms =
        calculateRms(samples);

      callbacks.onLevel?.(
        Math.min(1, rms * 5),
      );

      const downsampled =
        downsampleTo16k(
          samples,
          audioContext?.sampleRate ||
            TARGET_SAMPLE_RATE,
        );

      pcmChunks.push(
        downsampled,
      );
    };

    source.connect(worklet);

    // Do not connect to destination.
    // This prevents microphone feedback.

    await audioContext.resume();

    return {
      stop: () => {
        if (
          stopped ||
          cancelled
        ) {
          return;
        }

        stopped = true;

        void finishRecording();
      },

      cancel: () => {
        if (
          stopped ||
          cancelled
        ) {
          return;
        }

        cancelled = true;

        cleanup();
      },
    };
  } catch (error) {
    cleanup();

    const finalError =
      error instanceof Error
        ? error
        : new Error(
            "Could not access microphone.",
          );

    callbacks.onError?.(
      finalError,
    );

    throw finalError;
  }

  async function finishRecording() {
    const recordingDuration =
      Date.now() - startedAt;

    cleanup();

    if (
      recordingDuration <
      MIN_RECORDING_MS
    ) {
      callbacks.onError?.(
        new Error(
          "Please speak for at least half a second.",
        ),
      );

      return;
    }

    if (!pcmChunks.length) {
      callbacks.onError?.(
        new Error(
          "No audio was captured. Please try again.",
        ),
      );

      return;
    }

    try {
      const totalLength =
        pcmChunks.reduce(
          (total, chunk) =>
            total + chunk.length,
          0,
        );

      const merged =
        new Float32Array(
          totalLength,
        );

      let offset = 0;

      for (const chunk of pcmChunks) {
        merged.set(
          chunk,
          offset,
        );

        offset += chunk.length;
      }

      const int16Samples =
        floatToInt16(
          merged,
        );

      const wavBlob =
        encodeWav(
          int16Samples,
          TARGET_SAMPLE_RATE,
        );

      if (wavBlob.size < 1000) {
        callbacks.onError?.(
          new Error(
            "The recording was too short. Please try again.",
          ),
        );

        return;
      }

      if (cancelled) {
        return;
      }

      // --------------------------------------------
      // Whisper PRIMARY → Sarvam BACKUP
      // --------------------------------------------

      const result =
        await uploadToSTT(
          wavBlob,
          language,
        );

      if (cancelled) {
        return;
      }

      callbacks.onFinal?.(
        result.transcript,
      );
    } catch (error) {
      if (cancelled) {
        return;
      }

      const finalError =
        error instanceof Error
          ? error
          : new Error(
              "Speech recognition failed.",
            );

      callbacks.onError?.(
        finalError,
      );
    }
  }

  function cleanup() {
    try {
      source?.disconnect();
    } catch {
      // Ignore cleanup errors.
    }

    try {
      worklet?.disconnect();
    } catch {
      // Ignore cleanup errors.
    }

    if (stream) {
      for (
        const track of stream.getTracks()
      ) {
        track.stop();
      }
    }

    if (audioContext) {
      void audioContext
        .close()
        .catch(
          () => undefined,
        );
    }

    source = null;
    worklet = null;
    stream = null;
    audioContext = null;
  }
}

