/**
 * Scopo: mappare eventi runtime a cue audio sintetici e indicatori testuali.
 * Ownership: GameApplication consuma il risultato e decide come mostrarlo.
 */

import type { AudioCueRequest } from '@/audio/WebAudioEngine.js';
import type { DomainEvent } from '@/simulation/DomainEventQueue.js';

export interface EventFeedback {
  readonly cue: AudioCueRequest | null;
  readonly indicatorText: string | null;
}

function createCue(
  name: string,
  volume: number,
  position?: { readonly x: number; readonly y: number; readonly z: number },
): AudioCueRequest {
  return position
    ? { name, volume, position }
    : { name, volume };
}

function directionFrom(
  eventPosition: { readonly x: number; readonly z: number },
  listenerPosition: { readonly x: number; readonly z: number },
): string {
  const dx = eventPosition.x - listenerPosition.x;
  const dz = eventPosition.z - listenerPosition.z;
  if (Math.abs(dx) < 0.8 && Math.abs(dz) < 0.8) {
    return 'vicino';
  }
  if (Math.abs(dx) >= Math.abs(dz)) {
    return dx > 0 ? 'a destra' : 'a sinistra';
  }
  return dz > 0 ? 'davanti' : 'dietro';
}

function withDirection(
  label: string,
  event: DomainEvent,
  listenerPosition?: { readonly x: number; readonly z: number } | null,
): string {
  if (!event.position || !listenerPosition) {
    return label;
  }
  return `${label} ${directionFrom(event.position, listenerPosition)}`;
}

export function deriveEventFeedback(
  event: DomainEvent,
  listenerPosition?: { readonly x: number; readonly z: number } | null,
): EventFeedback {
  switch (event.kind) {
    case 'TORCH_FUEL_LOW':
      return {
        cue: { name: 'torch_low_warning', volume: 0.9 },
        indicatorText: 'Torcia quasi esaurita',
      };
    case 'TORCH_FUEL_EMPTY':
      return {
        cue: { name: 'torch_extinguish', volume: 1 },
        indicatorText: 'Torcia spenta',
      };
    case 'LIGHT_PULSE':
      return {
        cue: createCue('torch_wave', 0.55, event.position),
        indicatorText: withDirection('Fiamma agitata', event, listenerPosition),
      };
    case 'BRAZIER_LIT':
      return {
        cue: createCue('brazier_ignite', 0.8, event.position),
        indicatorText: withDirection('Braciere acceso', event, listenerPosition),
      };
    case 'KA_ECHO_PULSE':
      return {
        cue: createCue('ka_echo_pulse', 0.8, event.position),
        indicatorText: 'Eco del Ka attivato',
      };
    case 'DIG_PROGRESS':
      return {
        cue: createCue('dig_progress', 0.6, event.position),
        indicatorText: withDirection('Scavo in corso', event, listenerPosition),
      };
    case 'TREASURE_FOUND':
      return {
        cue: createCue('treasure_found', 0.9, event.position),
        indicatorText: withDirection('Tesoro dissotterrato', event, listenerPosition),
      };
    case 'PLAYER_DAMAGED':
      {
        const source =
          typeof event.data?.source === 'string'
            ? event.data.source
            : null;
        return {
          cue: createCue('player_hit', 0.95, event.position),
          indicatorText: source
            ? `Pericolo: ${source}`
            : 'Pericolo in arrivo',
        };
      }
    case 'ENEMY_DIED':
      return {
        cue: createCue('enemy_down', 0.5, event.position),
        indicatorText: null,
      };
    case 'FLOOR_COMPLETE':
      return {
        cue: { name: 'floor_complete', volume: 0.85 },
        indicatorText: 'Uscita raggiunta',
      };
    default:
      return {
        cue: null,
        indicatorText: null,
      };
  }
}
