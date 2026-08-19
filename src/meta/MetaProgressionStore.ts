/**
 * G-01: Store persistente per la meta-progressione.
 *
 * Usa IndexedDB (via libreria `idb`) come storage primario,
 * con fallback a localStorage per browser senza IDB completo.
 *
 * SCHEMA v1 (non breaking):
 *   database: 'piramide-meta' version: 1
 *   store: 'progression'
 *     key: 'state' → MetaProgressionState
 *     key: 'run-history' → RunHistoryEntry[]
 *
 * Ownership: GameApplication lo crea una volta.
 *            UI MetaProgressionScreen lo legge/scrive.
 *            GameLoop lo interroga all'inizio di ogni run.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { UpgradeId } from '@/meta/MetaUpgradeDefinitions.js';
import { UPGRADE_DEFS, upgradeCost } from '@/meta/MetaUpgradeDefinitions.js';

const DB_NAME = 'piramide-meta';
const DB_VERSION = 1;
const STORE_NAME = 'progression';
const STATE_KEY = 'state';
const HISTORY_KEY = 'run-history';
const MAX_HISTORY = 50; // massimo 50 run salvate

// ─── Tipi pubblici ────────────────────────────────────────────────────────

export interface MetaProgressionState {
  readonly version: 1;
  /** Ka Fragments accumulati totali (non spesi). */
  readonly kaFragments: number;
  /** Livello corrente per ogni upgrade (assente = 0). */
  readonly upgradeLevels: Readonly<Partial<Record<UpgradeId, number>>>;
  /** Statistiche all-time. */
  readonly stats: AllTimeStats;
}

export interface AllTimeStats {
  readonly totalRuns: number;
  readonly totalKills: number;
  readonly totalKaEarned: number;
  readonly bestFloor: number;
  readonly totalPlaytimeMs: number;
  readonly firstRunAt: number | null; // timestamp ms
  readonly lastRunAt: number | null;
}

export interface RunHistoryEntry {
  readonly runId: string;          // UUID v4
  readonly startedAt: number;      // timestamp ms
  readonly durationMs: number;
  readonly floorReached: number;
  readonly kills: number;
  readonly kaEarned: number;
  readonly isDailyChallenge: boolean;
  readonly deathCause: string | null;
  readonly seed: number;
}

export interface RunResult {
  readonly durationMs: number;
  readonly floorReached: number;
  readonly kills: number;
  readonly kaEarned: number;
  readonly isDailyChallenge: boolean;
  readonly deathCause: string | null;
  readonly seed: number;
}

export interface MetaProgressionStore {
  /** Carica lo stato dal DB. Chiama prima di qualsiasi altra operazione. */
  load(): Promise<MetaProgressionState>;

  /** Aggiunge Ka Fragments (mai negativi). */
  addKaFragments(amount: number): Promise<MetaProgressionState>;

  /**
   * Tenta di acquistare il prossimo livello di un upgrade.
   * @returns stato aggiornato, o null se non abbastanza Ka/già al max.
   */
  purchaseUpgrade(id: UpgradeId): Promise<MetaProgressionState | null>;

  /** Chiamato a fine run per aggiornare statistiche e history. */
  recordRunResult(result: RunResult): Promise<MetaProgressionState>;

  /** Restituisce le ultime N run. */
  getRunHistory(limit?: number): Promise<readonly RunHistoryEntry[]>;

  /** Resetta TUTTO (solo per debug/test). */
  reset(): Promise<void>;

  /**
   * Computa il bonus effettivo da applicare all'inizio di una run.
   * Lettura pura, non altera lo stato.
   */
  computeRunBonuses(state: MetaProgressionState): RunBonuses;
}

export interface RunBonuses {
  readonly hpMultiplier: number;       // 1.0 + MENAT_BLESSING bonus
  readonly damageReduction: number;    // 0..1 (KHEPRI_CARAPACE)
  readonly parryWindowFrames: number;  // frame extra (ANUBIS_SCALE)
  readonly meleeDamageMultiplier: number; // (SEKHMET_FURY)
  readonly movementSpeedMultiplier: number; // (BASTET_AGILITY)
  readonly torchDurationMultiplier: number; // (RA_TORCH)
  readonly kaFragmentMultiplier: number;    // (SOBEK_VAULT)
  readonly extraLoreItems: number;          // (THOTH_SCROLL)
  readonly extraRoomsPerFloor: number;      // (IMHOTEP_ARCHITECT)
  readonly hasSecondarySlot: boolean;       // (PTAH_CRAFTSMAN)
  readonly hasPersistentMap: boolean;       // (HATHOR_MEMORY)
  readonly hasRebirth: boolean;             // (OSIRIS_REBIRTH)
}

// ─── Stato di default ─────────────────────────────────────────────────────

const DEFAULT_STATE: MetaProgressionState = {
  version: 1,
  kaFragments: 0,
  upgradeLevels: {},
  stats: {
    totalRuns: 0,
    totalKills: 0,
    totalKaEarned: 0,
    bestFloor: 0,
    totalPlaytimeMs: 0,
    firstRunAt: null,
    lastRunAt: null,
  },
};

// ─── Implementazione ──────────────────────────────────────────────────────

export async function createMetaProgressionStore(): Promise<MetaProgressionStore> {
  let db: IDBPDatabase | null = null;

  // Tenta apertura IDB; se fallisce usa un fallback in-memory+localStorage.
  const tryOpenDB = async (): Promise<IDBPDatabase | null> => {
    try {
      return await openDB(DB_NAME, DB_VERSION, {
        upgrade(database) {
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME);
          }
        },
      });
    } catch {
      return null;
    }
  };

  // ── Lettura / scrittura LS fallback ────────────────────────────────────
  const lsKey = `${DB_NAME}:${STATE_KEY}`;
  const lsHistoryKey = `${DB_NAME}:${HISTORY_KEY}`;

  const readFromLS = <T>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch { return fallback; }
  };

  const writeToLS = (key: string, value: unknown): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota superata o storage disabilitato (modalità privata): la
      // progressione resta in memoria per la sessione corrente.
    }
  };

  // ── Stato locale in-memory ─────────────────────────────────────────────
  let current: MetaProgressionState = DEFAULT_STATE;

  const persist = async (state: MetaProgressionState): Promise<void> => {
    current = state;
    if (db) {
      await db.put(STORE_NAME, state, STATE_KEY);
    } else {
      writeToLS(lsKey, state);
    }
  };

  db = await tryOpenDB();

  return {
    async load() {
      if (db) {
        const stored = await db.get(STORE_NAME, STATE_KEY) as MetaProgressionState | undefined;
        current = stored ?? DEFAULT_STATE;
      } else {
        current = readFromLS<MetaProgressionState>(lsKey, DEFAULT_STATE);
      }
      return current;
    },

    async addKaFragments(amount) {
      if (amount <= 0) return current;
      const next: MetaProgressionState = {
        ...current,
        kaFragments: current.kaFragments + Math.floor(amount),
        stats: {
          ...current.stats,
          totalKaEarned: current.stats.totalKaEarned + Math.floor(amount),
        },
      };
      await persist(next);
      return next;
    },

    async purchaseUpgrade(id) {
      const def = UPGRADE_DEFS[id];
      const currentLevel = current.upgradeLevels[id] ?? 0;

      if (currentLevel >= def.maxLevel) return null;

      // Verifica dipendenze
      if (def.requires) {
        for (const reqId of def.requires) {
          if ((current.upgradeLevels[reqId] ?? 0) < 1) return null;
        }
      }

      const cost = upgradeCost(id, currentLevel);
      if (current.kaFragments < cost) return null;

      const next: MetaProgressionState = {
        ...current,
        kaFragments: current.kaFragments - cost,
        upgradeLevels: {
          ...current.upgradeLevels,
          [id]: currentLevel + 1,
        },
      };
      await persist(next);
      return next;
    },

    async recordRunResult(result) {
      const now = Date.now();
      const entry: RunHistoryEntry = {
        runId: crypto.randomUUID(),
        startedAt: now - result.durationMs,
        durationMs: result.durationMs,
        floorReached: result.floorReached,
        kills: result.kills,
        kaEarned: result.kaEarned,
        isDailyChallenge: result.isDailyChallenge,
        deathCause: result.deathCause,
        seed: result.seed,
      };

      // Aggiorna history
      let history: RunHistoryEntry[];
      if (db) {
        history = ((await db.get(STORE_NAME, HISTORY_KEY)) ?? []) as RunHistoryEntry[];
      } else {
        history = readFromLS<RunHistoryEntry[]>(lsHistoryKey, []);
      }
      history = [entry, ...history].slice(0, MAX_HISTORY);
      if (db) {
        await db.put(STORE_NAME, history, HISTORY_KEY);
      } else {
        writeToLS(lsHistoryKey, history);
      }

      // Aggiorna stats
      const next: MetaProgressionState = {
        ...current,
        kaFragments: current.kaFragments + result.kaEarned,
        stats: {
          totalRuns: current.stats.totalRuns + 1,
          totalKills: current.stats.totalKills + result.kills,
          totalKaEarned: current.stats.totalKaEarned + result.kaEarned,
          bestFloor: Math.max(current.stats.bestFloor, result.floorReached),
          totalPlaytimeMs: current.stats.totalPlaytimeMs + result.durationMs,
          firstRunAt: current.stats.firstRunAt ?? now,
          lastRunAt: now,
        },
      };
      await persist(next);
      return next;
    },

    async getRunHistory(limit = 20) {
      let history: RunHistoryEntry[];
      if (db) {
        history = ((await db.get(STORE_NAME, HISTORY_KEY)) ?? []) as RunHistoryEntry[];
      } else {
        history = readFromLS<RunHistoryEntry[]>(lsHistoryKey, []);
      }
      return history.slice(0, limit);
    },

    async reset() {
      if (db) {
        await db.delete(STORE_NAME, STATE_KEY);
        await db.delete(STORE_NAME, HISTORY_KEY);
      } else {
        localStorage.removeItem(lsKey);
        localStorage.removeItem(lsHistoryKey);
      }
      current = DEFAULT_STATE;
    },

    computeRunBonuses(state) {
      const level = (id: UpgradeId): number => state.upgradeLevels[id] ?? 0;
      return {
        hpMultiplier: 1.0 + UPGRADE_DEFS.MENAT_BLESSING.bonusPerLevel * level('MENAT_BLESSING'),
        damageReduction: UPGRADE_DEFS.KHEPRI_CARAPACE.bonusPerLevel * level('KHEPRI_CARAPACE'),
        parryWindowFrames: Math.floor(UPGRADE_DEFS.ANUBIS_SCALE.bonusPerLevel * level('ANUBIS_SCALE')),
        meleeDamageMultiplier: 1.0 + UPGRADE_DEFS.SEKHMET_FURY.bonusPerLevel * level('SEKHMET_FURY'),
        movementSpeedMultiplier: 1.0 + UPGRADE_DEFS.BASTET_AGILITY.bonusPerLevel * level('BASTET_AGILITY'),
        torchDurationMultiplier: 1.0 + UPGRADE_DEFS.RA_TORCH.bonusPerLevel * level('RA_TORCH'),
        kaFragmentMultiplier: 1.0 + UPGRADE_DEFS.SOBEK_VAULT.bonusPerLevel * level('SOBEK_VAULT'),
        extraLoreItems: Math.floor(UPGRADE_DEFS.THOTH_SCROLL.bonusPerLevel * level('THOTH_SCROLL')),
        extraRoomsPerFloor: Math.floor(UPGRADE_DEFS.IMHOTEP_ARCHITECT.bonusPerLevel * level('IMHOTEP_ARCHITECT')),
        hasSecondarySlot: level('PTAH_CRAFTSMAN') >= 1,
        hasPersistentMap: level('HATHOR_MEMORY') >= 1,
        hasRebirth: level('OSIRIS_REBIRTH') >= 1,
      };
    },
  };
}
