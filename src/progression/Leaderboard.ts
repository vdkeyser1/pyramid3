/**
 * Scopo: leaderboard locale (C-01) — classifica dei run per piano raggiunto,
 *        poi oro accumulato. Nessuna API esterna: localStorage con storage
 *        iniettato per testabilità.
 * Ownership: progression (puro). Consumato da GameApplication alla morte.
 * Invarianti:
 *   - al massimo MAX_ENTRIES (10) voci, ordinate per floorReached DESC poi goldEarned DESC;
 *   - nessuna voce duplicata per (seed, runId) — un run non può comparire due volte;
 *   - loadLeaderboard non fallisce mai: storage corrotto ⇒ lista vuota;
 *   - il seed condiviso è sempre un intero positivo (per URL ?seed=N).
 * Failure mode: storage indisponibile (private mode) ⇒ funzione no-op.
 */

export interface LeaderboardEntry {
  readonly runId: string;
  readonly floorReached: number;
  readonly goldEarned: number;
  readonly enemiesDefeated: number;
  readonly seed: number;
  readonly date: string;
}

export const MAX_ENTRIES = 10;
const STORAGE_KEY = 'la-piramide-perduta:leaderboard:v1';

function isValidEntry(value: unknown): value is LeaderboardEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.runId === 'string' &&
    typeof entry.floorReached === 'number' &&
    Number.isFinite(entry.floorReached) &&
    typeof entry.goldEarned === 'number' &&
    typeof entry.enemiesDefeated === 'number' &&
    typeof entry.seed === 'number' &&
    Number.isInteger(entry.seed) &&
    typeof entry.date === 'string'
  );
}

function sortEntries(entries: readonly LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((left, right) => {
    if (right.floorReached !== left.floorReached) {
      return right.floorReached - left.floorReached;
    }
    if (right.goldEarned !== left.goldEarned) {
      return right.goldEarned - left.goldEarned;
    }
    return right.enemiesDefeated - left.enemiesDefeated;
  });
}

/** Carica la classifica (storage corrotto ⇒ []). */
export function loadLeaderboard(storage: Pick<Storage, 'getItem'>): LeaderboardEntry[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(isValidEntry);
    return sortEntries(valid).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

/** Salva la classifica (storage indisponibile ⇒ no-op silenzioso). */
export function saveLeaderboard(
  entries: readonly LeaderboardEntry[],
  storage: Pick<Storage, 'setItem'>,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(sortEntries(entries).slice(0, MAX_ENTRIES)));
  } catch {
    // private mode / quota esaurita: la classifica non è critica.
  }
}

export interface SubmitRunScoreInput {
  readonly runId: string;
  readonly floorReached: number;
  readonly goldEarned: number;
  readonly enemiesDefeated: number;
  readonly seed: number;
}

/**
 * Inserisce una run nella classifica e la salva. Ritorna la classifica
 * aggiornata. Un runId già presente viene aggiornato (best run per run).
 */
export function submitRunScore(
  input: SubmitRunScoreInput,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): LeaderboardEntry[] {
  const entry: LeaderboardEntry = {
    runId: input.runId,
    floorReached: input.floorReached,
    goldEarned: input.goldEarned,
    enemiesDefeated: input.enemiesDefeated,
    seed: input.seed,
    date: new Date().toISOString(),
  };
  const current = loadLeaderboard(storage).filter((candidate) => candidate.runId !== input.runId);
  const updated = sortEntries([...current, entry]).slice(0, MAX_ENTRIES);
  saveLeaderboard(updated, storage);
  return updated;
}

/**
 * C-01: URL condivisibile per un seed (riproducibilità già verificata via e2e).
 * Ritorna il path corrente con ?seed=N (preserva l'hash se presente).
 */
export function shareSeedUrl(seed: number, location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  const url = new URL(location.pathname, 'http://localhost');
  url.searchParams.set('seed', String(Math.max(0, Math.floor(seed))));
  const hash = location.hash.length > 1 ? location.hash : '';
  return `${url.pathname}?${url.searchParams.toString()}${hash}`;
}
