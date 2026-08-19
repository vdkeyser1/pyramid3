/**
 * W-4: Macchina a stati per la musica adattiva estesa.
 *
 * Gestisce 6 stati (MENU/EXPLORE/TENSION/COMBAT/BOSS/VICTORY/SILENT) con
 * crossfade di 2s. Se i file OGG Kevin MacLeod sono presenti in /audio/music/,
 * li usa; altrimenti fa fallback al sistema procedurale di AudioEngine
 * (EXPLORE/TENSION/COMBAT) che è sempre disponibile.
 *
 * Integrazione: creare con `createMusicStateMachine(audioEngine)` dopo unlock().
 * Chiamare `transition(state)` ogni frame (è no-op se lo stato non cambia).
 * Chiamare `dispose()` a cleanup per stoppare i nodi Web Audio.
 *
 * Ownership: audio. Nessuna dipendenza da Three.js o contenuto di gioco.
 */

import type { AudioEngine } from '@/audio/WebAudioEngine.js';
import type { MusicState as ProceduralState } from '@/audio/MusicPreset.js';

export type ExtendedMusicState =
  | 'MENU'
  | 'EXPLORE'
  | 'TENSION'
  | 'COMBAT'
  | 'BOSS'
  | 'VICTORY'
  | 'SILENT';

interface TrackDef {
  readonly url: string;
  readonly volume: number;
  /** Stato procedurale di fallback se il file OGG manca. */
  readonly proceduralFallback: ProceduralState;
}

const TRACKS: Record<ExtendedMusicState, TrackDef | null> = {
  MENU:    { url: '/audio/music/menu_oppressive_gloom.ogg',  volume: 0.40, proceduralFallback: 'EXPLORE' },
  EXPLORE: { url: '/audio/music/explore_sands_of_time.ogg',  volume: 0.35, proceduralFallback: 'EXPLORE' },
  TENSION: { url: '/audio/music/explore_desert_city.ogg',    volume: 0.38, proceduralFallback: 'TENSION' },
  COMBAT:  { url: '/audio/music/combat_clash_defiant.ogg',   volume: 0.60, proceduralFallback: 'COMBAT'  },
  BOSS:    { url: '/audio/music/boss_killers.ogg',            volume: 0.70, proceduralFallback: 'COMBAT'  },
  VICTORY: { url: '/audio/music/explore_desert_city.ogg',    volume: 0.40, proceduralFallback: 'EXPLORE' },
  SILENT:  null,
};

const CROSSFADE_S = 2.0;

interface ActiveTrack {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export interface MusicStateMachine {
  transition(newState: ExtendedMusicState): void;
  currentState(): ExtendedMusicState;
  dispose(): void;
}

export function createMusicStateMachine(
  audioEngine: AudioEngine,
  ctx: AudioContext,
): MusicStateMachine {
  let state: ExtendedMusicState = 'SILENT';
  let current: ActiveTrack | null = null;
  let disposed = false;

  // Cache dei buffer OGG già decodificati.
  const bufferCache = new Map<string, AudioBuffer>();

  async function loadBuffer(url: string): Promise<AudioBuffer | null> {
    const cached = bufferCache.get(url);
    if (cached) return cached;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr);
      bufferCache.set(url, buf);
      return buf;
    } catch {
      return null;
    }
  }

  function fadeOutCurrent(): void {
    if (!current) return;
    const { gain, source } = current;
    current = null;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + CROSSFADE_S);
    setTimeout(() => {
      try { source.stop(); } catch { /* già fermato */ }
    }, (CROSSFADE_S + 0.1) * 1000);
  }

  async function startTrack(def: TrackDef): Promise<void> {
    const buf = await loadBuffer(def.url);
    if (disposed || !buf) return;
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(def.volume, ctx.currentTime + CROSSFADE_S);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    current = { source, gain };
  }

  return {
    transition(newState: ExtendedMusicState): void {
      if (newState === state || disposed) return;
      state = newState;

      const def = TRACKS[newState];

      // Fade out traccia corrente.
      fadeOutCurrent();

      // Se SILENT o nessuna traccia: deleghiamo al procedurale di fallback.
      if (!def) {
        audioEngine.setMusicState('EXPLORE');
        return;
      }

      // Tenta di caricare OGG in background.
      void startTrack(def).then(() => {
        // Se il buffer non è stato caricato (file mancante), usa il fallback.
        if (!current && !disposed) {
          audioEngine.setMusicState(def.proceduralFallback);
        }
      });
    },

    currentState(): ExtendedMusicState {
      return state;
    },

    dispose(): void {
      disposed = true;
      fadeOutCurrent();
      bufferCache.clear();
    },
  };
}
