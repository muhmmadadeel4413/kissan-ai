class AudioProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];

    if (input && input[0] && input[0].length > 0) {
      const samples = new Float32Array(input[0]);

      this.port.postMessage(
        {
          type: "pcm",
          samples,
        },
        [samples.buffer]
      );
    }

    return true;
  }
}

registerProcessor("audio-processor", AudioProcessor);