/**
 * G-02: Daily Challenge con seed deterministico basato sulla data.
 *
 * Ogni giorno alle 00:00 UTC viene generato un nuovo seed a partire da:
 *   seed = murmurHash(YYYY-MM-DD)
 *
 * Il JSON con il seed giornaliero viene generato offline da GitHub Actions
 * (scripts/generate-daily-seed.mjs) e servito come static file:
 *   /daily-seed.json → { date: "2025-12-24", seed: 1234567890, modifiers: [...] }
 *
 * Il sistema consente:
 *   1. Fetch del seed dal server (con cache 25h nel SW)
 *   2. Generazione locale fallback (stessa formula, senza server)
 *   3. Leaderboard locale (risultati per data → localStorage)
 *
 * Sicurezza: nessun performance.now() in questo modulo.
 *            Il timestamp viene passato dall'esterno.
 */

import { createLogger } from '@/core/Logger.js';

const log = createLogger('DailyChallenge');
const DAILY_SEED_URL = '/daily-seed.json';
const LS_PREFIX = 'piramide-daily:';

// ─── Tipi ─────────────────────────────────────────────────────────────────

export type DailyModifier =
  | 'NO_TORCH'           // torcia disabilitata: solo oscurità assoluta
  | 'FAST_ENEMIES'       // velocità nemici ×1.5
  | 'ONE_HIT_KILL'       // il player muore al primo colpo
  | 'GOLDEN_RUN'         // tutto il Ka raddoppiato, nemici più forti +25%
  | 'CURSED_FLOOR'       // tutti i nemici hanno torchAffinity invertita
  | 'SPEED_RUN';         // floor time limit 5 minuti per floor

export interface DailySeedPayload {
  readonly date: string;          // "YYYY-MM-DD"
  readonly seed: number;
  readonly modifiers: readonly DailyModifier[];
  readonly targetFloor: number;   // floor di vittoria giornaliero (1-7)
  readonly description: string;   // testo descrittivo sfida
}

export interface DailyRunResult {
  readonly date: string;
  readonly floorReached: number;
  readonly completed: boolean;
  readonly durationMs: number;
  readonly kills: number;
  readonly kaEarned: number;
  readonly completedAt: number | null; // timestamp
}

export interface DailyChallengeSystem {
  /**
   * Carica il seed del giorno corrente.
   * Prova fetch remoto, poi fallback locale.
   * @param nowMs — timestamp corrente (mai performance.now())
   */
  fetchTodaySeed(nowMs: number): Promise<DailySeedPayload>;

  /** Verifica se il player ha già giocato la challenge odierna. */
  hasPlayedToday(nowMs: number): boolean;

  /** Salva il risultato della run giornaliera. */
  recordResult(result: DailyRunResult): void;

  /** Carica il risultato della run per una data specifica. */
  getResult(date: string): DailyRunResult | null;

  /** Calcola il seed locale per una data (fallback offline). */
  computeLocalSeed(dateStr: string): DailySeedPayload;
}

// ─── Hash deterministico (Murmur3-like, pure JS) ─────────────────────────

function murmurHash32(str: string): number {
  let h = 0xdeadbeef;
  for (let i = 0; i < str.length; i++) {
    let k = str.charCodeAt(i);
    k = Math.imul(k, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);
    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = (Math.imul(h, 5) + 0xe6546b64) | 0;
  }
  h ^= str.length;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0; // unsigned
}

// ─── Selezione modifier deterministica ────────────────────────────────────

const ALL_MODIFIERS: DailyModifier[] = [
  'FAST_ENEMIES', 'GOLDEN_RUN', 'CURSED_FLOOR',
  'NO_TORCH', 'SPEED_RUN', 'ONE_HIT_KILL',
];

function pickModifiers(seed: number): DailyModifier[] {
  // 0 modificatori: 30%, 1 modificatore: 50%, 2 modificatori: 20%
  const roll = (seed & 0xFF) / 255;
  let count: number;
  if (roll < 0.30) count = 0;
  else if (roll < 0.80) count = 1;
  else count = 2;

  const mods: DailyModifier[] = [];
  const pool = [...ALL_MODIFIERS];
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = murmurHash32(String(s));
    const idx = s % pool.length;
    // splice restituisce già l'elemento estratto: niente indicizzazione
    // separata e nessun non-null assertion.
    const [picked] = pool.splice(idx, 1);
    if (picked !== undefined) mods.push(picked);
  }
  return mods;
}

function pickTargetFloor(seed: number): number {
  // Floor 1-7, distribution bilanciata con piccola preferenza per 3-5
  const roll = (seed >> 8) & 0xF; // 0..15
  const table = [1, 2, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 7, 7];
  return table[roll] ?? 4;
}

const DESCRIPTIONS: Record<number, string> = {
  0: 'Discendi nelle profondità — nessun modificatore oggi.',
  1: 'Il modificatore del giorno mette alla prova una sola abilità.',
  2: 'Doppia sfida: due modificatori combinati. I coraggiosi prevalgono.',
};

// ─── Helper data ──────────────────────────────────────────────────────────

function toDateString(nowMs: number): string {
  const d = new Date(nowMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Factory ──────────────────────────────────────────────────────────────

export function createDailyChallengeSystem(): DailyChallengeSystem {
  return {
    async fetchTodaySeed(nowMs) {
      const dateStr = toDateString(nowMs);
      try {
        const res = await fetch(DAILY_SEED_URL, { cache: 'default' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as DailySeedPayload;
        // Verifica che il payload sia per oggi
        if (payload.date === dateStr) {
          log.info(`Seed giornaliero caricato per ${dateStr}: ${payload.seed}`);
          return payload;
        }
        log.warn(`Seed remoto per ${payload.date}, ma oggi è ${dateStr} — generazione locale`);
      } catch (err) {
        log.warn('Fetch daily-seed.json fallito, uso seed locale', { error: err });
      }
      return this.computeLocalSeed(dateStr);
    },

    hasPlayedToday(nowMs) {
      const dateStr = toDateString(nowMs);
      return localStorage.getItem(`${LS_PREFIX}result:${dateStr}`) !== null;
    },

    recordResult(result) {
      const key = `${LS_PREFIX}result:${result.date}`;
      try {
        localStorage.setItem(key, JSON.stringify(result));
      } catch {
        log.warn('Impossibile salvare risultato daily challenge (storage pieno?)');
      }
    },

    getResult(date) {
      const raw = localStorage.getItem(`${LS_PREFIX}result:${date}`);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as DailyRunResult;
      } catch { return null; }
    },

    computeLocalSeed(dateStr) {
      const seed = murmurHash32(dateStr);
      const modifiers = pickModifiers(seed);
      const targetFloor = pickTargetFloor(seed);
      return {
        date: dateStr,
        seed,
        modifiers,
        targetFloor,
        description: DESCRIPTIONS[modifiers.length] ?? 'Sfida del giorno.',
      };
    },
  };
}
