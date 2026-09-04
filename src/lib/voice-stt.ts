import { supabase } from "./supabase";

/**
 * Voice Assistant — Speech-to-Text (Sarvam AI).
 *
 * Uses Sarvam AI's REST STT API via a secure Edge Function proxy.
 *
 * Flow:
 *   1. Capture mic audio via AudioWorklet (PCM_S16LE @16 kHz).
 *   2. On stop, encode accumulated PCM to a WAV Blob.
 *   3. POST the WAV to the `sarvam-stt` Edge Function (SARVAM_API_KEY
 *      stays server-side, never reaches the browser).
 *   4. Return the final transcript via the onFinal callback.
 *
 * Language support is reported honestly: Saraiki is not supported by Sarvam
 * and remains marked as unavailable.
 */

export type STTLanguageCode = "auto" | "en-IN" | "ur-IN" | "pa-IN";

export interface STTSession {
  /** Stop recording and finalize the transcript (mic stops immediately). */
  stop: () => void;
  /** Cancel immediately (no final transcript needed). */
  cancel: () => void;
}

export interface STTCallbacks {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  /** Optional real-time mic level (0..1 RMS) for voice visualisations. */
  onLevel?: (level: number) => void;
}

const SAMPLE_RATE = 16000;

/** AudioWorklet: downsample mic input to 16 kHz and emit Int16 PCM chunks. */
const WORKLET_SOURCE = `
class KissanPcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = ${SAMPLE_RATE};
    this.ratio = sampleRate / this.targetRate;
    this.acc = 0;
    this.chunk = [];
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channel = input[0];
    for (let i = 0; i < channel.length; i++) {
      this.acc += this.ratio;
      if (this.acc >= 1) {
        this.acc -= 1;
        const s = Math.max(-1, Math.min(1, channel[i]));
        const i16 = s < 0 ? s * 0x8000 : s * 0x7fff;
        this.chunk.push(i16);
      }
    }
    if (this.chunk.length >= ${Math.floor(SAMPLE_RATE / 10)}) {
      const buf = new Int16Array(this.chunk).buffer;
      this.chunk = [];
      // Real RMS of this 100ms slice (0..1) for live voice visualisation.
      const samples = new Int16Array(buf);
      let sum = 0;
      for (let i = 0; i < samples.length; i++) {
        const v = samples[i] / 32768;
        sum += v * v;
      }
      const level = Math.sqrt(sum / samples.length);
      this.port.postMessage({ buffer: buf, level }, [buf]);
    }
    return true;
  }
}
registerProcessor("kissan-pcm-capture", KissanPcmCapture);
`;

/**
 * Encode raw Int16 PCM samples into a WAV Blob (16-bit, mono, 16 kHz).
 */
function encodeWav(samples: Int16Array): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = SAMPLE_RATE * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, headerSize + dataSize - 8, true);
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Copy PCM samples
  const pcmBytes = new Uint8Array(buffer, headerSize);
  pcmBytes.set(new Uint8Array(samples.buffer));

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Upload a WAV blob to the sarvam-stt Edge Function and return the transcript.
 */
async function uploadToSarvam(
  wavBlob: Blob,
  language: STTLanguageCode
): Promise<{ transcript: string; languageCode: string | null }> {
  const formData = new FormData();
  formData.append("file", wavBlob, "audio.wav");
  formData.append("language_code", language);
  formData.append("model", "saaras:v3");
  formData.append("mode", "transcribe");

  const { data, error } = await supabase.functions.invoke("sarvam-stt", {
    body: formData,
  });

  if (error) {
    // Supabase wraps the Edge Function response; extract the error message
    const msg =
      (data as { error?: string } | null)?.error ??
      (error instanceof Error ? error.message : null) ??
      "Voice recognition is temporarily unavailable. Please try again.";
    throw new Error(msg);
  }

  const result = data as {
    transcript?: string;
    language_code?: string | null;
    error?: string;
  } | null;

  if (result?.error) {
    throw new Error(result.error);
  }

  return {
    transcript: result?.transcript ?? "",
    languageCode: result?.language_code ?? null,
  };
}

/**
 * Start a recording session for the given language.
 * Resolves once mic access + AudioWorklet are ready. Throws a friendly Error
 * on permission denial / setup failure (caller shows it).
 *
 * Unlike the previous Speechmatics implementation, this does NOT stream audio
 * in real-time. Instead, it records locally and uploads on stop().
 */
export async function startSTT(
  language: STTLanguageCode,
  callbacks: STTCallbacks
): Promise<STTSession> {
  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let capture: AudioWorkletNode | null = null;
  let stopped = false;
  let cancelled = false;

  // Accumulate PCM chunks for WAV encoding on stop
  const pcmChunks: Int16Array[] = [];
  let totalSamples = 0;

  function teardown() {
    try {
      capture?.port.close();
    } catch {
      /* ignore */
    }
    try {
      capture?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      source?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      stream?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    try {
      void audioCtx?.close();
    } catch {
      /* ignore */
    }
    capture = null;
    source = null;
    stream = null;
    audioCtx = null;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
      },
    });
  } catch {
    throw new Error(
      "Microphone access is required for voice input. You can allow it in your browser settings or use text input instead."
    );
  }

  const AudioContextCtor: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  audioCtx = new AudioContextCtor();

  const blobUrl = URL.createObjectURL(
    new Blob([WORKLET_SOURCE], { type: "application/javascript" })
  );
  await audioCtx.audioWorklet.addModule(blobUrl);
  URL.revokeObjectURL(blobUrl);

  source = audioCtx.createMediaStreamSource(stream);
  capture = new AudioWorkletNode(audioCtx, "kissan-pcm-capture");
  source.connect(capture);
  capture.connect(audioCtx.destination); // keeps the graph running; emits no sound

  // Collect PCM chunks and mic levels
  capture.port.onmessage = (e) => {
    if (stopped || cancelled) return;
    const msg = e.data as { buffer?: ArrayBuffer; level?: number };
    if (msg && msg.buffer) {
      const chunk = new Int16Array(msg.buffer);
      pcmChunks.push(chunk);
      totalSamples += chunk.length;
      if (typeof msg.level === "number") callbacks.onLevel?.(msg.level);
    }
  };

  return {
    async stop() {
      if (stopped || cancelled) return;
      stopped = true;

      // Stop the microphone immediately.
      try {
        stream?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      try {
        source?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        capture?.port.close();
      } catch {
        /* ignore */
      }
      try {
        capture?.disconnect();
      } catch {
        /* ignore */
      }

      // Check for empty/very short recordings
      if (totalSamples < SAMPLE_RATE / 4) {
        // Less than 250ms of audio
        callbacks.onError(
          "We couldn't hear a clear question. Please try again or type it."
        );
        teardown();
        return;
      }

      try {
        // Merge all PCM chunks into a single Int16Array
        const merged = new Int16Array(totalSamples);
        let offset = 0;
        for (const chunk of pcmChunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }

        // Encode to WAV and upload
        const wavBlob = encodeWav(merged);
        const result = await uploadToSarvam(wavBlob, language);

        if (result.transcript) {
          callbacks.onFinal(result.transcript);
        } else {
          callbacks.onError(
            "We couldn't hear a clear question. Please try again or type it."
          );
        }
      } catch (err) {
        callbacks.onError(
          err instanceof Error
            ? err.message
            : "Voice recognition is temporarily unavailable. Please try again."
        );
      } finally {
        teardown();
      }
    },

    cancel() {
      cancelled = true;
      stopped = true;
      teardown();
    },
  };
}
