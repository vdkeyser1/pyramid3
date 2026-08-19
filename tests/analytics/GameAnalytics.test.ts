/**
 * Test: GameAnalytics (T-01)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createGameAnalytics } from '@/analytics/GameAnalytics.js';

const NOW = Date.UTC(2025, 5, 15, 10, 0, 0);

describe('GameAnalytics (T-01)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('track: registra un evento senza errori', () => {
    const analytics = createGameAnalytics();
    expect(() => {
      analytics.track('SESSION_START', NOW);
    }).not.toThrow();
  });

  it('getSummary: sessioni e run conteggiate correttamente', () => {
    const analytics = createGameAnalytics();
    analytics.track('SESSION_START', NOW);
    analytics.track('RUN_START', NOW + 1000);
    analytics.track('RUN_START', NOW + 2000);
    const summary = analytics.getSummary();
    expect(summary.totalSessions).toBe(1);
    expect(summary.totalRuns).toBe(2);
  });

  it('getSummary: morti conteggiate', () => {
    const analytics = createGameAnalytics();
    analytics.track('PLAYER_DEATH', NOW, { killedBy: 'COBRA', px: 5, pz: 10 });
    analytics.track('PLAYER_DEATH', NOW + 1, { killedBy: 'COBRA', px: 5, pz: 10 });
    analytics.track('PLAYER_DEATH', NOW + 2, { killedBy: 'ROYAL_MUMMY', px: 0, pz: 0 });
    const summary = analytics.getSummary();
    expect(summary.totalDeaths).toBe(3);
    expect(summary.mostDeadlyEnemy).toBe('COBRA');
  });

  it('getSummary: deathHeatmap aggrega per posizione', () => {
    const analytics = createGameAnalytics();
    analytics.setRunContext('run-1', 1);
    // 3 morti nella stessa cella (5,10)
    for (let i = 0; i < 3; i++) {
      analytics.track('PLAYER_DEATH', NOW + i, { killedBy: 'COBRA', px: 5.4, pz: 10.1 });
    }
    // 1 morte in cella diversa (0,0)
    analytics.track('PLAYER_DEATH', NOW + 10, { killedBy: 'SCARAB', px: 0.1, pz: 0.2 });

    const { deathHeatmap } = analytics.getSummary();
    expect(deathHeatmap.length).toBeGreaterThan(0);
    // La cella con più morti deve essere prima
    expect(deathHeatmap[0]!.count).toBeGreaterThanOrEqual(deathHeatmap[1]?.count ?? 0);
  });

  it('getSummary: averageFloorReached calcolato dai RUN_END', () => {
    const analytics = createGameAnalytics();
    analytics.track('RUN_END', NOW,        { floorReached: 2 });
    analytics.track('RUN_END', NOW + 1000, { floorReached: 4 });
    const summary = analytics.getSummary();
    expect(summary.averageFloorReached).toBeCloseTo(3.0, 1);
  });

  it('setFloor: aggiorna il floor dei tracker successivi', () => {
    const analytics = createGameAnalytics();
    analytics.setRunContext('run-1', 1);
    analytics.track('FLOOR_COMPLETE', NOW);
    analytics.setFloor(2);
    analytics.track('FLOOR_COMPLETE', NOW + 1);
    // Non verifichiamo il dettaglio interno ma che non si crashi
    const summary = analytics.getSummary();
    expect(summary).toBeDefined();
  });

  it('exportJSON: produce JSON valido', () => {
    const analytics = createGameAnalytics();
    analytics.track('SESSION_START', NOW);
    const json = analytics.exportJSON();
    const parsed = JSON.parse(json) as { eventCount: number };
    expect(parsed.eventCount).toBeGreaterThan(0);
  });

  it('clear: resetta tutto', () => {
    const analytics = createGameAnalytics();
    analytics.track('SESSION_START', NOW);
    analytics.clear();
    const summary = analytics.getSummary();
    expect(summary.totalSessions).toBe(0);
    expect(summary.totalDeaths).toBe(0);
  });
});
