/**
 * G-02 — Template boss per i piani 5 e 10.
 *
 * Scopo: dati statici che descrivono i due boss della Piramide Perduta.
 *        Il runtime di combattimento (BossEncounterRuntime) consuma queste
 *        definizioni per pilotare fasi, pattern e ricompense.
 * Ownership: contenuto immutabile. Consumato da BossEncounterRuntime e dall'UI.
 *
 * Lore:
 *   Piano 5  — KHEPRI_GUARDIAN: lo Scarabeo Custode, guardiano del portale
 *              verso il nucleo della piramide. Corpo d'insetto colossale,
 *              attacchi telegrafati con rotolamento sferico.
 *   Piano 10 — SOBEK_ASCENDANT: il dio coccodrillo risvegliato, padrone
 *              dell'ultimo piano. Attacchi in tuffo e onde d'acqua putrefatta.
 */

// ── Tipi ─────────────────────────────────────────────────────────────────────

/** Fase del combattimento boss. */
export type BossPhase = 'INTRO' | 'PHASE_1' | 'PHASE_2' | 'ENRAGE' | 'DEFEATED';

/**
 * Configurazione di una singola fase del boss.
 * Le fasi sono attraversate in sequenza quando l'HP scende sotto `hpFraction`.
 */
export interface BossPhaseConfig {
  /** Identificatore della fase. */
  readonly phase: BossPhase;
  /**
   * Soglia di HP (0–1) alla quale questa fase inizia.
   * PHASE_1 inizia a 1.0 (inizio scontro), PHASE_2 sotto 0.6, ecc.
   */
  readonly hpFraction: number;
  /** Moltiplicatore velocità di movimento rispetto al valore base. */
  readonly movementSpeedMultiplier: number;
  /** Moltiplicatore danno rispetto al valore base. */
  readonly damageMultiplier: number;
  /**
   * Pattern d'attacco disponibili in questa fase.
   * Valori coerenti con AttackPattern union nel sistema di AI.
   */
  readonly attackPatterns: readonly string[];
  /** Durata minima della fase in tick (evita micro-fasi su burst di danno). */
  readonly minDurationTicks: number;
}

/** Template statico di un boss. */
export interface BossTemplate {
  readonly type:           string;
  readonly name:           string;
  /** Piano in cui appare. Invariante: 5 o 10. */
  readonly floor:          5 | 10;
  readonly maxHp:          number;
  /** Raggio dell'arena in metri. L'area circolare viene bloccata all'ingresso. */
  readonly arenaRadiusM:   number;
  /** Dimensioni del collider capsule (raggio, half-height). */
  readonly colliderRadius:    number;
  readonly colliderHalfHeight: number;
  /** Fasi ordinate dalla prima all'ultima (ordine decrescente di hpFraction). */
  readonly phases:         readonly BossPhaseConfig[];
  /** ID di ricompensa garantita alla sconfitta (loot table). */
  readonly defeatRewards:  readonly string[];
  /** Testo di lore mostrato nella schermata di death (se il giocatore muore). */
  readonly loreQuote:      string;
}

// ── Template KHEPRI_GUARDIAN (piano 5) ───────────────────────────────────────

export const KHEPRI_GUARDIAN: BossTemplate = {
  type:              'KHEPRI_GUARDIAN',
  name:              'Khepri, il Custode',
  floor:             5,
  maxHp:             300,
  arenaRadiusM:      12,
  colliderRadius:    0.8,
  colliderHalfHeight: 0.6,
  phases: [
    {
      phase:                  'INTRO',
      hpFraction:             1.0,
      movementSpeedMultiplier: 0.0,  // immobile durante cutscene
      damageMultiplier:       0.0,
      attackPatterns:         ['BOSS_INTRO_SLAM'],
      minDurationTicks:       90,    // 3 s a 30 tick/s
    },
    {
      phase:                  'PHASE_1',
      hpFraction:             0.99,  // subito dopo l'intro
      movementSpeedMultiplier: 1.0,
      damageMultiplier:       1.0,
      attackPatterns:         [
        'SCARAB_ROLL',       // rotolamento sferico telegrafato
        'DUNG_LUNGE',        // carica rapida in linea retta
        'MANDIBLE_SNAP',     // morso frontale 180°
      ],
      minDurationTicks:       0,
    },
    {
      phase:                  'PHASE_2',
      hpFraction:             0.50,  // a metà HP
      movementSpeedMultiplier: 1.35,
      damageMultiplier:       1.25,
      attackPatterns:         [
        'SCARAB_ROLL',
        'DUNG_LUNGE',
        'MANDIBLE_SNAP',
        'SCARAB_BARRAGE',   // lancia proiettili di scarabei minori
        'WING_SWEEP',       // AoE laterale con le ali
      ],
      minDurationTicks:       0,
    },
    {
      phase:                  'ENRAGE',
      hpFraction:             0.20,  // sotto il 20%
      movementSpeedMultiplier: 1.70,
      damageMultiplier:       1.60,
      attackPatterns:         [
        'SCARAB_ROLL',
        'DUNG_LUNGE',
        'MANDIBLE_SNAP',
        'SCARAB_BARRAGE',
        'WING_SWEEP',
        'SAND_STORM',       // AoE globale, colpisce l'intera arena
      ],
      minDurationTicks:       0,
    },
  ],
  defeatRewards:  ['ANKH_FRAGMENT_KHEPRI', 'KEY_FLOOR_6', 'UPGRADE_SCARAB_SIGHT'],
  loreQuote:      'Anche il sole deve rotolare attraverso l\'oscurità per rinascere.',
};

// ── Template SOBEK_ASCENDANT (piano 10) ──────────────────────────────────────

export const SOBEK_ASCENDANT: BossTemplate = {
  type:              'SOBEK_ASCENDANT',
  name:              'Sobek, il Risvegliato',
  floor:             10,
  maxHp:             600,
  arenaRadiusM:      16,
  colliderRadius:    1.0,
  colliderHalfHeight: 0.8,
  phases: [
    {
      phase:                  'INTRO',
      hpFraction:             1.0,
      movementSpeedMultiplier: 0.0,
      damageMultiplier:       0.0,
      attackPatterns:         ['BOSS_INTRO_ROAR'],
      minDurationTicks:       120,   // 4 s
    },
    {
      phase:                  'PHASE_1',
      hpFraction:             0.99,
      movementSpeedMultiplier: 1.0,
      damageMultiplier:       1.0,
      attackPatterns:         [
        'CROC_BITE',         // morso frontale ad alto danno
        'TAIL_SWIPE',        // spazzata laterale 270°
        'DEATH_ROLL',        // grab + rotazione, inCap il giocatore
      ],
      minDurationTicks:       0,
    },
    {
      phase:                  'PHASE_2',
      hpFraction:             0.65,
      movementSpeedMultiplier: 1.20,
      damageMultiplier:       1.30,
      attackPatterns:         [
        'CROC_BITE',
        'TAIL_SWIPE',
        'DEATH_ROLL',
        'NILE_SURGE',        // onda d'acqua putrefatta che attraversa l'arena
        'SUMMON_SOBEK_SPAWN', // evoca 2 SOBEK_SPAWN minori
      ],
      minDurationTicks:       0,
    },
    {
      phase:                  'ENRAGE',
      hpFraction:             0.30,
      movementSpeedMultiplier: 1.60,
      damageMultiplier:       1.80,
      attackPatterns:         [
        'CROC_BITE',
        'TAIL_SWIPE',
        'DEATH_ROLL',
        'NILE_SURGE',
        'SUMMON_SOBEK_SPAWN',
        'PRIMORDIAL_FLOOD',  // allagamento totale arena, danno per tick
        'EYE_OF_SOBEK',     // raggio occhio che segue il giocatore per 5 s
      ],
      minDurationTicks:       0,
    },
  ],
  defeatRewards:  [
    'CROWN_OF_SOBEK',
    'ANKH_FRAGMENT_SOBEK',
    'TROPHY_CROCODILE_GOD',
    'UNLOCK_NEW_RUN_MODIFIER',
  ],
  loreQuote:      'Il dio delle acque non muore. Aspetta soltanto il prossimo diluvio.',
};

// ── Registro e utilità ────────────────────────────────────────────────────────

/** Mappa type → template per lookup O(1). */
export const BOSS_TEMPLATES: ReadonlyMap<string, BossTemplate> = new Map([
  [KHEPRI_GUARDIAN.type,  KHEPRI_GUARDIAN],
  [SOBEK_ASCENDANT.type,  SOBEK_ASCENDANT],
]);

/**
 * Restituisce il template boss per un dato piano, se esiste.
 * Piani 5 → KHEPRI_GUARDIAN, 10 → SOBEK_ASCENDANT.
 */
export function getBossForFloor(floor: number): BossTemplate | undefined {
  for (const template of BOSS_TEMPLATES.values()) {
    if (template.floor === floor) return template;
  }
  return undefined;
}

/**
 * Piani che contengono un boss (usato da FloorGenerator per non spawnarci nemici
 * ordinari nella stanza boss).
 */
export const BOSS_FLOORS: ReadonlySet<number> = new Set(
  [...BOSS_TEMPLATES.values()].map((t) => t.floor),
);
