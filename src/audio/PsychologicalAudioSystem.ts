/**
 * Scopo: PsychologicalAudioSystem (Fase 2) — sintetizzatore audio per battito cardiaco,
 *        sussurri spettrali della Duat e ducking d'ansia.
 * Ownership: audio.
 */

export interface PsychologicalAudioController {
  update(bpm: number, paranoiaIntensity: number): void;
  playHeartbeatThud(ctx: AudioContext, destination: AudioNode): void;
  playWhisperEmanation(ctx: AudioContext, destination: AudioNode): void;
  dispose(): void;
}

export function createPsychologicalAudioController(): PsychologicalAudioController {
  return {
    update(bpm: number, paranoiaIntensity: number): void {
      void bpm;
      void paranoiaIntensity;
    },

    playHeartbeatThud(ctx: AudioContext, destination: AudioNode): void {
      if (ctx.state !== 'running') return;
      const t = ctx.currentTime;

      // Primo battito (grave, profondo a 55 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(58, t);
      osc1.frequency.exponentialRampToValueAtTime(32, t + 0.12);

      gain1.gain.setValueAtTime(0.35, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      osc1.connect(gain1);
      gain1.connect(destination);

      osc1.start(t);
      osc1.stop(t + 0.15);

      // Secondo battito (ravvicinato a +0.18s)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(52, t + 0.18);
      osc2.frequency.exponentialRampToValueAtTime(28, t + 0.28);

      gain2.gain.setValueAtTime(0.25, t + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.30);

      osc2.connect(gain2);
      gain2.connect(destination);

      osc2.start(t + 0.18);
      osc2.stop(t + 0.32);
    },

    playWhisperEmanation(ctx: AudioContext, destination: AudioNode): void {
      if (ctx.state !== 'running') return;
      const t = ctx.currentTime;

      // Filtro passa-banda su rumore per sussurro spettrale
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.linearRampToValueAtTime(140, t + 0.8);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, t);
      filter.Q.setValueAtTime(5.0, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(destination);

      osc.start(t);
      osc.stop(t + 0.9);
    },

    dispose(): void {
      // Cleanup risorse audio
    },
  };
}
