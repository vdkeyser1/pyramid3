/**
 * Test: DailyChallengeSystem (G-02)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createDailyChallengeSystem } from '@/gameplay/DailyChallengeSystem.js';

// Timestamp fisso per i test: 2025-12-24 (UTC)
const TEST_TS_24 = Date.UTC(2025, 11, 24, 12, 0, 0); // 2025-12-24 12:00 UTC
const TEST_TS_25 = Date.UTC(2025, 11, 25, 12, 0, 0); // 2025-12-25 12:00 UTC

describe('DailyChallengeSystem (G-02)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('computeLocalSeed: stesso seed per la stessa data', () => {
    const system = createDailyChallengeSystem();
    const s1 = system.computeLocalSeed('2025-12-24');
    const s2 = system.computeLocalSeed('2025-12-24');
    expect(s1.seed).toBe(s2.seed);
    expect(s1.date).toBe('2025-12-24');
  });

  it('computeLocalSeed: seed diverso per date diverse', () => {
    const system = createDailyChallengeSystem();
    const s1 = system.computeLocalSeed('2025-12-24');
    const s2 = system.computeLocalSeed('2025-12-25');
    expect(s1.seed).not.toBe(s2.seed);
  });

  it('computeLocalSeed: seed è un numero positivo', () => {
    const system = createDailyChallengeSystem();
    const payload = system.computeLocalSeed('2025-06-15');
    expect(payload.seed).toBeGreaterThan(0);
    expect(Number.isInteger(payload.seed)).toBe(true);
  });

  it('computeLocalSeed: targetFloor tra 1 e 7', () => {
    const system = createDailyChallengeSystem();
    // Testa 20 date diverse
    for (let d = 1; d <= 20; d++) {
      const date = `2025-${String(d % 12 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const payload = system.computeLocalSeed(date);
      expect(payload.targetFloor).toBeGreaterThanOrEqual(1);
      expect(payload.targetFloor).toBeLessThanOrEqual(7);
    }
  });

  it('computeLocalSeed: modifiers sono un subset valido', () => {
    const VALID_MODS = new Set([
      'NO_TORCH', 'FAST_ENEMIES', 'ONE_HIT_KILL',
      'GOLDEN_RUN', 'CURSED_FLOOR', 'SPEED_RUN',
    ]);
    const system = createDailyChallengeSystem();
    for (let d = 1; d <= 30; d++) {
      const date = `2025-01-${String(d).padStart(2, '0')}`;
      const payload = system.computeLocalSeed(date);
      expect(payload.modifiers.length).toBeLessThanOrEqual(2);
      for (const mod of payload.modifiers) {
        expect(VALID_MODS.has(mod)).toBe(true);
      }
      // Nessun duplicato
      expect(new Set(payload.modifiers).size).toBe(payload.modifiers.length);
    }
  });

  it('hasPlayedToday: false se non ha giocato', () => {
    const system = createDailyChallengeSystem();
    expect(system.hasPlayedToday(TEST_TS_24)).toBe(false);
  });

  it('recordResult → hasPlayedToday: true', () => {
    const system = createDailyChallengeSystem();
    system.recordResult({
      date: '2025-12-24',
      floorReached: 3,
      completed: false,
      durationMs: 120000,
      kills: 5,
      kaEarned: 80,
      completedAt: null,
    });
    expect(system.hasPlayedToday(TEST_TS_24)).toBe(true);
    // Giorno successivo → false
    expect(system.hasPlayedToday(TEST_TS_25)).toBe(false);
  });

  it('getResult: ritorna il risultato salvato', () => {
    const system = createDailyChallengeSystem();
    system.recordResult({
      date: '2025-12-24',
      floorReached: 5,
      completed: true,
      durationMs: 300000,
      kills: 20,
      kaEarned: 400,
      completedAt: TEST_TS_24,
    });
    const result = system.getResult('2025-12-24');
    expect(result).not.toBeNull();
    expect(result!.floorReached).toBe(5);
    expect(result!.completed).toBe(true);
  });

  it('getResult: null per data senza risultato', () => {
    const system = createDailyChallengeSystem();
    expect(system.getResult('2030-01-01')).toBeNull();
  });

  it('description è definita e non vuota', () => {
    const system = createDailyChallengeSystem();
    const payload = system.computeLocalSeed('2025-03-15');
    expect(typeof payload.description).toBe('string');
    expect(payload.description.length).toBeGreaterThan(0);
  });
});
