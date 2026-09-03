import { supabase } from "./supabase";

/**
 * Voice Assistant — Speech-to-Text.
 *
 * Uses Speechmatics' real-time WebSocket API (server-side key, never in the
 * browser). Flow:
 *   1. Ask the `speechmatics-token` Edge Function for a short-lived JWT
 *      (exchanges the server-side SPEECHMATICS_API_KEY for a 60s temp key).
 *   2. Open `wss://eu.rt.speechmatics.com/v2?jwt=<token>`.
 *   3. Stream raw PCM_S16LE @16 kHz mic audio (captured via AudioWorklet).
 *   4. Render `AddPartialTranscript` as live text and `AddTranscript` as the
 *      final, editable transcription.
 *
 * Language support is reported honestly: if the provider rejects a language,
 * we surface a friendly message instead of fabricating a transcription.
 */

export type STTLanguageCode = "en" | "ur" | "pa" | "skr";

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

const WSS_ENDPOINT = "wss://eu.rt.speechmatics.com/v2";
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

async function fetchRealtimeToken(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("speechmatics-token", {});
  if (error) {
    console.error("voice-stt: token request failed", error);
    throw new Error(
      "Voice recognition isn't set up yet. Try again later or type your question."
    );
  }
  const token = (data as { token?: string } | null)?.token;
  if (!token) {
    throw new Error(
      "Voice recognition isn't available right now. Try again or type your question."
    );
  }
  return token;
}

/** Translate a Speechmatics Error message into an honest, friendly message. */
function friendlyProviderError(msg: {
  type?: string;
  reason?: string;
  code?: number;
}): string | null {
  const raw = `${msg.type ?? ""} ${msg.reason ?? ""} ${msg.code ?? ""}`.toLowerCase();
  if (
    raw.includes("language") ||
    raw.includes("unsupported") ||
    raw.includes("invalid") ||
    raw.includes("not_supported") ||
    raw.includes("4004")
  ) {
    return "Voice recognition for this language isn't available on this device. You can type your question instead.";
  }
  return null;
}

/**
 * Start a real-time transcription session for the given language.
 * Resolves once mic access + WS are ready. Throws a friendly Error on
 * permission denial / connection failure (caller shows it).
 */
export async function startSTT(
  language: STTLanguageCode,
  callbacks: STTCallbacks
): Promise<STTSession> {
  const token = await fetchRealtimeToken();

  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let capture: AudioWorkletNode | null = null;
  let ws: WebSocket | null = null;
  let seqNo = 0;
  let stopped = false;

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
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
    capture = null;
    source = null;
    stream = null;
    audioCtx = null;
    ws = null;
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

  ws = new WebSocket(`${WSS_ENDPOINT}?jwt=${token}`);
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    ws?.send(
      JSON.stringify({
        message: "StartRecognition",
        audio_format: {
          type: "raw",
          encoding: "pcm_s16le",
          sample_rate: SAMPLE_RATE,
        },
        transcription_config: {
          language,
          max_delay: 2,
          enable_partials: true,
        },
      })
    );
    if (capture) {
      capture.port.onmessage = (e) => {
        if (stopped) return;
        const msg = e.data as { buffer?: ArrayBuffer; level?: number };
        if (msg && msg.buffer) {
          if (ws?.readyState === WebSocket.OPEN) ws.send(msg.buffer);
          if (typeof msg.level === "number") callbacks.onLevel?.(msg.level);
        }
      };
    }
  };

  interface RecognitionMessage {
    message?: string;
    seq_no?: number;
    metadata?: { transcript?: string };
    type?: string;
    reason?: string;
    code?: number;
  }

  ws.onmessage = (ev) => {
    let msg: RecognitionMessage | null = null;
    try {
      msg = JSON.parse(ev.data as string) as RecognitionMessage | null;
    } catch {
      return;
    }
    if (!msg || !msg.message) return;

    if (msg.message === "AudioAdded") {
      seqNo = msg.seq_no ?? seqNo;
      return;
    }
    if (msg.message === "AddPartialTranscript") {
      const t = msg.metadata?.transcript ?? "";
      if (t) callbacks.onPartial(t);
      return;
    }
    if (msg.message === "AddTranscript") {
      const t = msg.metadata?.transcript ?? "";
      if (t) callbacks.onFinal(t);
      return;
    }
    if (msg.message === "Error") {
      const friendly = friendlyProviderError(msg);
      callbacks.onError(
        friendly ??
          "The voice service ran into a problem. Please try again or type your question."
      );
      teardown();
    }
  };

  ws.onerror = () => {
    if (!stopped) {
      callbacks.onError(
        "We couldn't connect to the voice service. Please try again or type your question."
      );
    }
    teardown();
  };

  return {
    stop() {
      if (stopped) return;
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
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ message: "EndOfStream", last_seq_no: seqNo }));
      }
      // Keep the socket briefly open to receive the final transcript.
      window.setTimeout(() => {
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
        try {
          void audioCtx?.close();
        } catch {
          /* ignore */
        }
      }, 6000);
    },
    cancel() {
      stopped = true;
      teardown();
    },
  };
}