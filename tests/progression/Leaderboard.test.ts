import { describe, expect, it } from 'vitest';
import {
  loadLeaderboard,
  MAX_ENTRIES,
  saveLeaderboard,
  shareSeedUrl,
  submitRunScore,
  type LeaderboardEntry,
} from '@/progression/Leaderboard.js';

function makeStorage(): { data: Map<string, string>; getItem(k: string): string | null; setItem(k: string, v: string): void } {
  const data = new Map<string, string>();
  return {
    data,
    getItem(k: string): string | null {
      return data.get(k) ?? null;
    },
    setItem(k: string, v: string): void {
      data.set(k, v);
    },
  };
}

describe('Leaderboard (C-01)', () => {
  it('inserisce una run e la ritrova in cima', () => {
    const storage = makeStorage();
    const board = submitRunScore(
      { runId: 'run-1', floorReached: 3, goldEarned: 120, enemiesDefeated: 8, seed: 42 },
      storage,
    );
    expect(board).toHaveLength(1);
    expect(board[0]?.runId).toBe('run-1');
    expect(board[0]?.seed).toBe(42);
  });

  it('ordina per piano raggiunto, poi oro, poi nemici', () => {
    const storage = makeStorage();
    submitRunScore({ runId: 'a', floorReached: 2, goldEarned: 500, enemiesDefeated: 3, seed: 1 }, storage);
    submitRunScore({ runId: 'b', floorReached: 4, goldEarned: 10, enemiesDefeated: 1, seed: 2 }, storage);
    submitRunScore({ runId: 'c', floorReached: 4, goldEarned: 90, enemiesDefeated: 2, seed: 3 }, storage);
    submitRunScore({ runId: 'd', floorReached: 4, goldEarned: 90, enemiesDefeated: 5, seed: 4 }, storage);
    const board = loadLeaderboard(storage);
    expect(board.map((e) => e.runId)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('il runId duplicato aggiorna la run precedente (best run)', () => {
    const storage = makeStorage();
    submitRunScore({ runId: 'run-1', floorReached: 1, goldEarned: 10, enemiesDefeated: 0, seed: 42 }, storage);
    const board = submitRunScore({ runId: 'run-1', floorReached: 5, goldEarned: 200, enemiesDefeated: 12, seed: 42 }, storage);
    expect(board).toHaveLength(1);
    expect(board[0]?.floorReached).toBe(5);
  });

  it('tronca a MAX_ENTRIES', () => {
    const storage = makeStorage();
    for (let i = 0; i < 15; i++) {
      submitRunScore({ runId: `run-${i}`, floorReached: i, goldEarned: i * 10, enemiesDefeated: i, seed: i }, storage);
    }
    expect(loadLeaderboard(storage)).toHaveLength(MAX_ENTRIES);
  });

  it('storage corrotto ⇒ lista vuota, nessun throw', () => {
    const storage = { getItem: () => '{not-json!!' } as unknown as Storage;
    expect(loadLeaderboard(storage)).toEqual([]);
    const storage2 = { getItem: () => JSON.stringify([{ runId: 42 }]) } as unknown as Storage;
    expect(loadLeaderboard(storage2)).toEqual([]);
  });

  it('shareSeedUrl produce un URL riproducibile con ?seed=N', () => {
    const location = { pathname: '/', search: '', hash: '' } as Location;
    const url = shareSeedUrl(42, location);
    expect(url).toContain('?seed=42');
    const parsed = new URL(url, 'http://localhost');
    expect(parsed.searchParams.get('seed')).toBe('42');
  });

  it('saveLeaderboard su storage che lancia è un no-op sicuro', () => {
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    } as unknown as Storage;
    expect(() =>
      submitRunScore({ runId: 'x', floorReached: 1, goldEarned: 1, enemiesDefeated: 0, seed: 1 }, broken),
    ).not.toThrow();
  });

  it('persistenza round-trip via saveLeaderboard', () => {
    const storage = makeStorage();
    const entry: LeaderboardEntry = {
      runId: 'r', floorReached: 6, goldEarned: 300, enemiesDefeated: 20, seed: 777, date: '2026-08-16',
    };
    saveLeaderboard([entry], storage);
    const board = loadLeaderboard(storage);
    expect(board[0]?.floorReached).toBe(6);
    expect(board[0]?.seed).toBe(777);
  });
});
