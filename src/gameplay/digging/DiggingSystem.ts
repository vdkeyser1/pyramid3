/**
 * Scopo: gestione dello scavo del tesoro — 4 segmenti persistenti (§10.2, §44.6).
 * Ownership: stato della simulazione.
 * Invarianti:
 *   - lo scavo richiede torcia accesa;
 *   - interrompibile senza perdita di progresso;
 *   - ogni segmento genera un impulso sonoro crescente;
 *   - il tesoro è ottenibile una sola volta.
 */

import { DIGGING } from '../../content/balance.js';

export interface DigSite {
  readonly siteId: string;
  readonly roomId: number;
  readonly positionX: number;
  readonly positionZ: number;
  /** Progresso in tick completati. */
  progressTicks: number;
  completed: boolean;
}

export interface DigEvent {
  readonly kind: 'SEGMENT_COMPLETE' | 'DIG_COMPLETE' | 'NOISE_PULSE';
  readonly siteId: string;
  readonly segmentIndex: number;
  readonly noiseIntensity: number;
}

const TICKS_PER_SEGMENT = Math.floor(DIGGING.totalDurationTicks / DIGGING.segments);

export function createDigSite(
  siteId: string,
  roomId: number,
  positionX: number,
  positionZ: number,
): DigSite {
  return { siteId, roomId, positionX, positionZ, progressTicks: 0, completed: false };
}

/**
 * Avanza lo scavo di un tick. Restituisce eventuali eventi.
 * @param torchLit true se la torcia è accesa (requisito per scavare).
 */
export function tickDig(site: DigSite, torchLit: boolean): DigEvent | null {
  if (site.completed || !torchLit) return null;

  const previousSegment = Math.floor(site.progressTicks / TICKS_PER_SEGMENT);
  site.progressTicks++;

  if (site.progressTicks >= DIGGING.totalDurationTicks) {
    site.completed = true;
    return {
      kind: 'DIG_COMPLETE',
      siteId: site.siteId,
      segmentIndex: DIGGING.segments - 1,
      noiseIntensity: 5.0,
    };
  }

  const currentSegment = Math.floor(site.progressTicks / TICKS_PER_SEGMENT);
  if (currentSegment > previousSegment) {
    // Rumore crescente per segmento: 2.0, 3.0, 4.0, 5.0
    const noiseIntensity = 2.0 + currentSegment;
    return {
      kind: 'SEGMENT_COMPLETE',
      siteId: site.siteId,
      segmentIndex: currentSegment,
      noiseIntensity,
    };
  }

  return null;
}

export function getDigProgress(site: DigSite): number {
  return Math.min(1, site.progressTicks / DIGGING.totalDurationTicks);
}

export function getCurrentSegment(site: DigSite): number {
  return Math.min(DIGGING.segments - 1, Math.floor(site.progressTicks / TICKS_PER_SEGMENT));
}
