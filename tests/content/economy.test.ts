import { describe, expect, it } from 'vitest';
import {
  convertGoldToFragments,
  FLOOR_COMPLETE_FRAGMENT_REWARD,
  GOLD_DROP_RANGES,
  GOLD_TO_FRAGMENT_CAP,
  goldDropRangeFor,
  rollGoldDrop,
} from '@/content/economy.js';

describe('rollGoldDrop', () => {
  it('resta dentro il range del tier per ogni valore di roll', () => {
    for (const tier of [1, 2, 3] as const) {
      const range = GOLD_DROP_RANGES[tier];
      for (let i = 0; i < 1000; i++) {
        const roll = i / 1000;
        const drop = rollGoldDrop(tier, roll);
        expect(drop).toBeGreaterThanOrEqual(range.min);
        expect(drop).toBeLessThanOrEqual(range.max);
        expect(Number.isInteger(drop)).toBe(true);
      }
    }
  });

  it('è deterministico: stesso roll ⇒ stesso drop', () => {
    expect(rollGoldDrop(1, 0.5)).toBe(rollGoldDrop(1, 0.5));
    expect(rollGoldDrop(2, 0.123456)).toBe(rollGoldDrop(2, 0.123456));
    expect(rollGoldDrop(3, 0.987)).toBe(rollGoldDrop(3, 0.987));
  });

  it('roll ai bordi: 0 → minimo, quasi-1 → massimo', () => {
    expect(rollGoldDrop(1, 0)).toBe(GOLD_DROP_RANGES[1].min);
    expect(rollGoldDrop(2, 0)).toBe(GOLD_DROP_RANGES[2].min);
    expect(rollGoldDrop(3, 0.999999)).toBe(GOLD_DROP_RANGES[3].max);
  });

  it('tier sconosciuto degrada al tier 1', () => {
    expect(rollGoldDrop(99, 0.5)).toBeGreaterThanOrEqual(GOLD_DROP_RANGES[1].min);
    expect(rollGoldDrop(99, 0.5)).toBeLessThanOrEqual(GOLD_DROP_RANGES[1].max);
  });
});

describe('goldDropRangeFor', () => {
  it('esporta i range dichiarati per ogni tier', () => {
    expect(goldDropRangeFor(1)).toEqual({ min: 5, max: 15 });
    expect(goldDropRangeFor(2)).toEqual({ min: 15, max: 40 });
    expect(goldDropRangeFor(3)).toEqual({ min: 50, max: 100 });
  });
});

describe('convertGoldToFragments', () => {
  it('converte il 20% con arrotondamento per difetto (sotto il cap)', () => {
    expect(convertGoldToFragments(45)).toBe(9);
    expect(convertGoldToFragments(60)).toBe(12);
    expect(convertGoldToFragments(0)).toBe(0);
  });

  it('non supera mai il cap per run', () => {
    expect(convertGoldToFragments(100)).toBe(GOLD_TO_FRAGMENT_CAP);
    expect(convertGoldToFragments(10_000)).toBe(GOLD_TO_FRAGMENT_CAP);
    expect(convertGoldToFragments(1000)).toBe(GOLD_TO_FRAGMENT_CAP);
  });

  it('valori non finiti o negativi → 0', () => {
    expect(convertGoldToFragments(Number.NaN)).toBe(0);
    expect(convertGoldToFragments(Number.POSITIVE_INFINITY)).toBe(0);
    expect(convertGoldToFragments(-50)).toBe(0);
  });
});

describe('FLOOR_COMPLETE_FRAGMENT_REWARD', () => {
  it('è un numero positivo', () => {
    expect(FLOOR_COMPLETE_FRAGMENT_REWARD).toBeGreaterThan(0);
  });
});
