/**
 * Scopo: sistema di Benedizioni Divine degli dei dell'antico Egitto (God Boons).
 *        Offerte agli altari sacri per ottenere favori e poteri passivi/attivi.
 * Ownership: content (puro e deterministico).
 */

import { hash32 } from '@/procedural/Hash32.js';

export type EgyptianDeity = 'RA' | 'ANUBIS' | 'OSIRIS' | 'THOTH' | 'SEKHMET';

export interface DivineBlessing {
  readonly id: string;
  readonly deity: EgyptianDeity;
  readonly name: string;
  readonly epithet: string;
  readonly description: string;
  readonly goldCost: number;
  readonly modifiers: {
    readonly torchLightBonus?: number;
    readonly fireDamageBonus?: number;
    readonly parryWindowBonusMs?: number;
    readonly kaRecoveryOnKill?: number;
    readonly maxHpMultiplier?: number;
    readonly staminaCostMultiplier?: number;
    readonly trapDetectionRadiusM?: number;
    readonly berserkDamageThresholdHpFraction?: number;
    readonly berserkDamageBonus?: number;
  };
}

export const DIVINE_BLESSINGS: readonly DivineBlessing[] = [
  {
    id: 'BLESSING_RA_SOLAR_MIGHT',
    deity: 'RA',
    name: 'Fiamma del Sole Nascente',
    epithet: 'Il Signore del Disco Dorato',
    description: 'La luce della tua torcia splende con il calore del sole e infligge danni da fuoco ad ogni fendente.',
    goldCost: 45,
    modifiers: {
      torchLightBonus: 1.35,
      fireDamageBonus: 6,
    },
  },
  {
    id: 'BLESSING_ANUBIS_JUDGMENT',
    deity: 'ANUBIS',
    name: 'Giudizio della Pesa',
    epithet: 'Il Guardiano della Bilancia',
    description: 'La finestra di parry viene estesa e ogni nemico abbattuto ripristina un frammento dell anima Ka.',
    goldCost: 40,
    modifiers: {
      parryWindowBonusMs: 80,
      kaRecoveryOnKill: 15,
    },
  },
  {
    id: 'BLESSING_OSIRIS_RESURRECTION',
    deity: 'OSIRIS',
    name: 'Soffio dell Oltretomba',
    epithet: 'Il Sovrano della Rinascita',
    description: 'Aumenta i punti vita massimi del 25% e dimezza il consumo di fiato durante lo scatto.',
    goldCost: 50,
    modifiers: {
      maxHpMultiplier: 1.25,
      staminaCostMultiplier: 0.5,
    },
  },
  {
    id: 'BLESSING_THOTH_WISDOM',
    deity: 'THOTH',
    name: 'Occhio del Sapiente',
    epithet: 'Lo Scriba degli Dei',
    description: 'Rileva automaticamente la presenza di trappole, sarcofagi sigillati e cripte segrete prima di entrare.',
    goldCost: 35,
    modifiers: {
      trapDetectionRadiusM: 14,
    },
  },
  {
    id: 'BLESSING_SEKHMET_WRATH',
    deity: 'SEKHMET',
    name: 'Furia della Leonessa',
    epithet: 'La Dea della Vendetta',
    description: 'Quando la tua salute scende sotto il 40%, i tuoi attacchi infliggono il 35% di danno addizionale.',
    goldCost: 50,
    modifiers: {
      berserkDamageThresholdHpFraction: 0.40,
      berserkDamageBonus: 0.35,
    },
  },
];

const BLESSING_BY_ID = new Map<string, DivineBlessing>(
  DIVINE_BLESSINGS.map((b) => [b.id, b]),
);

/**
 * Seleziona deterministicamente due benedizioni disponibili per un altare sacro.
 */
export function getAltarBlessingOfferings(
  seed: number,
  floorIndex: number,
): readonly [DivineBlessing, DivineBlessing] {
  const h1 = hash32(seed * 733 + floorIndex * 97, 0xcafe);
  const h2 = hash32(seed * 521 + floorIndex * 131, 0xbabe);

  const idx1 = h1 % DIVINE_BLESSINGS.length;
  let idx2 = h2 % DIVINE_BLESSINGS.length;
  if (idx2 === idx1) {
    idx2 = (idx2 + 1) % DIVINE_BLESSINGS.length;
  }

  const b1 = DIVINE_BLESSINGS[idx1] ?? DIVINE_BLESSINGS[0]!;
  const b2 = DIVINE_BLESSINGS[idx2] ?? DIVINE_BLESSINGS[1]!;

  return [b1, b2];
}

export function getDivineBlessingById(id: string): DivineBlessing | undefined {
  return BLESSING_BY_ID.get(id);
}
