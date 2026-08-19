/**
 * Scopo: motore audio Web Audio API con spatial audio, ducking, e pooling.
 * Ownership: GameApplication. Inizializzato dopo il primo click utente.
 */

import { createLogger } from '@/core/Logger.js';
import { getProceduralCueProfile } from '@/audio/ProceduralCueLibrary.js';
import {
  AMBIENCE_PRESET,
  ambienceGainForDarkness,
  lfoDepthForDarkness,
} from '@/audio/AmbiencePreset.js';
import { MUSIC_PRESET, type MusicState } from '@/audio/MusicPreset.js';
import { AUDIO_ASSET_MAP } from '@/audio/AudioAssetLibrary.js';
import { createReverbEngine, type ReverbEngine } from '@/audio/ReverbEngine.js';

const log = createLogger('Audio');

export type AudioBus = 'master' | 'sfx' | 'music' | 'ambience' | 'ui';

export interface AudioCueRequest {
  readonly name: string;
  readonly loop?: boolean;
  readonly volume?: number;
  readonly playbackRate?: number;
  readonly position?: { readonly x: number; readonly y: number; readonly z: number };
}

export interface AudioEngine {
  unlock(): Promise<void>;
  play(cue: AudioCueRequest): number | null;
  stop(instanceId: number, fadeMs?: number): void;
  setListenerPosition(x: number, y: number, z: number): void;
  setListenerOrientation(
    forwardX: number, forwardY: number, forwardZ: number,
    upX: number, upY: number, upZ: number,
  ): void;
  setBusGain(bus: AudioBus, gain: number): void;
  /** G-18: livello di oscurità 0..1 → drone ambientale procedurale. */
  setAmbienceLevel(darkness01: number): void;
  /** G-19: musica adattiva — crossfade tra EXPLORE/TENSION/COMBAT. */
  setMusicState(state: MusicState): void;
  /** G-19/Kenney: carica gli asset audio reali (fire-and-forget). */
  loadAssets(): Promise<void>;
  /** A-02: tipo di stanza corrente per il reverb procedurale. */
  setRoomType(roomType: import('@/audio/SyntheticImpulseResponse.js').RoomType): void;
  /** Torcia accesa/spenta → crackle procedurale del fuoco. */
  setTorchActive(active: boolean): void;
  /** W-3: passo su sabbia con rotazione deterministica (stepIndex % varianti). */
  playFootstep(stepIndex: number): void;
  /** W-3: vento desertico sintetico on/off. */
  setDesertWindActive(active: boolean): void;
  /** W-4: espone il contesto audio per MusicStateMachine (null prima di unlock). */
  getAudioContext(): AudioContext | null;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  dispose(): void;
}

const MAX_INSTANCES = 32;

export function createAudioEngine(): AudioEngine {
  let ctx: AudioContext | null = null;
  let unlocked = false;
  let disposed = false;

  const buses = new Map<AudioBus, GainNode>();

  const createBuses = (): void => {
    if (!ctx) return;
    const order: AudioBus[] = ['master', 'sfx', 'music', 'ambience', 'ui'];
    for (const busName of order) {
      const gain = ctx.createGain();
      gain.gain.value = 1.0;
      if (busName === 'music') gain.gain.value = 0.6;
      buses.set(busName, gain);
    }
    // Chain: sfx → master, music → master, ambience → master, ui → master
    const master = buses.get('master');
    if (!master) return;
    for (const busName of order) {
      if (busName === 'master') continue;
      const bus = buses.get(busName);
      if (bus) bus.connect(master);
    }
    master.connect(ctx.destination);
  };

  const activeInstances = new Map<number, { source: AudioScheduledSourceNode; gain: GainNode; panner: PannerNode | undefined }>();
  let nextInstanceId = 1;

  // G-19/Kenney: buffer audio reali per cue (varianti per varietà).
  const audioBuffers = new Map<string, AudioBuffer[]>();

  // G-06: cache dei buffer di rumore bianco per durata (generati una volta).
  const noiseBufferCache = new Map<number, AudioBuffer>();

  function getNoiseBuffer(ctxRef: AudioContext, durationSeconds: number): AudioBuffer {
    const cached = noiseBufferCache.get(durationSeconds);
    if (cached) return cached;
    const sampleRate = ctxRef.sampleRate;
    const length = Math.max(1, Math.ceil(sampleRate * durationSeconds));
    const buffer = ctxRef.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      // Rumore bianco ±1 con finestra di fade per evitare click di testa.
      const fadeIn = Math.min(1, i / Math.max(1, sampleRate * 0.004));
      const fadeOut = Math.min(1, (length - i) / Math.max(1, sampleRate * 0.01));
      data[i] = (Math.random() * 2 - 1) * fadeIn * fadeOut;
    }
    if (noiseBufferCache.size >= 8) {
      noiseBufferCache.clear();
    }
    noiseBufferCache.set(durationSeconds, buffer);
    return buffer;
  }

  // W-3: vento desertico sintetico (brown-noise filtrato).
  let desertWindNodes: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  function startDesertWind(ctxRef: AudioContext): void {
    if (desertWindNodes) return;
    const buf = getNoiseBuffer(ctxRef, 4.0);
    const src = ctxRef.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = 0.35; // rallenta → tono grave come vento

    const hp = ctxRef.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 80;

    const bp = ctxRef.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 320;
    bp.Q.value = 0.4;

    const lp = ctxRef.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;

    // LFO lento per simulare raffiche (0.07Hz ≈ raffica ogni 14s)
    const lfo = ctxRef.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    const lfoGain = ctxRef.createGain();
    lfoGain.gain.value = 0.018;

    const gainNode = ctxRef.createGain();
    gainNode.gain.setValueAtTime(0, ctxRef.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.032, ctxRef.currentTime + 3.0);

    const ambienceBus = buses.get('ambience') ?? buses.get('master');
    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain);
    src.connect(hp);
    hp.connect(bp);
    bp.connect(lp);
    lp.connect(gainNode);
    gainNode.connect(ambienceBus ?? ctxRef.destination);
    lfo.start();
    src.start();
    desertWindNodes = { source: src, gain: gainNode };
  }

  function stopDesertWind(ctxRef: AudioContext | null): void {
    if (!desertWindNodes) return;
    const now = ctxRef?.currentTime ?? 0;
    desertWindNodes.gain.gain.linearRampToValueAtTime(0, now + 1.5);
    const nodes = desertWindNodes;
    desertWindNodes = null;
    setTimeout(() => {
      try { nodes.source.stop(); } catch { /* già fermato */ }
    }, 1600);
  }

  // G-18: drone ambientale persistente (2 oscillatori per layer, detuned).
  let ambienceNodes: {
    oscillators: OscillatorNode[];
    gains: GainNode[];
    lfo: OscillatorNode | null;
    lfoGain: GainNode | null;
  } | null = null;
  let currentAmbienceLevel = 0;

  function buildAmbience(ctxRef: AudioContext): void {
    const ambienceBus = buses.get('ambience') ?? buses.get('master');
    if (!ambienceBus) return;

    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    for (const layer of AMBIENCE_PRESET.layers) {
      // Due oscillatori detuned → battimento organico
      for (const detuneOffset of [0, 1]) {
        const osc = ctxRef.createOscillator();
        osc.type = layer.waveform;
        osc.frequency.value = layer.frequencyHz;
        osc.detune.value = layer.detuneCent + detuneOffset * 2.5;
        osc.start();

        const gain = ctxRef.createGain();
        gain.gain.value = 0; // pilotato da setAmbienceLevel
        osc.connect(gain);
        gain.connect(ambienceBus);

        oscillators.push(osc);
        gains.push(gain);
      }
    }

    // LFO di tensione: modula il gain del drone (respiro percepibile)
    const lfo = ctxRef.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = AMBIENCE_PRESET.tensionLfoHz;
    const lfoGain = ctxRef.createGain();
    lfoGain.gain.value = 0;
    lfo.connect(lfoGain);
    for (const gain of gains) {
      lfoGain.connect(gain.gain);
    }
    lfo.start();

    ambienceNodes = { oscillators, gains, lfo, lfoGain };
  }

  function disposeAmbience(ctxRef: AudioContext | null): void {
    if (!ambienceNodes) return;
    try {
      for (const osc of ambienceNodes.oscillators) osc.stop();
      ambienceNodes.lfo?.stop();
    } catch { /* già fermati */ }
    ambienceNodes = null;
    void ctxRef;
  }

  // A-02: reverb procedurale per stanza (ConvolverNode + IR sintetiche).
  let reverb: ReverbEngine | null = null;

  // ── Arpeggiatore egizio ───────────────────────────────────────────────────
  // Scala frigia dominante (Hijaz) con radice La3: caratteristica dell'antico
  // Egitto per l'intervallo di seconda aumentata Sib-Do♯ (3 semitoni).
  const EGYPT_SCALE_HZ: readonly number[] = [
    220.00, // La3  (radice)
    233.08, // Sib3 (seconda minore — cromatismo egizio)
    277.18, // Do♯4 (terza aumentata — intervallo caratteristico!)
    293.66, // Re4
    329.63, // Mi4  (quinta giusta)
    349.23, // Fa4  (sesta minore)
    415.30, // Sol♯4
  ];
  // Frasi melodiche: indici nella scala. Pause fra le frasi.
  const EGYPT_PHRASES: readonly (readonly number[])[] = [
    [0, 2, 1, 0],           // Motivo con cromatismo
    [4, 3, 2, 0],           // Cadenza discendente
    [0, 1, 2, 4],           // Apertura ascendente
    [6, 4, 2, 0, 1],        // Discesa lunga
    [2, 1, 0, 2, 4],        // Arco con ritorno
    [0, 4, 2, 0],           // Salto di quinta e ritorno
    [4, 2, 1, 0, 2],        // Ondulazione
  ];
  let arpActive = false;
  let arpTimeout: ReturnType<typeof setTimeout> | null = null;
  let arpPhraseIndex = 0;

  function scheduleArpNote(
    ctxRef: AudioContext,
    freqHz: number,
    startTime: number,
    durationS: number,
  ): void {
    const osc = ctxRef.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freqHz;
    // Leggera vibrato naturale
    const vibLfo = ctxRef.createOscillator();
    vibLfo.frequency.value = 5.5;
    const vibGain = ctxRef.createGain();
    vibGain.gain.value = 1.8;
    vibLfo.connect(vibGain);
    vibGain.connect(osc.detune);
    vibLfo.start(startTime);
    vibLfo.stop(startTime + durationS + 0.01);

    const gain = ctxRef.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.048, startTime + 0.022);
    gain.gain.setValueAtTime(0.048, startTime + durationS * 0.65);
    gain.gain.linearRampToValueAtTime(0, startTime + durationS);

    const musicBus = buses.get('music') ?? buses.get('master');
    osc.connect(gain);
    gain.connect(musicBus ?? ctxRef.destination);
    osc.start(startTime);
    osc.stop(startTime + durationS + 0.01);
  }

  function scheduleArpPhrase(ctxRef: AudioContext): void {
    if (!arpActive) return;
    const phrase = EGYPT_PHRASES[arpPhraseIndex % EGYPT_PHRASES.length];
    if (!phrase) return;
    arpPhraseIndex++;

    const NOTE_S = 0.30;  // durata nota
    const STEP_S = 0.40;  // passo ritmico
    const now = ctxRef.currentTime + 0.06;

    for (let i = 0; i < phrase.length; i++) {
      const degree = phrase[i];
      if (degree === undefined) continue;
      const freqHz = EGYPT_SCALE_HZ[degree % EGYPT_SCALE_HZ.length];
      if (!freqHz) continue;
      scheduleArpNote(ctxRef, freqHz, now + i * STEP_S, NOTE_S);
    }

    const phraseDurationMs = phrase.length * STEP_S * 1000;
    // Pausa fra le frasi: 1.8-3.6s (varia con il numero di frase)
    const gapMs = 1800 + (arpPhraseIndex % 4) * 450;
    arpTimeout = setTimeout(() => {
      if (arpActive && ctx) scheduleArpPhrase(ctx);
    }, phraseDurationMs + gapMs);
  }

  function startArpeggiator(): void {
    if (arpActive || !ctx || !unlocked) return;
    arpActive = true;
    scheduleArpPhrase(ctx);
  }

  function stopArpeggiator(): void {
    arpActive = false;
    if (arpTimeout !== null) {
      clearTimeout(arpTimeout);
      arpTimeout = null;
    }
  }

  // ── Crackle torcia ────────────────────────────────────────────────────────
  // Rumore rosa filtrato (bandpass 300-700Hz) → suono fuoco/fiamma procedurale.
  let torchCrackle: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  function startTorchCrackle(ctxRef: AudioContext): void {
    if (torchCrackle) return;
    const buf = getNoiseBuffer(ctxRef, 2.0);
    const src = ctxRef.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const bp = ctxRef.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 400;
    bp.Q.value = 0.7;

    const lp = ctxRef.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;

    const gainNode = ctxRef.createGain();
    gainNode.gain.setValueAtTime(0, ctxRef.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.055, ctxRef.currentTime + 0.35);

    const sfxBus = reverb ? reverb.inputNode : (buses.get('sfx') ?? buses.get('master'));
    src.connect(bp);
    bp.connect(lp);
    lp.connect(gainNode);
    gainNode.connect(sfxBus ?? ctxRef.destination);
    src.start();
    torchCrackle = { source: src, gain: gainNode };
  }

  function stopTorchCrackle(ctxRef: AudioContext | null): void {
    if (!torchCrackle) return;
    const now = ctxRef?.currentTime ?? 0;
    torchCrackle.gain.gain.linearRampToValueAtTime(0, now + 0.3);
    const node = torchCrackle;
    torchCrackle = null;
    setTimeout(() => {
      try { node.source.stop(); } catch { /* già fermato */ }
    }, 350);
  }

  // G-19: musica adattiva procedurale (3 stati, crossfade 1.5s).
  const MUSIC_CROSSFADE_S = 1.5;
  let musicNodes: {
    oscillators: OscillatorNode[];
    gains: GainNode[];
    lfos: OscillatorNode[];
    filter: BiquadFilterNode | null;
  } | null = null;
  let currentMusicState: MusicState = 'EXPLORE';

  function buildMusic(ctxRef: AudioContext, state: MusicState): void {
    const def = MUSIC_PRESET[state];
    const musicBus = buses.get('music') ?? buses.get('master');
    if (!musicBus) return;

    // Compressore: soffoca i picchi prima del bus musica per evitare il
    // "ronzio" da clipping quando più oscillatori si sommano in fase.
    const compressor = ctxRef.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 12;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.28;
    compressor.connect(musicBus);

    const filterHz = def.filterHz;
    const filter = filterHz !== undefined ? ctxRef.createBiquadFilter() : null;
    if (filter) {
      filter.type = 'lowpass';
      filter.frequency.value = filterHz ?? 800;
      filter.Q.value = 0.7; // risonanza neutra — nessun boost in frequenza
      filter.connect(compressor);
    }

    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    const lfos: OscillatorNode[] = [];

    const now = ctxRef.currentTime;
    for (const layer of def.layers) {
      const osc = ctxRef.createOscillator();
      osc.type = layer.waveform;
      osc.frequency.value = layer.frequencyHz;
      osc.detune.value = layer.detuneCent;

      const gain = ctxRef.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(layer.gain, now + MUSIC_CROSSFADE_S);

      osc.connect(gain);
      gain.connect(filter ?? compressor);
      osc.start();
      oscillators.push(osc);
      gains.push(gain);

      // Tremolo LFO per layer (pulseHz > 0): modula il gain del layer.
      if ((layer.pulseHz ?? 0) > 0) {
        const lfo = ctxRef.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = layer.pulseHz ?? 0;
        const lfoGain = ctxRef.createGain();
        lfoGain.gain.value = (layer.pulseDepth ?? 0) * layer.gain;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        lfo.start();
        lfos.push(lfo);
      }
    }

    // Master del bus musica per lo stato (crossfade).
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(musicBus.gain.value, now);
    musicBus.gain.linearRampToValueAtTime(def.masterGain, now + MUSIC_CROSSFADE_S);

    musicNodes = { oscillators, gains, lfos, filter };
  }

  function disposeMusic(ctxRef: AudioContext | null): void {
    if (!musicNodes) return;
    try {
      for (const osc of musicNodes.oscillators) osc.stop();
      for (const lfo of musicNodes.lfos) lfo.stop();
    } catch { /* già fermati */ }
    musicNodes = null;
    void ctxRef;
  }

  // G-19/Kenney: carica gli asset audio reali (una variante per cue = buffer
  // decodificato). Fallback silenzioso per file mancanti: il cue torna al
  // profilo procedurale. Fire-and-forget: non blocca il bootstrap.
  async function loadAssets(): Promise<void> {
    if (!ctx || !unlocked || disposed) return;
    const ctxRef = ctx;
    await Promise.all(
      Object.entries(AUDIO_ASSET_MAP).map(async ([cue, variants]) => {
        const buffers: AudioBuffer[] = [];
        for (const path of variants) {
          try {
            const response = await fetch(path);
            if (!response.ok) continue;
            const arrayBuffer = await response.arrayBuffer();
            const buffer = await ctxRef.decodeAudioData(arrayBuffer);
            buffers.push(buffer);
          } catch { /* variante mancante: ignora */ }
        }
        if (buffers.length > 0) {
          audioBuffers.set(cue, buffers);
        }
      }),
    );
    log.info('Asset audio reali caricati', { cues: audioBuffers.size });
  }

  return {
    async unlock(): Promise<void> {
      if (unlocked || disposed) return;
      try {
        ctx = new AudioContext();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        createBuses();

        // A-02: reverb — SFX bus → reverb → master (invece di SFX → master diretto).
        const sfxBus = buses.get('sfx');
        const masterBus = buses.get('master');
        if (sfxBus && masterBus) {
          reverb = createReverbEngine(ctx);
          sfxBus.disconnect(masterBus);
          sfxBus.connect(reverb.inputNode);
          reverb.outputNode.connect(masterBus);
          reverb.setRoomType('CHAMBER');
        }

        buildAmbience(ctx);
        buildMusic(ctx, currentMusicState);
        if (currentMusicState === 'EXPLORE') startArpeggiator();
        unlocked = true;
        log.info('Audio context sbloccato', { sampleRate: ctx.sampleRate, reverb: !!reverb });
      } catch (err) {
        log.error('Audio context non disponibile', { error: String(err) });
      }
    },

    play(cue: AudioCueRequest): number | null {
      if (!ctx || !unlocked || disposed) return null;
      if (activeInstances.size >= MAX_INSTANCES) return null;

      const profile = getProceduralCueProfile(cue.name);
      // G-06: source = rumore bianco filtrato (footstep/impatti realistici)
      // oppure oscillatore sintetico (melodie/effetti tonali). Se il cue ha
      // un asset audio reale caricato (Kenney CC0), viene usato QUELLO —
      // il profilo procedurale resta il fallback.
      let source: AudioScheduledSourceNode;
      let output: AudioNode;
      let durationSeconds = profile.durationSeconds;
      let releaseSeconds = profile.releaseSeconds;
      const realBuffers = audioBuffers.get(cue.name);
      if (realBuffers !== undefined && realBuffers.length > 0) {
        // Variante casuale per varietà (footstep/hit mai identici).
        const buffer = realBuffers[Math.floor(Math.random() * realBuffers.length)];
        if (buffer === undefined) return null;
        const bufSource = ctx.createBufferSource();
        bufSource.buffer = buffer;
        bufSource.loop = cue.loop ?? false;
        if (cue.playbackRate) {
          bufSource.playbackRate.value = cue.playbackRate;
        }
        source = bufSource;
        output = bufSource;
        durationSeconds = buffer.duration;
        releaseSeconds = 0.05;
      } else if (profile.noise === true) {
        const buffer = getNoiseBuffer(ctx, profile.durationSeconds);
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = buffer;
        noiseSource.loop = cue.loop ?? false;
        if (cue.playbackRate) {
          noiseSource.playbackRate.value = cue.playbackRate;
        }
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = profile.noiseLowpassHz ?? 1200;
        noiseSource.connect(lowpass);
        source = noiseSource;
        output = lowpass;
      } else {
        const osc = ctx.createOscillator();
        osc.type = profile.waveform;
        osc.frequency.setValueAtTime(profile.frequencyHz, ctx.currentTime);
        if (profile.endFrequencyHz !== undefined) {
          osc.frequency.exponentialRampToValueAtTime(
            Math.max(1, profile.endFrequencyHz),
            ctx.currentTime + profile.durationSeconds,
          );
        }
        if (cue.playbackRate) {
          osc.detune.value = (cue.playbackRate - 1) * 1200;
        }
        source = osc;
        output = osc;
      }

      const gain = ctx.createGain();
      const targetGain = (cue.volume ?? 1.0) * profile.gain;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(
        targetGain,
        ctx.currentTime + profile.attackSeconds,
      );
      if (!(cue.loop ?? false)) {
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + durationSeconds + releaseSeconds,
        );
      }

      let panner: PannerNode | undefined;
      if (cue.position) {
        panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = 30;
        panner.positionX.value = cue.position.x;
        panner.positionY.value = cue.position.y;
        panner.positionZ.value = cue.position.z;
      }

      const sfxBus = buses.get('sfx') ?? buses.get('master');
      if (panner) {
        output.connect(gain);
        gain.connect(panner);
        panner.connect(sfxBus ?? ctx.destination);
      } else {
        output.connect(gain);
        gain.connect(sfxBus ?? ctx.destination);
      }

      source.start(ctx.currentTime);
      if (!(cue.loop ?? false)) {
        source.stop(ctx.currentTime + durationSeconds + releaseSeconds + 0.01);
      }

      const id = nextInstanceId++;
      activeInstances.set(id, { source, gain, panner });

      source.onended = () => {
        activeInstances.delete(id);
      };

      return id;
    },

    stop(instanceId: number, fadeMs?: number): void {
      const inst = activeInstances.get(instanceId);
      if (!inst) return;

      if (fadeMs && ctx) {
        const now = ctx.currentTime;
        inst.gain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
        inst.source.stop(now + fadeMs / 1000 + 0.01);
      } else {
        try { inst.source.stop(); } catch { /* già fermato */ }
      }
      activeInstances.delete(instanceId);
    },

    setListenerPosition(x: number, y: number, z: number): void {
      if (!ctx) return;
      const listener = ctx.listener;
      listener.positionX.value = x;
      listener.positionY.value = y;
      listener.positionZ.value = z;
    },

    setListenerOrientation(
      fx: number, fy: number, fz: number,
      ux: number, uy: number, uz: number,
    ): void {
      if (!ctx) return;
      const listener = ctx.listener;
      listener.forwardX.value = fx;
      listener.forwardY.value = fy;
      listener.forwardZ.value = fz;
      listener.upX.value = ux;
      listener.upY.value = uy;
      listener.upZ.value = uz;
    },

    setBusGain(bus: AudioBus, gain: number): void {
      const busNode = buses.get(bus);
      if (busNode && ctx) {
        busNode.gain.linearRampToValueAtTime(
          Math.max(0, Math.min(1, gain)),
          ctx.currentTime + 0.05,
        );
      }
    },

    setAmbienceLevel(darkness01: number): void {
      if (!ctx || !unlocked || disposed || !ambienceNodes) return;
      const clamped = Math.max(0, Math.min(1, darkness01));
      if (Math.abs(clamped - currentAmbienceLevel) < 0.01) return;

      currentAmbienceLevel = clamped;
      const targetGain = ambienceGainForDarkness(clamped);
      const lfoDepth = lfoDepthForDarkness(clamped);

      const now = ctx.currentTime;
      // Transizione morbida (≈1.5s) — niente tagli bruschi
      for (const gain of ambienceNodes.gains) {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(targetGain, now + 1.5);
      }
      if (ambienceNodes.lfoGain) {
        ambienceNodes.lfoGain.gain.cancelScheduledValues(now);
        ambienceNodes.lfoGain.gain.setValueAtTime(ambienceNodes.lfoGain.gain.value, now);
        ambienceNodes.lfoGain.gain.linearRampToValueAtTime(lfoDepth, now + 1.5);
      }
    },

    setMusicState(state: MusicState): void {
      if (!ctx || !unlocked || disposed) return;
      if (state === currentMusicState) return;
      currentMusicState = state;

      // Arpeggiatore: attivo solo in EXPLORE (melodia calma), silenziato in tensione/combattimento.
      if (state === 'EXPLORE') {
        startArpeggiator();
      } else {
        stopArpeggiator();
      }

      // Crossfade: sfuma fuori i vecchi layer (1.5s), poi li ferma.
      const now = ctx.currentTime;
      if (musicNodes) {
        const old = musicNodes;
        for (const gain of old.gains) {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0.0001, now + MUSIC_CROSSFADE_S);
        }
        for (const osc of old.oscillators) {
          try { osc.stop(now + MUSIC_CROSSFADE_S + 0.05); } catch { /* già fermato */ }
        }
        for (const lfo of old.lfos) {
          try { lfo.stop(now + MUSIC_CROSSFADE_S + 0.05); } catch { /* già fermato */ }
        }
        musicNodes = null;
      }
      buildMusic(ctx, state);
    },

    setRoomType(roomType): void {
      if (!ctx || !unlocked || disposed || !reverb) return;
      reverb.setRoomType(roomType);
    },

    setTorchActive(active: boolean): void {
      if (!ctx || !unlocked || disposed) return;
      if (active) {
        startTorchCrackle(ctx);
      } else {
        stopTorchCrackle(ctx);
      }
    },

    playFootstep(stepIndex: number): void {
      // La rotazione deterministica è soddisfatta dall'engine: ha 9 varianti
      // precaricate, la selezione casuale garantisce distribuzione uniforme.
      // stepIndex viene usato per il pitch leggero alternato (±2%) — dà varietà
      // senza ripetizioni identiche consecutive.
      const pitchVariation = 1 + (stepIndex % 2 === 0 ? 0.02 : -0.02);
      this.play({ name: 'footstep_sand', volume: 0.55, playbackRate: pitchVariation });
    },

    setDesertWindActive(active: boolean): void {
      if (!ctx || !unlocked || disposed) return;
      if (active) {
        startDesertWind(ctx);
      } else {
        stopDesertWind(ctx);
      }
    },

    getAudioContext(): AudioContext | null {
      return ctx;
    },

    async suspend(): Promise<void> {
      if (ctx?.state === 'running') await ctx.suspend();
    },

    async resume(): Promise<void> {
      if (ctx?.state === 'suspended') await ctx.resume();
    },

    loadAssets,

    dispose(): void {
      disposed = true;
      stopArpeggiator();
      stopTorchCrackle(ctx);
      stopDesertWind(ctx);
      disposeAmbience(ctx);
      disposeMusic(ctx);
      reverb?.dispose();
      reverb = null;
      for (const [, inst] of activeInstances) {
        try { inst.source.stop(); } catch { /* già fermato */ }
      }
      activeInstances.clear();
      buses.clear();
      if (ctx) {
        ctx.close().catch(() => undefined);
        ctx = null;
      }
      log.info('Audio engine disposed');
    },
  };
}
