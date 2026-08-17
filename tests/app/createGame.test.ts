import { describe, expect, it } from 'vitest';
import { dailySeedFor, isDailyMode, parseSeedParam } from '@/app/createGame.js';

describe('parseSeedParam (G-22)', () => {
  it('legge ?seed=N come intero', () => {
    expect(parseSeedParam('?seed=42')).toBe(42);
    expect(parseSeedParam('?seed=0')).toBe(0);
    expect(parseSeedParam('?seed=999999')).toBe(999999);
  });

  it('supporta anche ?fixedSeed=N', () => {
    expect(parseSeedParam('?fixedSeed=7')).toBe(7);
  });

  it('ritorna null senza parametro o con parametro invalido', () => {
    expect(parseSeedParam('')).toBeNull();
    expect(parseSeedParam('?other=1')).toBeNull();
    expect(parseSeedParam('?seed=abc')).toBeNull();
    expect(parseSeedParam('?seed=-3')).toBeNull();
    expect(parseSeedParam('?seed=1.5')).toBeNull();
  });

  it('preferisce seed su fixedSeed se entrambi presenti', () => {
    expect(parseSeedParam('?fixedSeed=7&seed=42')).toBe(42);
  });
});

describe('dailySeedFor / isDailyMode (DAILY-1)', () => {
  it('è deterministico: stessa data ⇒ stesso seed', () => {
    const date = new Date('2026-08-14T12:00:00Z');
    expect(dailySeedFor(date)).toBe(dailySeedFor(new Date('2026-08-14T23:59:00Z')));
  });

  it('cambia al cambio di giorno (UTC)', () => {
    const day1 = dailySeedFor(new Date('2026-08-14T12:00:00Z'));
    const day2 = dailySeedFor(new Date('2026-08-15T12:00:00Z'));
    expect(day1).not.toBe(day2);
  });

  it('produce un intero unsigned valido', () => {
    const seed = dailySeedFor(new Date('2026-08-14T00:00:00Z'));
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(seed)).toBe(true);
  });

  it('isDailyMode rileva ?daily', () => {
    expect(isDailyMode('?daily')).toBe(true);
    expect(isDailyMode('?daily=1')).toBe(true);
    expect(isDailyMode('?seed=42')).toBe(false);
    expect(isDailyMode('')).toBe(false);
  });
});
