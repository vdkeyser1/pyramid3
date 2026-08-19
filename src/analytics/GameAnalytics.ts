/**
 * T-01: Analytics eventi di gioco — solo localStorage, nessun server.
 *
 * Raccoglie:
 *   - Posizioni di morte (heatmap)
 *   - Momenti di drop sessione (abbandono)
 *   - Tempo per floor
 *   - Armi e abilità più usate
 *   - Nemici che causano più morti
 *
 * Privacy: tutti i dati rimangono nel browser dell'utente.
 *          Export JSON a richiesta per analisi offline.
 *
 * Ownership: GameApplication. Passato come dipendenza al GameLoop.
 *            Non influenza la logica di gioco (fire-and-forget).
 */

import { createLogger } from '@/core/Logger.js';

const log = createLogger('Analytics');

const LS_KEY = 'piramide-analytics:v1';
const MAX_EVENTS = 2000; // evita overflow localStorage

// ─── Tipi eventi ──────────────────────────────────────────────────────────

export type GameEventType =
  | 'SESSION_START'
  | 'SESSION_END'
  | 'RUN_START'
  | 'RUN_END'
  | 'FLOOR_START'
  | 'FLOOR_COMPLETE'
  | 'PLAYER_DEATH'
  | 'ENEMY_KILLED'
  | 'PARRY_SUCCESS'
  | 'PARRY_FAIL'
  | 'TORCH_LIT'
  | 'TORCH_EXTINGUISHED'
  | 'TREASURE_FOUND'
  | 'LORE_READ'
  | 'UPGRADE_PURCHASED'
  | 'DAILY_CHALLENGE_START'
  | 'DAILY_CHALLENGE_COMPLETE';

export interface GameEvent {
  readonly type: GameEventType;
  readonly timestamp: number;      // Date.now() — mai performance.now()
  readonly runId: string | null;
  readonly floor: number | null;
  readonly payload: Readonly<Record<string, number | string | boolean | null>>;
}

export interface HeatmapPoint {
  readonly x: number;
  readonly z: number;
  readonly floor: number;
  readonly count: number;
}

export interface AnalyticsSummary {
  readonly totalSessions: number;
  readonly totalRuns: number;
  readonly totalDeaths: number;
  readonly averageFloorReached: number;
  readonly mostDeadlyEnemy: string | null;
  readonly averageFloorTimeMs: number;
  readonly deathHeatmap: readonly HeatmapPoint[];
  readonly topWeaponsUsed: readonly string[];
}

export interface GameAnalytics {
  /**
   * Registra un evento.
   * @param nowMs — timestamp corrente (mai performance.now())
   */
  track(type: GameEventType, nowMs: number, payload?: Record<string, number | string | boolean | null>): void;

  /** Imposta il runId corrente (all'inizio di ogni run). */
  setRunContext(runId: string | null, floor: number): void;

  /** Avanza il numero di floor corrente. */
  setFloor(floor: number): void;

  /** Calcola e restituisce il riepilogo analitico. */
  getSummary(): AnalyticsSummary;

  /** Esporta tutti i dati come JSON string (per debug/analisi). */
  exportJSON(): string;

  /** Svuota tutti i dati analitici. */
  clear(): void;
}

// ─── Implementazione ──────────────────────────────────────────────────────

export function createGameAnalytics(): GameAnalytics {
  let events: GameEvent[] = [];
  let currentRunId: string | null = null;
  let currentFloor = 0;

  // Carica eventi esistenti
  const load = (): void => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GameEvent[];
        if (Array.isArray(parsed)) {
          events = parsed.slice(-MAX_EVENTS);
        }
      }
    } catch {
      events = [];
    }
  };

  const save = (): void => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
    } catch {
      // localStorage pieno: tronca a metà
      events = events.slice(-Math.floor(MAX_EVENTS / 2));
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(events));
      } catch {
        // Anche la metà non entra: rinunciamo alla persistenza di questo batch.
        // L'analytics è best-effort e non deve mai interrompere il gioco.
      }
    }
  };

  load();

  return {
    track(type, nowMs, payload = {}) {
      const event: GameEvent = {
        type,
        timestamp: nowMs,
        runId: currentRunId,
        floor: currentFloor,
        payload,
      };
      events.push(event);
      // Salva ogni 20 eventi per non martellare localStorage
      if (events.length % 20 === 0) save();
    },

    setRunContext(runId, floor) {
      currentRunId = runId;
      currentFloor = floor;
    },

    setFloor(floor) {
      currentFloor = floor;
    },

    getSummary() {
      const sessions = events.filter(e => e.type === 'SESSION_START').length;
      const runs     = events.filter(e => e.type === 'RUN_START').length;
      const deaths   = events.filter(e => e.type === 'PLAYER_DEATH');

      // Floor medio raggiunto
      const runEnds = events.filter(e => e.type === 'RUN_END');
      const avgFloor = runEnds.length > 0
        ? runEnds.reduce((acc, e) => acc + (Number(e.payload.floorReached) || 0), 0) / runEnds.length
        : 0;

      // Nemico più letale
      const enemyCounts = new Map<string, number>();
      for (const e of deaths) {
        const enemy = String(e.payload.killedBy ?? 'unknown');
        enemyCounts.set(enemy, (enemyCounts.get(enemy) ?? 0) + 1);
      }
      let mostDeadly: string | null = null;
      let maxKills = 0;
      for (const [enemy, count] of enemyCounts) {
        if (count > maxKills) { maxKills = count; mostDeadly = enemy; }
      }

      // Tempo medio per floor
      const floorStarts = events.filter(e => e.type === 'FLOOR_START');
      const floorEnds   = events.filter(e => e.type === 'FLOOR_COMPLETE');
      let totalFloorTime = 0;
      let floorCount = 0;
      for (const end of floorEnds) {
        const start = floorStarts.findLast(
          s => s.floor === end.floor && s.runId === end.runId && s.timestamp < end.timestamp,
        );
        if (start) {
          totalFloorTime += end.timestamp - start.timestamp;
          floorCount++;
        }
      }
      const avgFloorTime = floorCount > 0 ? totalFloorTime / floorCount : 0;

      // Heatmap morti (griglia 1×1m, arrotondata al metro)
      const heatGrid = new Map<string, { x: number; z: number; floor: number; count: number }>();
      for (const e of deaths) {
        const x = Math.round(Number(e.payload.px) || 0);
        const z = Math.round(Number(e.payload.pz) || 0);
        const f = e.floor ?? 0;
        const key = `${f}:${x}:${z}`;
        const existing = heatGrid.get(key);
        if (existing) {
          existing.count++;
        } else {
          heatGrid.set(key, { x, z, floor: f, count: 1 });
        }
      }
      const deathHeatmap = [...heatGrid.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);

      return {
        totalSessions: sessions,
        totalRuns: runs,
        totalDeaths: deaths.length,
        averageFloorReached: Math.round(avgFloor * 10) / 10,
        mostDeadlyEnemy: mostDeadly,
        averageFloorTimeMs: Math.round(avgFloorTime),
        deathHeatmap,
        topWeaponsUsed: [], // TODO: implementare quando esistono più armi
      };
    },

    exportJSON() {
      save();
      return JSON.stringify({
        exportedAt: new Date().toISOString(),
        eventCount: events.length,
        events,
      }, null, 2);
    },

    clear() {
      events = [];
      localStorage.removeItem(LS_KEY);
      log.info('Analytics svuotate');
    },
  };
}
