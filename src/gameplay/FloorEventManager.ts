/**
 * Scopo: gestore degli eventi dinamici e temporanei di piano (P17).
 *        Modula tempeste di sabbia sotterranee, risvegli di massa delle mummie,
 *        eclissi mistiche e bagliori solari di Ra.
 * Ownership: gameplay (deterministico e data-driven).
 */

import { hash32 } from '@/procedural/Hash32.js';
import type { RoomTheme } from '@/content/RoomThemes.js';

export type FloorEventType =
  | 'SAND_STORM_SURGE'
  | 'MUMMY_AWAKENING'
  | 'ECLIPSE_OF_RA'
  | 'SOLAR_BLESSING_BURST';

export interface FloorEventState {
  readonly active: boolean;
  readonly type: FloorEventType;
  readonly name: string;
  readonly description: string;
  readonly sandStormIntensity: number;
  readonly torchModifier: number;
  readonly enemySpeedModifier: number;
  readonly durationSeconds: number;
}

export const FLOOR_EVENTS: Record<FloorEventType, Omit<FloorEventState, 'active'>> = {
  SAND_STORM_SURGE: {
    type: 'SAND_STORM_SURGE',
    name: 'Tempesta di Sabbia Sotterranea',
    description: 'Il soffitto crollato lascia filtrare una violenta tempesta del deserto.',
    sandStormIntensity: 0.65,
    torchModifier: 0.8,
    enemySpeedModifier: 0.9,
    durationSeconds: 15,
  },
  MUMMY_AWAKENING: {
    type: 'MUMMY_AWAKENING',
    name: 'Risveglio dei Guardiani',
    description: 'Un fremito ancestrale ridesta i guardiani dormienti nelle cripte.',
    sandStormIntensity: 0.0,
    torchModifier: 0.7,
    enemySpeedModifier: 1.25,
    durationSeconds: 20,
  },
  ECLIPSE_OF_RA: {
    type: 'ECLIPSE_OF_RA',
    name: 'Eclissi di Ra',
    description: 'L oscurità avvolge il piano: la torcia fatica a penetrare la coltre di tenebre.',
    sandStormIntensity: 0.1,
    torchModifier: 0.45,
    enemySpeedModifier: 1.1,
    durationSeconds: 18,
  },
  SOLAR_BLESSING_BURST: {
    type: 'SOLAR_BLESSING_BURST',
    name: 'Raggio Solare di Ra',
    description: 'La luce solare benedice il piano, infondendo vigore al portatore della torcia.',
    sandStormIntensity: 0.0,
    torchModifier: 1.4,
    enemySpeedModifier: 0.85,
    durationSeconds: 12,
  },
};

/**
 * Valuta deterministicamente se scatta un evento all'ingresso in una determinata stanza.
 */
export function evaluateFloorEvent(
  seed: number,
  floorIndex: number,
  roomId: number,
  theme: RoomTheme,
): FloorEventState | null {
  const h = hash32(seed * 499 + floorIndex * 71 + roomId * 13, 0x5a4d);

  // Probabilità di evento: ~30% nelle stanze crollate o infestate, ~15% nelle altre
  const threshold = (theme === 'COLLAPSED' || theme === 'SAND_FILLED' || theme === 'INFESTED')
    ? 0.30
    : 0.12;

  const roll = (h % 1000) / 1000;
  if (roll > threshold) {
    return null;
  }

  let eventType: FloorEventType = 'SAND_STORM_SURGE';
  if (theme === 'COLLAPSED' || theme === 'SAND_FILLED') {
    eventType = 'SAND_STORM_SURGE';
  } else if (theme === 'INFESTED' || theme === 'FUNERARY') {
    eventType = 'MUMMY_AWAKENING';
  } else if (theme === 'ASTRONOMICAL' || theme === 'SACRED') {
    eventType = ((h >>> 4) % 2 === 0) ? 'ECLIPSE_OF_RA' : 'SOLAR_BLESSING_BURST';
  } else {
    eventType = 'SAND_STORM_SURGE';
  }

  const baseDef = FLOOR_EVENTS[eventType];
  return {
    active: true,
    ...baseDef,
  };
}
