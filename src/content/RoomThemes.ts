/**
 * ART-004 — Temi delle stanze.
 *
 * Scopo: dare varietà visiva senza moltiplicare gli asset. Il tema è
 *        ORTOGONALE al ruolo: `RoomRole` dice cosa la stanza *fa*
 *        (ENTRY, COMBAT, TREASURE…), `RoomTheme` dice cosa le è *successo*
 *        (saccheggiata, crollata, allagata…). Una camera del tesoro ROYAL e
 *        una PLUNDERED condividono la pianta e non condividono nulla d'altro.
 *
 * Ownership: contenuto immutabile. Modulo PURO — nessun import di THREE
 *        (boundary constraint del livello content/).
 *
 * Invarianti:
 *   - la scelta del tema è deterministica da (floorIndex, roomId): stesso
 *     seed ⇒ stesso piano, nessun Math.random;
 *   - ogni ruolo dichiara i temi ammessi: una stanza d'ingresso non può
 *     essere allagata, o il giocatore inizierebbe sott'acqua;
 *   - i moltiplicatori sono relativi al preset base, mai valori assoluti.
 *
 * Failure mode: nessuno a runtime — RoomRole è un'unione chiusa e la tabella
 *   dei temi ammessi la copre interamente, quindi ogni ruolo ha una risposta.
 */

import type { RoomRole } from '@/procedural/FloorValidator.js';

/** Stato narrativo della stanza. */
export type RoomTheme =
  /** Nessuna alterazione: pietra nuda, il fondo neutro su cui spiccano gli altri. */
  | 'PLAIN'
  /** Zona nobile: decorazioni dense, oro, soffitto stellato. */
  | 'ROYAL'
  /** Funeraria: sarcofagi, canopi, luce bassa. */
  | 'FUNERARY'
  /** Crollata: detriti, soffitto rotto, luce dall'alto. */
  | 'COLLAPSED'
  /** Invasa dalla sabbia: pavimento alto, props semisepolti. */
  | 'SAND_FILLED'
  /** Saccheggiata: casse aperte, tesoro sparso, tracce di violenza. */
  | 'PLUNDERED'
  /** Sacra: altari, simmetria, silenzio, luce dorata. */
  | 'SACRED'
  /** Infestata: scarabei, ragnatele, ossa. */
  | 'INFESTED';

/** Variante del soffitto. */
export type CeilingVariant = 'FLAT_STONE' | 'STARRY' | 'COLLAPSED' | 'HIGH_VAULT';
/** Variante del pavimento. */
export type FloorVariant = 'SAND' | 'SLABS' | 'RUBBLE' | 'DEEP_SAND';
/** Densità delle decorazioni. */
export type PropDensity = 'NONE' | 'SPARSE' | 'NORMAL' | 'DENSE';

export interface ThemePreset {
  readonly theme: RoomTheme;
  readonly ceiling: CeilingVariant;
  readonly floor: FloorVariant;
  readonly props: PropDensity;
  /**
   * Moltiplicatore della luce dei bracieri, relativo al preset base.
   * < 1 = più buia. Non è un valore assoluto: il tier di qualità e le
   * maledizioni agiscono comunque sopra.
   */
  readonly lightScale: number;
  /** Colonne presenti? Le stanze crollate o insabbiate ne hanno meno. */
  readonly columns: boolean;
  /** Etichetta per debug e HUD. */
  readonly label: string;
}

const PRESETS: Record<RoomTheme, ThemePreset> = {
  PLAIN: {
    theme: 'PLAIN', ceiling: 'FLAT_STONE', floor: 'SAND', props: 'SPARSE',
    lightScale: 1.0, columns: true, label: 'Camera spoglia',
  },
  ROYAL: {
    theme: 'ROYAL', ceiling: 'STARRY', floor: 'SLABS', props: 'DENSE',
    lightScale: 1.25, columns: true, label: 'Sala reale',
  },
  FUNERARY: {
    theme: 'FUNERARY', ceiling: 'STARRY', floor: 'SLABS', props: 'NORMAL',
    lightScale: 0.75, columns: true, label: 'Camera funeraria',
  },
  COLLAPSED: {
    // Il soffitto rotto lascia entrare luce dall'alto: più chiara del normale
    // nonostante l'abbandono.
    theme: 'COLLAPSED', ceiling: 'COLLAPSED', floor: 'RUBBLE', props: 'SPARSE',
    lightScale: 1.15, columns: false, label: 'Sala crollata',
  },
  SAND_FILLED: {
    theme: 'SAND_FILLED', ceiling: 'FLAT_STONE', floor: 'DEEP_SAND', props: 'SPARSE',
    lightScale: 0.85, columns: false, label: 'Camera insabbiata',
  },
  PLUNDERED: {
    theme: 'PLUNDERED', ceiling: 'FLAT_STONE', floor: 'SLABS', props: 'NORMAL',
    lightScale: 0.9, columns: true, label: 'Camera saccheggiata',
  },
  SACRED: {
    theme: 'SACRED', ceiling: 'HIGH_VAULT', floor: 'SLABS', props: 'NORMAL',
    lightScale: 1.35, columns: true, label: 'Santuario',
  },
  INFESTED: {
    theme: 'INFESTED', ceiling: 'FLAT_STONE', floor: 'RUBBLE', props: 'DENSE',
    lightScale: 0.6, columns: true, label: 'Camera infestata',
  },
};

/**
 * Temi ammessi per ruolo.
 *
 * Il vincolo è di gameplay, non estetico: l'ingresso e le stanze sicure
 * devono restare leggibili e percorribili, quindi non possono essere
 * crollate o infestate. Le stanze di combattimento hanno la gamma più ampia
 * perché sono la maggioranza e vanno differenziate il più possibile.
 */
const ALLOWED: Record<RoomRole, readonly RoomTheme[]> = {
  ENTRY:    ['PLAIN', 'SACRED'],
  EXIT:     ['PLAIN', 'ROYAL', 'SACRED'],
  SAFE:     ['PLAIN', 'SACRED'],
  COMBAT:   ['PLAIN', 'FUNERARY', 'COLLAPSED', 'SAND_FILLED', 'PLUNDERED', 'INFESTED'],
  TOOL:     ['PLAIN', 'PLUNDERED', 'COLLAPSED'],
  MAP:      ['PLAIN', 'FUNERARY', 'SACRED'],
  TREASURE: ['ROYAL', 'FUNERARY', 'PLUNDERED'],
  FORGE:    ['PLAIN', 'SACRED'],
  OPTIONAL: ['COLLAPSED', 'SAND_FILLED', 'INFESTED', 'PLUNDERED'],
  JUNCTION: ['PLAIN', 'SAND_FILLED', 'COLLAPSED'],
  STAIR:    ['PLAIN', 'COLLAPSED'],
};

/** Hash intero a 32 bit, stessa famiglia usata altrove nel progetto. */
function hash(a: number, b: number): number {
  let h = (a * 0x9e3779b9 + b * 0x85ebca6b) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/**
 * Sceglie il tema di una stanza in modo deterministico.
 *
 * Scendendo, i temi di abbandono diventano più probabili: i piani alti sono
 * le zone nobili della piramide, quelli profondi sono cripte dimenticate.
 * L'inclinazione si ottiene scartando il primo tema ammesso (sempre il più
 * "in ordine") con probabilità crescente, non con una tabella per piano.
 */
export function themeForRoom(
  floorIndex: number,
  roomId: number,
  role: RoomRole,
): RoomTheme {
  // ALLOWED copre tutti i valori di RoomRole (unione chiusa), quindi non
  // serve un ramo per ruolo sconosciuto: TypeScript lo garantisce.
  const allowed = ALLOWED[role];
  if (allowed.length === 1) return allowed[0] ?? 'PLAIN';

  const h = hash(floorIndex * 977 + roomId, roomId * 31 + floorIndex);
  let index = h % allowed.length;

  // Bias di profondità: sui piani bassi il primo tema (quello "integro")
  // viene scartato più spesso a favore dei successivi.
  const depth = Math.max(0, Math.min(1, (floorIndex - 1) / 9));
  if (index === 0 && depth > 0.35) {
    const roll = ((h >>> 8) % 100) / 100;
    if (roll < depth) index = 1 + ((h >>> 16) % (allowed.length - 1));
  }

  return allowed[index] ?? 'PLAIN';
}

/** Preset completo di un tema. */
export function presetFor(theme: RoomTheme): ThemePreset {
  return PRESETS[theme];
}

/** Tutti i temi definiti — usato dai test e dagli strumenti di debug. */
export const ALL_THEMES: readonly RoomTheme[] = Object.keys(PRESETS) as RoomTheme[];

/** Temi ammessi per un ruolo — usato dai test. */
export function allowedThemesFor(role: RoomRole): readonly RoomTheme[] {
  return ALLOWED[role];
}
