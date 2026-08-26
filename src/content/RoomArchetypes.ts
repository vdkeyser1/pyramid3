/**
 * Scopo: registro dei 30 archetipi di stanza della piramide egizia (§11).
 *        Fornisce varietà estrema, credibilità storica/mitologica e
 *        differenziazione deterministica basata su seed, piano e ruolo.
 * Ownership: content (puro, nessuna dipendenza da DOM o Three.js).
 */

import type { RoomRole } from '@/procedural/FloorValidator.js';
import type { CeilingVariant, FloorVariant, PropDensity, RoomTheme } from '@/content/RoomThemes.js';

export type GpuCostTier = 'LOW' | 'MEDIUM' | 'HIGH';
export type ArchetypeRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';

export interface RoomArchetype {
  readonly id: string;
  readonly name: string;
  readonly theme: RoomTheme;
  readonly compatibleRoles: readonly RoomRole[];
  readonly ceiling: CeilingVariant;
  readonly floor: FloorVariant;
  readonly props: PropDensity;
  readonly lightScale: number;
  readonly gpuCost: GpuCostTier;
  readonly rarity: ArchetypeRarity;
  readonly description: string;
  readonly environmentalClues: readonly string[];
}

export const ROOM_ARCHETYPES: readonly RoomArchetype[] = [
  {
    id: 'FUNERARY_CHAMBER',
    name: 'Camera Funeraria',
    theme: 'FUNERARY',
    compatibleRoles: ['TREASURE', 'COMBAT', 'OPTIONAL'],
    ceiling: 'STARRY',
    floor: 'SLABS',
    props: 'NORMAL',
    lightScale: 0.75,
    gpuCost: 'MEDIUM',
    rarity: 'COMMON',
    description: 'Bara antropomorfa circondata da vasi canopi e offerte funerarie per il viaggio nell aldilà.',
    environmentalClues: ['Vasi canopi rovesciati', 'Bende di lino strappate a terra', 'Olio essenziale rappreso'],
  },
  {
    id: 'PHARAOH_HALL',
    name: 'Sala del Faraone',
    theme: 'ROYAL',
    compatibleRoles: ['EXIT', 'TREASURE', 'OPTIONAL'],
    ceiling: 'COFFERED',
    floor: 'SLABS',
    props: 'DENSE',
    lightScale: 1.25,
    gpuCost: 'HIGH',
    rarity: 'RARE',
    description: 'Imponente sala delle udienze reali con decorazioni dorate e doppi scettri.',
    environmentalClues: ['Trono di granito intarsiato', 'Frammenti di foglia d oro', 'Sigilli regali intatti'],
  },
  {
    id: 'STATUE_SANCTUARY',
    name: 'Santuario delle Statue',
    theme: 'SACRED',
    compatibleRoles: ['SAFE', 'ENTRY', 'MAP'],
    ceiling: 'HIGH_VAULT',
    floor: 'SLABS',
    props: 'NORMAL',
    lightScale: 1.35,
    gpuCost: 'MEDIUM',
    rarity: 'UNCOMMON',
    description: 'Simmetria sacra con effigi monolitiche degli dei guardiani e bracieri cerimoniali.',
    environmentalClues: ['Cenere di incenso fredda', 'Offerte votive intatte', 'Geroglifici di purificazione'],
  },
  {
    id: 'TEMPLE_OF_THE_SUN',
    name: 'Tempio del Sole',
    theme: 'SACRED',
    compatibleRoles: ['SAFE', 'EXIT', 'FORGE'],
    ceiling: 'HIGH_VAULT',
    floor: 'SLABS',
    props: 'NORMAL',
    lightScale: 1.4,
    gpuCost: 'MEDIUM',
    rarity: 'UNCOMMON',
    description: 'Santuario dedicato a Ra, con dischi solari e architravi dorati che riflettono la luce.',
    environmentalClues: ['Dischi di bronzo lucidati', 'Altare di calcare bianco', 'Raggi convergenti'],
  },
  {
    id: 'TREASURY_VAULT',
    name: 'Cripta del Tesoro',
    theme: 'TREASURE_VAULT',
    compatibleRoles: ['TREASURE', 'OPTIONAL'],
    ceiling: 'COFFERED',
    floor: 'SLABS',
    props: 'DENSE',
    lightScale: 1.1,
    gpuCost: 'HIGH',
    rarity: 'RARE',
    description: 'Forzieri rinforzati in bronzo, monete d oro sparse e cassettoni intarsiati.',
    environmentalClues: ['Scrigni forzati dai saccheggiatori', 'Monete calpestate nella sabbia', 'Casse intatte'],
  },
  {
    id: 'FORGOTTEN_CRYPT',
    name: 'Cripta Dimenticata',
    theme: 'INFESTED',
    compatibleRoles: ['COMBAT', 'OPTIONAL'],
    ceiling: 'FLAT_STONE',
    floor: 'RUBBLE',
    props: 'DENSE',
    lightScale: 0.6,
    gpuCost: 'LOW',
    rarity: 'COMMON',
    description: 'Luogo di sepoltura secondario con sarcofagi spaccati, ossa e ragnatele millenarie.',
    environmentalClues: ['Ossa frantumate', 'Sarcofago spalancato dall interno', 'Graffi sulla pietra'],
  },
  {
    id: 'SCARAB_NEST',
    name: 'Nido degli Scarabei',
    theme: 'INFESTED',
    compatibleRoles: ['COMBAT', 'OPTIONAL'],
    ceiling: 'FLAT_STONE',
    floor: 'RUBBLE',
    props: 'DENSE',
    lightScale: 0.55,
    gpuCost: 'MEDIUM',
    rarity: 'COMMON',
    description: 'Camera umida e buia dove sciami di scarabei carnivori nidificano tra i detriti.',
    environmentalClues: ['Carapaci vuoti', 'Sabbia scavata a cunicoli', 'Ronzio metallico sordo'],
  },
  {
    id: 'FLOODED_CHAMBER',
    name: 'Camera Sommergibile',
    theme: 'PLAIN',
    compatibleRoles: ['COMBAT', 'OPTIONAL', 'JUNCTION'],
    ceiling: 'BEAMED',
    floor: 'SLABS',
    props: 'SPARSE',
    lightScale: 0.85,
    gpuCost: 'LOW',
    rarity: 'UNCOMMON',
    description: 'Antica cisterna o condotto della falda nilotica con pozzi e stillicidio continuo.',
    environmentalClues: ['Macchie di salnitro', 'Gocciolio ritmico', 'Livello dell acqua segnato sulle pareti'],
  },
  {
    id: 'SAND_DUNE_ROOM',
    name: 'Camera Insabbiata',
    theme: 'SAND_FILLED',
    compatibleRoles: ['COMBAT', 'JUNCTION', 'OPTIONAL'],
    ceiling: 'FLAT_STONE',
    floor: 'DEEP_SAND',
    props: 'SPARSE',
    lightScale: 0.85,
    gpuCost: 'LOW',
    rarity: 'COMMON',
    description: 'Dune di sabbia dorata che ricoprono per metà le colonne e i vasi funerari.',
    environmentalClues: ['Punte di anfore che spuntano dalla duna', 'Cascata di sabbia dal soffitto', 'Impronte recenti'],
  },
  {
    id: 'COLLAPSED_HALL',
    name: 'Sala Crollata',
    theme: 'COLLAPSED',
    compatibleRoles: ['COMBAT', 'OPTIONAL', 'STAIR'],
    ceiling: 'COLLAPSED',
    floor: 'RUBBLE',
    props: 'SPARSE',
    lightScale: 1.15,
    gpuCost: 'MEDIUM',
    rarity: 'COMMON',
    description: 'Soffitto spezzato da terremoti antichi con blocchi monolitici crollati al suolo.',
    environmentalClues: ['Architrave spaccato a metà', 'Polvere in sospensione', 'Fessura verso il buio superiore'],
  },
  {
    id: 'VERTICAL_SHAFT',
    name: 'Pozzo di Discesa',
    theme: 'COLLAPSED',
    compatibleRoles: ['STAIR', 'JUNCTION'],
    ceiling: 'COLLAPSED',
    floor: 'RUBBLE',
    props: 'SPARSE',
    lightScale: 1.1,
    gpuCost: 'LOW',
    rarity: 'UNCOMMON',
    description: 'Pozzo verticale monumentale che collega i livelli della piramide con echi profondi.',
    environmentalClues: ['Spifferi d aria fredda', 'Scale scavate nella roccia viva', 'Corde consumate dal tempo'],
  },
  {
    id: 'TRAP_CORRIDOR',
    name: 'Galleria delle Trappole',
    theme: 'PLAIN',
    compatibleRoles: ['COMBAT', 'JUNCTION'],
    ceiling: 'BEAMED',
    floor: 'SLABS',
    props: 'SPARSE',
    lightScale: 0.9,
    gpuCost: 'MEDIUM',
    rarity: 'COMMON',
    description: 'Passaggio protetto da piastre a pressione con punte in bronzo e lame a pendolo oscillanti.',
    environmentalClues: ['Fessure nelle pareti per le lame', 'Lastre del pavimento disallineate', 'Scheletro con scudo spezzato'],
  },
  {
    id: 'HYPOSTYLE_HALL',
    name: 'Sala Ipostila',
    theme: 'GREAT_GALLERY',
    compatibleRoles: ['COMBAT', 'JUNCTION', 'ENTRY'],
    ceiling: 'BEAMED',
    floor: 'SLABS',
    props: 'NORMAL',
    lightScale: 1.05,
    gpuCost: 'HIGH',
    rarity: 'COMMON',
    description: 'Foresta di colonne monumentali con capitelli a loto e papiro che reggono architravi ciclopici.',
    environmentalClues: ['Bassorilievi di battaglie e conquiste', 'Ombre fitte tra i fusti delle colonne', 'Cartigli reali scolpiti'],
  },
  {
    id: 'PAPYRUS_ARCHIVE',
    name: 'Archivio dei Papiri',
    theme: 'PLAIN',
    compatibleRoles: ['TOOL', 'MAP', 'SAFE'],
    ceiling: 'FLAT_STONE',
    floor: 'SLABS',
    props: 'DENSE',
    lightScale: 1.0,
    gpuCost: 'MEDIUM',
    rarity: 'UNCOMMON',
    description: 'Nicchie scavate nei muri piene di rotoli di papiro, tavole di pietra e strumenti degli scribi.',
    environmentalClues: ['Inchiostro essiccato nei calamai', 'Mappe astronomiche su rotoli', 'Stilo di canna intatto'],
  },
  {
    id: 'NECROPOLIS_VAULT',
    name: 'Necropoli Sotterranea',
    theme: 'FUNERARY',
    compatibleRoles: ['COMBAT', 'OPTIONAL'],
    ceiling: 'STARRY',
    floor: 'SLABS',
    props: 'NORMAL',
    lightScale: 0.7,
    gpuCost: 'MEDIUM',
    rarity: 'COMMON',
    description: 'Serie di cripte con loculi disposti a parete, ciascuno con una stele funeraria.',
    environmentalClues: ['Iscrizioni commemorative', 'Lampade a olio esaurite', 'Sigilli di cera spezzati'],
  },
  {
    id: 'RITUAL_CHAMBER',
    name: 'Camera Rituale',
    theme: 'SACRED',
    compatibleRoles: ['COMBAT', 'FORGE', 'OPTIONAL'],
    ceiling: 'HIGH_VAULT',
    floor: 'SLABS',
    props: 'DENSE',
    lightScale: 1.2,
    gpuCost: 'MEDIUM',
    rarity: 'UNCOMMON',
    description: 'Altare sacrificale con canali per libagioni, bracieri d incenso e geroglifici protettivi.',
    environmentalClues: ['Cerchio di sale e cenere', 'Calice d offerta in rame', 'Simboli magici incisi sul pavimento'],
  },
  {
    id: 'SHRINE_OF_ANUBIS',
    name: 'Santuario di Anubi',
    theme: 'SACRED',
    compatibleRoles: ['SAFE', 'MAP', 'TREASURE'],
    ceiling: 'HIGH_VAULT',
    floor: 'SLABS',
    props: 'NORMAL',
    lightScale: 1.1,
    gpuCost: 'MEDIUM',
    rarity: 'RARE',
    description: 'Statua monumentale dello sciacallo sacro Anubi, protettore della pesatura del cuore.',
    environmentalClues: ['Piuma di Maat scolpita in alabastro', 'Statua di sciacallo in basalto nero', 'Oli di mummificazione'],
  },
  {
    id: 'ANCIENT_PRISON',
    name: 'Celle dei Dannati',
    theme: 'PLUNDERED',
    compatibleRoles: ['COMBAT', 'OPTIONAL'],
    ceiling: 'FLAT_STONE',
    floor: 'RUBBLE',
    props: 'NORMAL',
    lightScale: 0.7,
    gpuCost: 'LOW',
    rarity: 'COMMON',
    description: 'Celle sotterranee dove i violatori di tombe venivano murati vivi con pesanti catene.',
    environmentalClues: ['Anelli di ferro arrugginiti nelle pareti', 'Graffi disperati sulla pietra', 'Scheletro con grimaldello'],
  },
  {
    id: 'LABYRINTH_NODE',
    name: 'Nodo del Labirinto',
    theme: 'PLAIN',
    compatibleRoles: ['JUNCTION', 'COMBAT'],
    ceiling: 'FLAT_STONE',
    floor: 'SAND',
    props: 'SPARSE',
    lightScale: 0.95,
    gpuCost: 'LOW',
    rarity: 'COMMON',
    description: 'Incrocio geometrico progettato dagli architetti reali per disorientare gli intrusi.',
    environmentalClues: ['Segni d orientamento incisi di nascosto', 'Frecce geroglifiche contrastanti', 'Torcia bruciata a terra'],
  },
  {
    id: 'MONUMENTAL_PASSAGE',
    name: 'Galleria Monumentale',
    theme: 'GREAT_GALLERY',
    compatibleRoles: ['ENTRY', 'EXIT', 'JUNCTION'],
    ceiling: 'BEAMED',
    floor: 'SLABS',
    props: 'NORMAL',
    lightScale: 1.05,
    gpuCost: 'MEDIUM',
    rarity: 'COMMON',
    description: 'Corridoio solenne fiancheggiato da pilastri decorati con bassorilievi e architravi continui.',
    environmentalClues: ['Affreschi raffiguranti la processione funeraria', 'Lampade a muro in bronzo', 'Pavimento levigato'],
  },
  {
    id: 'ASTRONOMICAL_OBSERVATORY',
    name: 'Osservatorio Astronomico',
    theme: 'ASTRONOMICAL',
    compatibleRoles: ['MAP', 'SAFE', 'OPTIONAL'],
    ceiling: 'STARRY',
    floor: 'SLABS',
    props: 'NORMAL',
    lightScale: 1.2,
    gpuCost: 'MEDIUM',
    rarity: 'RARE',
    description: 'Camera orientata con la Stella Polare, con volta celeste dipinta e costellazioni egiziane.',
    environmentalClues: ['Rappresentazione di Orione e Sirio', 'Meridiana di pietra sul pavimento', 'Glifi astronomici dorati'],
  },
  {
    id: 'STARRY_CEILING_TOMB',
    name: 'Tomba del Cielo Stellato',
    theme: 'ASTRONOMICAL',
    compatibleRoles: ['TREASURE', 'COMBAT', 'OPTIONAL'],
    ceiling: 'STARRY',
    floor: 'SLABS',
    props: 'DENSE',
    lightScale: 1.15,
    gpuCost: 'MEDIUM',
    rarity: 'UNCOMMON',
    description: 'Soffitto in lapislazzuli con centinaia di stelle a cinque punte e barca solare di Ra.',
    environmentalClues: ['Pigmento blu egizio intatto', 'Sarcofago dorato centrale', 'Iscrizioni del Libro dei Morti'],
  },
  {
    id: 'PITCH_BLACK_CHAMBER',
    name: 'Camera dell Oscurità Cieca',
    theme: 'INFESTED',
    compatibleRoles: ['COMBAT', 'OPTIONAL'],
    ceiling: 'FLAT_STONE',
    floor: 'SAND',
    props: 'SPARSE',
    lightScale: 0.4,
    gpuCost: 'LOW',
    rarity: 'UNCOMMON',
    description: 'Ambiente avvolto nel buio più totale, dove la torcia sembra venire soffocata dall aria.',
    environmentalClues: ['Eco soffocato', 'Sussurri lontani nel buio', 'Pareti lisce che assorbono i riflessi'],
  },
  {
    id: 'SUNLIT_WELL',
    name: 'Camera del Raggio Solare',
    theme: 'COLLAPSED',
    compatibleRoles: ['SAFE', 'ENTRY', 'OPTIONAL'],
    ceiling: 'COLLAPSED',
    floor: 'RUBBLE',
    props: 'SPARSE',
    lightScale: 1.45,
    gpuCost: 'MEDIUM',
    rarity: 'RARE',
    description: 'Fessura nel soffitto da cui penetra un raggio di sole che illumina la polvere dorata.',
    environmentalClues: ['Fascio di luce naturale', 'Erbe secche nate tra le macerie', 'Oasi di luce protetta'],
  },
  {
    id: 'HAUNTED_VAULT',
    name: 'Cripta Infestata dai Ka',
    theme: 'INFESTED',
    compatibleRoles: ['COMBAT', 'OPTIONAL'],
    ceiling: 'STARRY',
    floor: 'RUBBLE',
    props: 'NORMAL',
    lightScale: 0.65,
    gpuCost: 'MEDIUM',
    rarity: 'UNCOMMON',
    description: 'Stanza pervasa da correnti d aria gelida e residui ectoplasmatici degli spiriti Ka irrequieti.',
    environmentalClues: ['Candele spente con fumo residuo', 'Ombre che si muovono senza corpo', 'Brina sottile sulla pietra'],
  },
  {
    id: 'BOSS_ARENA',
    name: 'Arena del Guardiano Eterno',
    theme: 'ROYAL',
    compatibleRoles: ['EXIT', 'COMBAT'],
    ceiling: 'HIGH_VAULT',
    floor: 'SLABS',
    props: 'DENSE',
    lightScale: 1.2,
    gpuCost: 'HIGH',
    rarity: 'LEGENDARY',
    description: 'Spazio colossale per il confronto finale con la Mummia Reale o il Sacerdote Supremo.',
    environmentalClues: ['Bracieri monumentali ai quattro angoli', 'Simboli faraonici monumentali', 'Pavimento cerimoniale intarsiato'],
  },
  {
    id: 'ANIMATED_STATUE_ROOM',
    name: 'Sala dei Guardiani Dormienti',
    theme: 'SACRED',
    compatibleRoles: ['COMBAT', 'TREASURE'],
    ceiling: 'HIGH_VAULT',
    floor: 'SLABS',
    props: 'DENSE',
    lightScale: 1.1,
    gpuCost: 'HIGH',
    rarity: 'RARE',
    description: 'File di statue di guerrieri Shabti pronte a prendere vita quando l intruso si avvicina.',
    environmentalClues: ['Statue con occhi di quarzo lucido', 'Polvere scossa via dai giunti di pietra', 'Armi affilate'],
  },
  {
    id: 'SARCOPHAGUS_GALLERY',
    name: 'Galleria dei Sarcofagi',
    theme: 'FUNERARY',
    compatibleRoles: ['COMBAT', 'TREASURE', 'OPTIONAL'],
    ceiling: 'BEAMED',
    floor: 'SLABS',
    props: 'DENSE',
    lightScale: 0.8,
    gpuCost: 'HIGH',
    rarity: 'COMMON',
    description: 'Lungo allineamento di bare antropomorfe in pietra e legno dorato.',
    environmentalClues: ['Alcuni sarcofagi aperti, altri sigillati', 'Geroglifici con i nomi dei defunti', 'Aromi di resina'],
  },
  {
    id: 'ARCHAEOLOGICAL_DIG',
    name: 'Scavo Archeologico Crollato',
    theme: 'COLLAPSED',
    compatibleRoles: ['TOOL', 'OPTIONAL'],
    ceiling: 'COLLAPSED',
    floor: 'DEEP_SAND',
    props: 'NORMAL',
    lightScale: 1.1,
    gpuCost: 'MEDIUM',
    rarity: 'COMMON',
    description: 'Campo di scavo abbandonato con pale rotte, ceste di vimini e trincee nella sabbia.',
    environmentalClues: ['Pala piantata nella sabbia', 'Cesta di frammenti di terracotta', 'Appunti di uno studioso'],
  },
  {
    id: 'SECRET_TREASURE_ROOM',
    name: 'Camera Segreta di Osiride',
    theme: 'TREASURE_VAULT',
    compatibleRoles: ['TREASURE', 'OPTIONAL'],
    ceiling: 'COFFERED',
    floor: 'SLABS',
    props: 'DENSE',
    lightScale: 1.3,
    gpuCost: 'HIGH',
    rarity: 'LEGENDARY',
    description: 'Stanza segreta inviolata per millenni con reliquiari d oro puro e amuleti Ankh intatti.',
    environmentalClues: ['Nessun granello di polvere sopra l oro', 'Aureola di luce attorno all altare', 'Amuleti di lapislazzuli'],
  },
];

/** Mappa indicizzata per id. */
const ARCHETYPE_BY_ID = new Map<string, RoomArchetype>(
  ROOM_ARCHETYPES.map((a) => [a.id, a]),
);

/** Hash intero deterministico a 32 bit. */
function hash(a: number, b: number): number {
  let h = (a * 0x9e3779b9 + b * 0x85ebca6b) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/**
 * Risolve l'archetipo esatto per una stanza in modo deterministico.
 */
export function resolveRoomArchetype(
  floorIndex: number,
  roomId: number,
  role: RoomRole,
  theme: RoomTheme,
): RoomArchetype {
  // Filtra gli archetipi compatibili con il ruolo o con il tema
  const matching = ROOM_ARCHETYPES.filter(
    (a) => a.theme === theme && a.compatibleRoles.includes(role),
  );

  if (matching.length === 1 && matching[0]) {
    return matching[0];
  }

  const pool = matching.length > 0
    ? matching
    : ROOM_ARCHETYPES.filter((a) => a.compatibleRoles.includes(role));

  const safePool = pool.length > 0 ? pool : ROOM_ARCHETYPES;
  const h = hash(floorIndex * 1013 + roomId, roomId * 43 + floorIndex);
  const index = h % safePool.length;

  return safePool[index] ?? ROOM_ARCHETYPES[0]!;
}

/** Recupera un archetipo per ID. */
export function getRoomArchetypeById(id: string): RoomArchetype | undefined {
  return ARCHETYPE_BY_ID.get(id);
}
