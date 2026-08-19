/**
 * A-01: AudioWorklet processor per sintesi audio off-main-thread.
 *
 * Questo file gira nel AudioWorkletGlobalScope: ha accesso solo a
 * API audio di base — niente DOM, niente Three.js, niente Rapier.
 *
 * Protocollo messaggi (via port.postMessage):
 *   IN:  { type: 'PLAY', id, waveform, freqStart, freqEnd, duration,
 *           attack, release, gain, noise, noiseLowpass }
 *   IN:  { type: 'STOP', id }
 *   OUT: { type: 'ENDED', id }
 *
 * Sicurezza: nessun performance.now() — usiamo currentTime dal context.
 */

const SAMPLE_RATE = 48000; // assunto; il vero valore è sampleRate globale

class ProceduralSynthVoice {
  constructor(params, startTime, sampleRate) {
    this.id = params.id;
    this.startTime = startTime;
    this.sampleRate = sampleRate;

    this.freqStart = params.freqStart ?? 440;
    this.freqEnd   = params.freqEnd ?? this.freqStart;
    this.duration  = params.duration ?? 0.2;
    this.attack    = Math.max(0.001, params.attack ?? 0.01);
    this.release   = Math.max(0.001, params.release ?? 0.1);
    this.gainPeak  = params.gain ?? 0.1;
    this.waveform  = params.waveform ?? 'sine';
    this.useNoise  = params.noise ?? false;
    this.noiseLp   = params.noiseLowpass ?? 1200; // Hz

    this.phase     = 0;
    this.done      = false;

    // Biquad LP per il rumore
    this._lpZ1 = 0;
    this._lpZ2 = 0;
    this._lpA0 = 1; this._lpA1 = 0; this._lpA2 = 0;
    this._lpB1 = 0; this._lpB2 = 0;

    if (this.useNoise) this._computeLPCoeffs(this.noiseLp);
  }

  // Coefficienti biquad LP (2° ordine, Butterworth approssimato)
  _computeLPCoeffs(cutoffHz) {
    const sr = this.sampleRate;
    const f  = Math.tan(Math.PI * cutoffHz / sr);
    const q  = 0.7071;
    const norm = 1 / (1 + f / q + f * f);
    this._lpA0 = f * f * norm;
    this._lpA1 = 2 * this._lpA0;
    this._lpA2 = this._lpA0;
    this._lpB1 = 2 * (f * f - 1) * norm;
    this._lpB2 = (1 - f / q + f * f) * norm;
  }

  _filterLP(x) {
    const y = this._lpA0 * x + this._lpA1 * this._lpZ1 + this._lpA2 * this._lpZ2
              - this._lpB1 * this._lpZ1 - this._lpB2 * this._lpZ2;
    // Shift dei valori ritardati (senza allocazione array)
    this._lpZ2 = this._lpZ1;
    this._lpZ1 = y;
    return y;
  }

  // Genera un campione; restituisce 0 e imposta done=true se terminato
  nextSample(currentTime) {
    const t = currentTime - this.startTime;
    if (t < 0) return 0;
    if (t >= this.duration) {
      this.done = true;
      return 0;
    }

    // Envelope ADSR semplificato (solo A + sustain + R)
    let env;
    if (t < this.attack) {
      env = t / this.attack;
    } else if (t > this.duration - this.release) {
      env = Math.max(0, (this.duration - t) / this.release);
    } else {
      env = 1.0;
    }

    // Frequenza con interpolazione lineare
    const tNorm  = Math.min(1, t / this.duration);
    const freq   = this.freqStart + (this.freqEnd - this.freqStart) * tNorm;
    const phaseInc = (2 * Math.PI * freq) / this.sampleRate;

    let osc;
    if (this.useNoise) {
      // Rumore bianco → filtro LP
      const white = Math.random() * 2 - 1;
      osc = this._filterLP(white);
    } else {
      switch (this.waveform) {
        case 'square':
          osc = this.phase < Math.PI ? 1 : -1;
          break;
        case 'sawtooth':
          osc = 1 - (this.phase / Math.PI);
          break;
        case 'triangle':
          osc = this.phase < Math.PI
            ? -1 + (2 * this.phase / Math.PI)
            :  3 - (2 * this.phase / Math.PI);
          break;
        default: // 'sine'
          osc = Math.sin(this.phase);
      }
      this.phase = (this.phase + phaseInc) % (2 * Math.PI);
    }

    return osc * env * this.gainPeak;
  }
}

class ProceduralSynthProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._voices = new Map(); // id → ProceduralSynthVoice
    this._port = this.port;

    this._port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'PLAY') {
        const voice = new ProceduralSynthVoice(
          msg,
          currentTime,
          sampleRate,
        );
        this._voices.set(msg.id, voice);
      } else if (msg.type === 'STOP') {
        this._voices.delete(msg.id);
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const channel = output[0];
    if (!channel) return true;

    const bufferSize = channel.length;

    for (let i = 0; i < bufferSize; i++) {
      let sample = 0;
      // currentTime avanza sample per sample
      const t = currentTime + i / sampleRate;

      const toRemove = [];
      for (const [id, voice] of this._voices) {
        sample += voice.nextSample(t);
        if (voice.done) toRemove.push(id);
      }

      // Soft clipping (tanh) per prevenire distorsione digitale dura
      channel[i] = Math.tanh(sample);

      for (const id of toRemove) {
        this._voices.delete(id);
        this._port.postMessage({ type: 'ENDED', id });
      }
    }

    // Copia mono → tutti i canali output (stereo)
    for (let c = 1; c < output.length; c++) {
      const ch = output[c];
      if (ch) ch.set(channel);
    }

    return true; // mantieni il processor attivo
  }
}

registerProcessor('procedural-synth', ProceduralSynthProcessor);
