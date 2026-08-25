/**
 * G-05 — Stanze speciali pre-progettate.
 *
 * Scopo: catalogo di layout fissi che il FloorGenerator può inserire
 *        al posto di stanze procedurali per spezzare la monotonia e
 *        garantire punti di interesse narrativi.
 * Ownership: contenuto immutabile. Consumato da FloorGenerator e dal
 *            renderer di stanze (DungeonTileAssembler).
 *
 * Tipi di stanza speciale:
 *   ARMORY    — arsenale con rack di armi e supporto al combattimento
 *   TREASURY  — tesoreria con reliquie e trappole protettive
 *   SHRINE    — santuario con altare per offerte e upgrade HP
 *   VAULT     — cripta sigillata con boss minori e loot raro
 *   LIBRARY   — biblioteca con papiri leggibili (lore + hint)
 *
 * Invarianti:
 *   - ogni template ha una priorità di apparizione (minFloor, maxFloor);
 *   - i punti di spawn non si sovrappongono tra loro;
 *   - ogni stanza ha esattamente un punto di ingresso e uno di uscita.
 */

// ── Tipi ─────────────────────────────────────────────────────────────────────

/** Categorie di stanze speciali disponibili. */
export type SpecialRoomKind =
  | 'ARMORY'
  | 'TREASURY'
  | 'SHRINE'
  | 'VAULT'
  | 'LIBRARY';

/** Punto 2D nel piano della stanza (unità: tile, 1 tile = 1 m). */
export interface TilePoint {
  readonly x: number;
  readonly y: number;
}

/** Rettangolo AABB in tile. */
export interface TileRect {
  readonly x:      number;
  readonly y:      number;
  readonly width:  number;
  readonly height: number;
}

/** Definizione di un singolo elemento di prop/arredo nella stanza. */
export interface RoomProp {
  readonly propId:   string;       // ID del prefab 3D
  readonly position: TilePoint;
  readonly rotation: 0 | 90 | 180 | 270;  // gradi
  readonly scale:    number;       // fattore di scala (1 = default)
}

/** Punto di spawn per oggetti del loot table. */
export interface LootSpawnPoint {
  readonly position:    TilePoint;
  readonly lootTableId: string;    // ID tabella loot (risolto da LootResolver)
  readonly guaranteed:  boolean;   // se true l'oggetto è sempre presente
}

/** Punto di spawn per nemici di guardia. */
export interface GuardSpawnPoint {
  readonly position:    TilePoint;
  readonly enemyType:   string;    // es. 'MUMMY', 'PRIEST'
  readonly patrolArea?: TileRect;  // area di pattugliamento opzionale
}

/** Template completo di una stanza speciale. */
export interface SpecialRoomTemplate {
  readonly id:              string;
  readonly kind:            SpecialRoomKind;
  readonly displayName:     string;
  readonly description:     string;
  /** Dimensioni della stanza in tile. */
  readonly bounds:          TileRect;
  /** Punto di ingresso (allineato a parete). */
  readonly entryPoint:      TilePoint;
  /** Punto di uscita (può coincidere con entryPoint se non c'è uscita separata). */
  readonly exitPoint:       TilePoint;
  /** Piano minimo in cui può apparire (1-based). */
  readonly minFloor:        number;
  /** Piano massimo in cui può apparire. */
  readonly maxFloor:        number;
  /** Peso di selezione casuale (valore più alto = più frequente). */
  readonly spawnWeight:     number;
  /** Arredi e decorazioni fissi. */
  readonly props:           readonly RoomProp[];
  /** Punti di spawn del loot. */
  readonly lootSpawns:      readonly LootSpawnPoint[];
  /** Nemici di guardia presenti alla generazione. */
  readonly guardSpawns:     readonly GuardSpawnPoint[];
  /** Musica ambientale specifica (vuoto = usa tema del piano). */
  readonly ambienceTrackId: string;
}

// ── Template ARMORY ───────────────────────────────────────────────────────────

const ARMORY_SMALL: SpecialRoomTemplate = {
  id:           'ARMORY_SMALL',
  kind:         'ARMORY',
  displayName:  'Arsenale delle Guardie',
  description:  'Un arsenale abbandonato. Le armi sono ancora sui rack — alcune sono ancora utili.',
  bounds:       { x: 0, y: 0, width: 10, height: 8 },
  entryPoint:   { x: 0,  y: 4 },
  exitPoint:    { x: 10, y: 4 },
  minFloor:     1,
  maxFloor:     10,
  spawnWeight:  10,
  props: [
    { propId: 'WEAPON_RACK_SPEAR', position: { x: 2, y: 1 }, rotation: 0,   scale: 1.0 },
    { propId: 'WEAPON_RACK_SWORD', position: { x: 2, y: 6 }, rotation: 0,   scale: 1.0 },
    { propId: 'SHIELD_WALL',       position: { x: 5, y: 0 }, rotation: 90,  scale: 1.0 },
    { propId: 'TRAINING_DUMMY',    position: { x: 7, y: 4 }, rotation: 180, scale: 1.0 },
    { propId: 'TORCH_BRACKET',     position: { x: 1, y: 0 }, rotation: 0,   scale: 0.8 },
    { propId: 'TORCH_BRACKET',     position: { x: 9, y: 0 }, rotation: 0,   scale: 0.8 },
  ],
  lootSpawns: [
    { position: { x: 2, y: 1 }, lootTableId: 'LT_WEAPON_COMMON',  guaranteed: true  },
    { position: { x: 2, y: 6 }, lootTableId: 'LT_WEAPON_RARE',    guaranteed: false },
    { position: { x: 8, y: 7 }, lootTableId: 'LT_CONSUMABLE_AMMO', guaranteed: false },
  ],
  guardSpawns: [
    { position: { x: 5, y: 4 }, enemyType: 'MUMMY', patrolArea: { x: 3, y: 2, width: 4, height: 4 } },
  ],
  ambienceTrackId: '',
};

const ARMORY_LARGE: SpecialRoomTemplate = {
  id:           'ARMORY_LARGE',
  kind:         'ARMORY',
  displayName:  'Grande Arsenale Reale',
  description:  'L\'arsenale del faraone. Anni di ricchezza militare ora custoditi dai non-morti.',
  bounds:       { x: 0, y: 0, width: 14, height: 12 },
  entryPoint:   { x: 0,  y: 6 },
  exitPoint:    { x: 14, y: 6 },
  minFloor:     4,
  maxFloor:     10,
  spawnWeight:  5,
  props: [
    { propId: 'WEAPON_RACK_SPEAR',   position: { x: 2,  y: 1  }, rotation: 0,  scale: 1.0 },
    { propId: 'WEAPON_RACK_SPEAR',   position: { x: 2,  y: 10 }, rotation: 0,  scale: 1.0 },
    { propId: 'WEAPON_RACK_SWORD',   position: { x: 6,  y: 1  }, rotation: 0,  scale: 1.0 },
    { propId: 'WEAPON_RACK_BOW',     position: { x: 6,  y: 10 }, rotation: 0,  scale: 1.0 },
    { propId: 'ARMOR_STAND_ROYAL',   position: { x: 10, y: 3  }, rotation: 0,  scale: 1.0 },
    { propId: 'ARMOR_STAND_ROYAL',   position: { x: 10, y: 8  }, rotation: 0,  scale: 1.0 },
    { propId: 'PHARAOH_STATUE',      position: { x: 12, y: 6  }, rotation: 180, scale: 1.5 },
    { propId: 'TORCH_BRACKET',       position: { x: 1,  y: 0  }, rotation: 0,  scale: 0.8 },
    { propId: 'TORCH_BRACKET',       position: { x: 7,  y: 0  }, rotation: 0,  scale: 0.8 },
    { propId: 'TORCH_BRACKET',       position: { x: 13, y: 0  }, rotation: 0,  scale: 0.8 },
  ],
  lootSpawns: [
    { position: { x: 2,  y: 1  }, lootTableId: 'LT_WEAPON_COMMON',   guaranteed: true  },
    { position: { x: 2,  y: 10 }, lootTableId: 'LT_WEAPON_UNCOMMON', guaranteed: true  },
    { position: { x: 6,  y: 1  }, lootTableId: 'LT_WEAPON_RARE',     guaranteed: false },
    { position: { x: 6,  y: 10 }, lootTableId: 'LT_WEAPON_RARE',     guaranteed: false },
    { position: { x: 13, y: 6  }, lootTableId: 'LT_WEAPON_EPIC',     guaranteed: false },
  ],
  guardSpawns: [
    { position: { x: 4,  y: 3  }, enemyType: 'MUMMY',  patrolArea: { x: 2, y: 1, width: 4, height: 4 } },
    { position: { x: 4,  y: 8  }, enemyType: 'SHABTI', patrolArea: { x: 2, y: 7, width: 4, height: 4 } },
    { position: { x: 11, y: 6  }, enemyType: 'PRIEST'  },
  ],
  ambienceTrackId: 'AMB_ARMORY',
};

// ── Template TREASURY ─────────────────────────────────────────────────────────

const TREASURY_CURSED: SpecialRoomTemplate = {
  id:           'TREASURY_CURSED',
  kind:         'TREASURY',
  displayName:  'Tesoreria Maledetta',
  description:  'L\'oro chiama. Ma ogni moneta ha il suo prezzo.',
  bounds:       { x: 0, y: 0, width: 10, height: 10 },
  entryPoint:   { x: 0, y: 5 },
  exitPoint:    { x: 0, y: 5 },  // uscita = entrata (stanza laterale)
  minFloor:     2,
  maxFloor:     10,
  spawnWeight:  8,
  props: [
    { propId: 'TREASURE_CHEST_GOLD',   position: { x: 7, y: 5 }, rotation: 180, scale: 1.2 },
    { propId: 'TREASURE_CHEST_SMALL',  position: { x: 5, y: 2 }, rotation: 0,   scale: 1.0 },
    { propId: 'TREASURE_CHEST_SMALL',  position: { x: 5, y: 7 }, rotation: 0,   scale: 1.0 },
    { propId: 'GOLD_PILE',             position: { x: 8, y: 3 }, rotation: 0,   scale: 1.0 },
    { propId: 'GOLD_PILE',             position: { x: 8, y: 7 }, rotation: 0,   scale: 1.0 },
    { propId: 'CANOPIC_JAR',           position: { x: 3, y: 2 }, rotation: 0,   scale: 0.8 },
    { propId: 'CANOPIC_JAR',           position: { x: 3, y: 7 }, rotation: 0,   scale: 0.8 },
    { propId: 'PRESSURE_PLATE_TRAP',   position: { x: 4, y: 5 }, rotation: 0,   scale: 1.0 },
    { propId: 'PRESSURE_PLATE_TRAP',   position: { x: 6, y: 3 }, rotation: 0,   scale: 1.0 },
    { propId: 'PRESSURE_PLATE_TRAP',   position: { x: 6, y: 7 }, rotation: 0,   scale: 1.0 },
  ],
  lootSpawns: [
    { position: { x: 7, y: 5 }, lootTableId: 'LT_RELIC_RARE',    guaranteed: true  },
    { position: { x: 5, y: 2 }, lootTableId: 'LT_GOLD_MEDIUM',   guaranteed: true  },
    { position: { x: 5, y: 7 }, lootTableId: 'LT_CONSUMABLE_MIX', guaranteed: false },
  ],
  guardSpawns: [
    { position: { x: 9, y: 5 }, enemyType: 'ROYAL_MUMMY' },
  ],
  ambienceTrackId: 'AMB_TREASURY',
};

const TREASURY_SEALED: SpecialRoomTemplate = {
  id:           'TREASURY_SEALED',
  kind:         'TREASURY',
  displayName:  'Camera Sigillata del Faraone',
  description:  'Sigillata per millenni. Il faraone non si aspettava che tu arrivessi fin qui.',
  bounds:       { x: 0, y: 0, width: 8, height: 8 },
  entryPoint:   { x: 0, y: 4 },
  exitPoint:    { x: 0, y: 4 },
  minFloor:     5,
  maxFloor:     10,
  spawnWeight:  4,
  props: [
    { propId: 'SARCOPHAGUS_GOLD',      position: { x: 5, y: 4 }, rotation: 90,  scale: 1.5 },
    { propId: 'CANOPIC_SET',           position: { x: 3, y: 2 }, rotation: 0,   scale: 1.0 },
    { propId: 'CANOPIC_SET',           position: { x: 3, y: 5 }, rotation: 0,   scale: 1.0 },
    { propId: 'HIEROGLYPH_WALL_PANEL', position: { x: 7, y: 2 }, rotation: 270, scale: 1.0 },
    { propId: 'HIEROGLYPH_WALL_PANEL', position: { x: 7, y: 5 }, rotation: 270, scale: 1.0 },
    { propId: 'OIL_LAMP_ORNATE',       position: { x: 1, y: 1 }, rotation: 0,   scale: 1.0 },
    { propId: 'OIL_LAMP_ORNATE',       position: { x: 1, y: 6 }, rotation: 0,   scale: 1.0 },
  ],
  lootSpawns: [
    { position: { x: 5, y: 4 }, lootTableId: 'LT_RELIC_EPIC',   guaranteed: true },
    { position: { x: 3, y: 2 }, lootTableId: 'LT_CANOPIC_RELIC', guaranteed: true },
  ],
  guardSpawns: [],
  ambienceTrackId: 'AMB_PHARAOH_TOMB',
};

// ── Template SHRINE ───────────────────────────────────────────────────────────

const SHRINE_ANUBIS: SpecialRoomTemplate = {
  id:           'SHRINE_ANUBIS',
  kind:         'SHRINE',
  displayName:  'Santuario di Anubi',
  description:  'Offri sangue e l\'Insopportabile può diventare sopportabile.',
  bounds:       { x: 0, y: 0, width: 8, height: 8 },
  entryPoint:   { x: 0, y: 4 },
  exitPoint:    { x: 8, y: 4 },
  minFloor:     1,
  maxFloor:     10,
  spawnWeight:  12,
  props: [
    { propId: 'ANUBIS_ALTAR',     position: { x: 5, y: 4 }, rotation: 180, scale: 1.3 },
    { propId: 'ANUBIS_STATUE',    position: { x: 6, y: 2 }, rotation: 225 as (0 | 90 | 180 | 270), scale: 1.0 },
    { propId: 'ANUBIS_STATUE',    position: { x: 6, y: 5 }, rotation: 135 as (0 | 90 | 180 | 270), scale: 1.0 },
    { propId: 'OFFERING_BOWL',    position: { x: 4, y: 4 }, rotation: 0,   scale: 0.8 },
    { propId: 'INCENSE_BURNER',   position: { x: 3, y: 2 }, rotation: 0,   scale: 0.7 },
    { propId: 'INCENSE_BURNER',   position: { x: 3, y: 5 }, rotation: 0,   scale: 0.7 },
    { propId: 'PAPYRUS_SCROLL',   position: { x: 1, y: 2 }, rotation: 0,   scale: 0.6 },
    { propId: 'PAPYRUS_SCROLL',   position: { x: 1, y: 5 }, rotation: 0,   scale: 0.6 },
  ],
  lootSpawns: [],  // il santuario non ha loot diretto — la ricompensa è l'interazione con l'altare
  guardSpawns: [],
  ambienceTrackId: 'AMB_SHRINE',
};

const SHRINE_RA: SpecialRoomTemplate = {
  id:           'SHRINE_RA',
  kind:         'SHRINE',
  displayName:  'Tempio della Luce di Ra',
  description:  'Il dio sole ancora irradia potere anche nelle profondità oscure.',
  bounds:       { x: 0, y: 0, width: 10, height: 10 },
  entryPoint:   { x: 0, y: 5 },
  exitPoint:    { x: 10, y: 5 },
  minFloor:     3,
  maxFloor:     10,
  spawnWeight:  7,
  props: [
    { propId: 'RA_ALTAR_SUN',    position: { x: 6, y: 5 }, rotation: 180, scale: 1.5 },
    { propId: 'SUN_DISK',        position: { x: 8, y: 5 }, rotation: 0,   scale: 2.0 },
    { propId: 'RA_STATUE',       position: { x: 6, y: 2 }, rotation: 225 as (0 | 90 | 180 | 270), scale: 1.0 },
    { propId: 'RA_STATUE',       position: { x: 6, y: 7 }, rotation: 135 as (0 | 90 | 180 | 270), scale: 1.0 },
    { propId: 'PILLAR_ORNATE',   position: { x: 3, y: 1 }, rotation: 0,   scale: 1.0 },
    { propId: 'PILLAR_ORNATE',   position: { x: 3, y: 8 }, rotation: 0,   scale: 1.0 },
    { propId: 'TORCH_GOLD',      position: { x: 1, y: 1 }, rotation: 0,   scale: 1.0 },
    { propId: 'TORCH_GOLD',      position: { x: 1, y: 8 }, rotation: 0,   scale: 1.0 },
    { propId: 'TORCH_GOLD',      position: { x: 9, y: 1 }, rotation: 0,   scale: 1.0 },
    { propId: 'TORCH_GOLD',      position: { x: 9, y: 8 }, rotation: 0,   scale: 1.0 },
  ],
  lootSpawns: [
    { position: { x: 7, y: 3 }, lootTableId: 'LT_RA_BLESSING', guaranteed: false },
    { position: { x: 7, y: 7 }, lootTableId: 'LT_RA_BLESSING', guaranteed: false },
  ],
  guardSpawns: [],
  ambienceTrackId: 'AMB_TEMPLE_RA',
};

// ── Registro globale ──────────────────────────────────────────────────────────

/** Tutti i template registrati, in ordine di peso decrescente. */
export const SPECIAL_ROOM_TEMPLATES: readonly SpecialRoomTemplate[] = [
  ARMORY_SMALL,
  ARMORY_LARGE,
  TREASURY_CURSED,
  TREASURY_SEALED,
  SHRINE_ANUBIS,
  SHRINE_RA,
];

/** Lookup per ID. */
export const SPECIAL_ROOM_BY_ID: ReadonlyMap<string, SpecialRoomTemplate> = new Map(
  SPECIAL_ROOM_TEMPLATES.map((t) => [t.id, t]),
);

// ── Selezione casuale ─────────────────────────────────────────────────────────

/**
 * Restituisce i template compatibili con il piano corrente, ordinati per peso.
 *
 * @param floorIndex - Piano corrente (1-based).
 * @param kind       - Filtra per tipo (opzionale).
 */
export function getAvailableSpecialRooms(
  floorIndex: number,
  kind?: SpecialRoomKind,
): readonly SpecialRoomTemplate[] {
  return SPECIAL_ROOM_TEMPLATES.filter(
    (t) =>
      t.minFloor <= floorIndex &&
      t.maxFloor >= floorIndex &&
      (kind == null || t.kind === kind),
  );
}

/**
 * Seleziona una stanza speciale con probabilità proporzionale al suo peso.
 * Utilizza un generatore di numeri casuali esterno (no Math.random() diretto)
 * per garantire la determinabilità in test e con seed.
 *
 * @param floorIndex - Piano corrente.
 * @param rng        - Funzione che restituisce un float in [0, 1).
 * @param kind       - Filtra per tipo (opzionale).
 * @returns Il template selezionato, o undefined se nessuno è disponibile.
 */
export function pickSpecialRoom(
  floorIndex: number,
  rng:        () => number,
  kind?:      SpecialRoomKind,
): SpecialRoomTemplate | undefined {
  const candidates = getAvailableSpecialRooms(floorIndex, kind);
  if (candidates.length === 0) return undefined;

  const totalWeight = candidates.reduce((sum, t) => sum + t.spawnWeight, 0);
  let roll = rng() * totalWeight;

  for (const template of candidates) {
    roll -= template.spawnWeight;
    if (roll <= 0) return template;
  }

  // Fallback: ultimo in lista (rounding)
  return candidates[candidates.length - 1];
}
