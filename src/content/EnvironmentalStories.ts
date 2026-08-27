/**
 * Scopo: database di 50+ micro-scenari di environmental storytelling egizio (P10).
 *        Permette di raccontare visivamente la storia millenaria della piramide
 *        (saccheggiatori caduti nelle trappole, riti funerari interrotti,
 *        sigilli violati, crolli e presenze soprannaturali).
 * Ownership: content (puro e deterministico).
 */

import type { RoomRole } from '@/procedural/FloorValidator.js';
import type { RoomTheme } from '@/content/RoomThemes.js';
import { hash32 } from '@/procedural/Hash32.js';

export type StoryCategory =
  | 'SACRILEGE_AND_THEFT'
  | 'RITUAL_AND_WORSHIP'
  | 'DEATH_AND_MUMMIFICATION'
  | 'CATASTROPHE_AND_COLLAPSE'
  | 'ASTRONOMICAL_AND_MYSTIC'
  | 'CURSE_OF_THE_PHARAOHS';

export interface EnvironmentalStory {
  readonly id: string;
  readonly category: StoryCategory;
  readonly title: string;
  readonly narrativeClue: string;
  readonly requiredProps: readonly string[];
  readonly atmosphereTintHex?: number;
  readonly lightModifier?: number;
}

export const ENVIRONMENTAL_STORIES: readonly EnvironmentalStory[] = [
  // ── SACRILEGE AND THEFT (1-10) ───────────────────────────────────────────
  {
    id: 'THIEF_CRUSHED_BY_SLAB',
    category: 'SACRILEGE_AND_THEFT',
    title: 'Il Ladro Schiacciato',
    narrativeClue: 'Uno scheletro antico giace sotto una pesante lastra di granito caduta dal soffitto, con un sacchetto di monete d oro ancora serrato nelle falangi.',
    requiredProps: ['skeleton', 'rubble', 'goldCoin'],
  },
  {
    id: 'FORCED_CHEST_AND_TOOLS',
    category: 'SACRILEGE_AND_THEFT',
    title: 'Cassa Forzata',
    narrativeClue: 'Un forziere in legno di cedro forzato a colpi di scalpello di bronzo, con frammenti di metallo e perle di corniola sparse a terra.',
    requiredProps: ['chest_broken', 'bronze_chisel', 'beads'],
  },
  {
    id: 'ABANDONED_THIEF_CAMP',
    category: 'SACRILEGE_AND_THEFT',
    title: 'Bivacco dei Predatori',
    narrativeClue: 'Resti di un falò spento secoli fa con frammenti di torce di pece e una borraccia in pelle essiccata.',
    requiredProps: ['ashes', 'torch_burnt', 'waterskin'],
  },
  {
    id: 'BROKEN_GOLD_LEAF',
    category: 'SACRILEGE_AND_THEFT',
    title: 'Mura Raschiate',
    narrativeClue: 'La doratura dei geroglifici è stata frettolosamente raschiata con lame taglienti, lasciando solchi profondi nel calcare.',
    requiredProps: ['scratched_wall', 'gold_shavings'],
  },
  {
    id: 'POISON_DART_VICTIM',
    category: 'SACRILEGE_AND_THEFT',
    title: 'La Trappola dei Dardi',
    narrativeClue: 'Uno scheletro accasciato contro il muro con molteplici dardi di bronzo con punta triangolare conficcati nella cassa toracica.',
    requiredProps: ['skeleton', 'darts', 'wall_holes'],
  },
  {
    id: 'DROPPED_LOOT_BAG',
    category: 'SACRILEGE_AND_THEFT',
    title: 'Fuga Disperata',
    narrativeClue: 'Una borsa di cuoio lacerata rovesciata sul pavimento, con amuleti di turchese sparsi lungo una scia di sabbia smossa.',
    requiredProps: ['leather_pouch', 'amulets', 'disturbed_sand'],
  },
  {
    id: 'BENT_CROWBAR_DOOR',
    category: 'SACRILEGE_AND_THEFT',
    title: 'Tentata Effrazione',
    narrativeClue: 'Una sbarra di bronzo piegata incastrata nell interstizio di una porta di pietra massiccia che non si è mai aperta.',
    requiredProps: ['bent_crowbar', 'stone_door'],
  },
  {
    id: 'SCATTERED_URN_JEWELS',
    category: 'SACRILEGE_AND_THEFT',
    title: 'Urna Infranta',
    narrativeClue: 'Un vaso funerario in ceramica dipinta spaccato sul pavimento, con lapislazzuli grezzi mescolati alle ceneri.',
    requiredProps: ['broken_urn', 'lapislazuli', 'ashes'],
  },
  {
    id: 'SEAL_SMASHED_WITH_HAMMER',
    category: 'SACRILEGE_AND_THEFT',
    title: 'Sigillo Reale Distrutto',
    narrativeClue: 'Il sigillo con il cartiglio del faraone posto all ingresso della cripta è stato spaccato a mazzate di pietra.',
    requiredProps: ['smashed_seal', 'stone_hammer'],
  },
  {
    id: 'TRAPPED_IN_FALSE_CORRIDOR',
    category: 'SACRILEGE_AND_THEFT',
    title: 'Vicolo Cieco Mortale',
    narrativeClue: 'Graffi disperati sulla parete di fondo di un finto corridoio cieco progettato dagli architetti reali per intrappolare gli intrusi.',
    requiredProps: ['scratched_stone', 'skeleton'],
  },

  // ── RITUAL AND WORSHIP (11-20) ──────────────────────────────────────────
  {
    id: 'OFFERING_ALTAR_INCENSE',
    category: 'RITUAL_AND_WORSHIP',
    title: 'Altare d Incenso Intatto',
    narrativeClue: 'Un altare di alabastro con una coppa d offerta contenente resina di mirra fossile e rami di acacia sacra essiccati.',
    requiredProps: ['altar_alabaster', 'myrrh_bowl', 'acacia_twigs'],
  },
  {
    id: 'PURIFICATION_BASIN',
    category: 'RITUAL_AND_WORSHIP',
    title: 'Bacino di Purificazione',
    narrativeClue: 'Una vasca monolitica rettangolare con canali di drenaggio incisi con preghiere per il lavacro rituale dei sacerdoti.',
    requiredProps: ['water_basin', 'hieroglyph_inscriptions'],
  },
  {
    id: 'ANUBIS_WEIGHING_SCALE',
    category: 'RITUAL_AND_WORSHIP',
    title: 'La Pesa dell Anima',
    narrativeClue: 'Una bilancia in legno di sicomoro e piatti di rame posizionata davanti a un bassorilievo raffigurante la pesatura del cuore contro la piuma di Maat.',
    requiredProps: ['scale', 'maat_feather_relief'],
  },
  {
    id: 'SOLAR_BARK_SHRINE',
    category: 'RITUAL_AND_WORSHIP',
    title: 'Santuario della Barca Solare',
    narrativeClue: 'Un modello in legno intarsiato d oro della barca sacra Mandjet, destinata a trasportare il dio Ra attraverso il cielo diurno.',
    requiredProps: ['model_boat', 'gold_inlays', 'pedestal'],
  },
  {
    id: 'PRIEST_CEREMONIAL_ROBE',
    category: 'RITUAL_AND_WORSHIP',
    title: 'Vesti Sacerdotali Abbandonate',
    narrativeClue: 'Una pelle di leopardo cerimoniale adagiata con cura sopra uno sgabello di ebano intagliato.',
    requiredProps: ['leopard_skin', 'ebony_stool'],
  },
  {
    id: 'LIBATION_DRAINAGE_TABLE',
    category: 'RITUAL_AND_WORSHIP',
    title: 'Tavola delle Libagioni',
    narrativeClue: 'Una lastra di granito con scanalature geometriche per raccogliere e convogliare l olio sacro e il vino d offerta.',
    requiredProps: ['libation_table', 'granite_channels'],
  },
  {
    id: 'CIRCLE_OF_PROTECTIVE_SALT',
    category: 'RITUAL_AND_WORSHIP',
    title: 'Cerchio di Natron Protettivo',
    narrativeClue: 'Un cerchio perfetto tracciato sul pavimento con sale di natron e polvere di quarzo per tenere lontani gli spiriti demoniaci.',
    requiredProps: ['salt_circle', 'quartz_powder'],
  },
  {
    id: 'CANDLE_VIGIL_STILL_WARM',
    category: 'RITUAL_AND_WORSHIP',
    title: 'Veglia Incompiuta',
    narrativeClue: 'Una serie di sette lampade ad olio d oliva disposte ad arco, alcune con lo stoppino ancora intriso di cera intatta.',
    requiredProps: ['oil_lamps_row', 'wax_stoppers'],
  },
  {
    id: 'PAPYRUS_OF_BREATHING',
    category: 'RITUAL_AND_WORSHIP',
    title: 'Il Papiro del Respiro',
    narrativeClue: 'Un rotolo di papiro funerario srotolato su un leggio di pietra, contenente formule per permettere al defunto di respirare nella Duat.',
    requiredProps: ['papyrus_scroll', 'stone_lectern'],
  },
  {
    id: 'HORUS_EYE_AMULET_CLUSTER',
    category: 'RITUAL_AND_WORSHIP',
    title: 'Offerta di Udjat',
    narrativeClue: 'Un piatto di ceramica invetriata blu contenente dozzine di piccoli occhi di Horus in faience egizia.',
    requiredProps: ['glazed_dish', 'faience_amulets'],
  },

  // ── DEATH AND MUMMIFICATION (21-30) ─────────────────────────────────────
  {
    id: 'MUMMIFICATION_SLAB',
    category: 'DEATH_AND_MUMMIFICATION',
    title: 'Tavolo di Imbalsamazione',
    narrativeClue: 'Un lungo tavolo di calcare inclinato verso una vaschetta di raccolta, con residui di bitume e resine aromatiche rapprese.',
    requiredProps: ['embalming_table', 'resin_residue'],
  },
  {
    id: 'CANOPIC_CHEST_ALIGNED',
    category: 'DEATH_AND_MUMMIFICATION',
    title: 'I Quattro Figli di Horus',
    narrativeClue: 'Quattro vasi canopi in alabastro (falco, babbuino, sciacallo, uomo) disposti perfettamente verso i quattro punti cardinali.',
    requiredProps: ['canopic_four', 'alabaster_chest'],
  },
  {
    id: 'TORN_MUMMY_WRAPPINGS',
    category: 'DEATH_AND_MUMMIFICATION',
    title: 'Bende Violate',
    narrativeClue: 'Strisce di lino ingiallite intrise di resina sparse a terra, come se qualcosa si fosse liberato a forza dal suo involucro.',
    requiredProps: ['linen_bandages', 'resin_flakes'],
  },
  {
    id: 'SHABTI_ARMY_SHELF',
    category: 'DEATH_AND_MUMMIFICATION',
    title: 'Schiera di Shabti',
    narrativeClue: 'Una nicchia a muro che ospita 365 statuette funerarie in maiolica turchese, ciascuna con zappa e cesto per lavorare nell aldilà.',
    requiredProps: ['shabti_shelf', 'faience_figurines'],
  },
  {
    id: 'GOLD_BURIAL_MASK_REST',
    category: 'DEATH_AND_MUMMIFICATION',
    title: 'Supporto della Maschera d Oro',
    narrativeClue: 'Un piedistallo di diorite nera dove poggiava la maschera funeraria del sovrano, con i supporti per il copricapo Nemes.',
    requiredProps: ['diorite_pedestal', 'mask_cradle'],
  },
  {
    id: 'HEART_SCARAB_AMULET',
    category: 'DEATH_AND_MUMMIFICATION',
    title: 'Lo Scarabeo del Cuore',
    narrativeClue: 'Uno scarabeo di diaspro verde inciso con il capitolo 30B del Libro dei Morti, caduto accanto a un sarcofago spezzato.',
    requiredProps: ['jasper_scarab', 'broken_sarcophagus'],
  },
  {
    id: 'OINTMENT_JARS_ROW',
    category: 'DEATH_AND_MUMMIFICATION',
    title: 'I Sette Olii Sacri',
    narrativeClue: 'Sette vasetti di calcite cilindrici allineati su una mensola di pietra, ciascuno recante il nome di un unguento rituale.',
    requiredProps: ['calcite_jars', 'stone_shelf'],
  },
  {
    id: 'FUNERARY_BED_LION_HEAD',
    category: 'DEATH_AND_MUMMIFICATION',
    title: 'Letto Funerario Leonino',
    narrativeClue: 'Un letto cerimoniale dorato con le zampe e le teste di leonessa raffiguranti la dea Sekhmet.',
    requiredProps: ['lion_bed', 'gold_leaf'],
  },
  {
    id: 'UNFINISHED_SARCOPHAGUS',
    category: 'DEATH_AND_MUMMIFICATION',
    title: 'Sarcofago Incompleto',
    narrativeClue: 'Un monolite di granito rosso parzialmente scavato, con i segni rossi a cera dell architetto che indicavano dove tagliare.',
    requiredProps: ['half_carved_stone', 'red_pigment_lines'],
  },
  {
    id: 'BONE_CHUTE_PIT',
    category: 'DEATH_AND_MUMMIFICATION',
    title: 'Fossa dei Resti',
    narrativeClue: 'Un condotto verticale circondato da lastre di pietra levigata utilizzato per depositare gli scheletri delle sepolture secondarie.',
    requiredProps: ['bone_pit', 'smooth_slabs'],
  },

  // ── CATASTROPHE AND COLLAPSE (31-40) ────────────────────────────────────
  {
    id: 'SHATTERED_COLUMN_AVALANCHE',
    category: 'CATASTROPHE_AND_COLLAPSE',
    title: 'Colonna Spezzata',
    narrativeClue: 'Un imponente fusto di colonna papiriforme collassato trasversalmente, bloccando metà della sala.',
    requiredProps: ['broken_column', 'stone_chunks'],
  },
  {
    id: 'CEILING_BREACH_SAND_POURING',
    category: 'CATASTROPHE_AND_COLLAPSE',
    title: 'Cascata di Sabbia',
    narrativeClue: 'Una breccia nel soffitto attraverso cui filtra una costante cascata di finissima sabbia dorata del deserto.',
    requiredProps: ['sand_cascade', 'rubble_mound'],
  },
  {
    id: 'EARTHQUAKE_FISSURE_FLOOR',
    category: 'CATASTROPHE_AND_COLLAPSE',
    title: 'Spaccatura Sismica',
    narrativeClue: 'Una fessura profonda che attraversa diagonalmente i lastroni del pavimento, svelando le fondamenta della piramide.',
    requiredProps: ['floor_crack', 'fallen_stones'],
  },
  {
    id: 'ROOT_PENETRATION_CEILING',
    category: 'CATASTROPHE_AND_COLLAPSE',
    title: 'Radici Millenarie',
    narrativeClue: 'Radici fossili di tamerici antiche che hanno perforato le giunzioni dei blocchi di calcare nel soffitto.',
    requiredProps: ['fossil_roots', 'cracked_ceiling'],
  },
  {
    id: 'COLLAPSED_ARCHITRAVE',
    category: 'CATASTROPHE_AND_COLLAPSE',
    title: 'Architrave Crollato',
    narrativeClue: 'Un blocco da venti tonnellate piombato al suolo, spezzando i gradini sottostanti e rivelando un passaggio nascosto.',
    requiredProps: ['giant_architrave', 'crushed_stairs'],
  },
  {
    id: 'BLOCKED_DOORWAY_RUBBLE',
    category: 'CATASTROPHE_AND_COLLAPSE',
    title: 'Porta Ostruita dalle Macerie',
    narrativeClue: 'Un portale monumentale completamente sbarrato da cumuli di blocchi di riempimento e ghiaia calcarea.',
    requiredProps: ['blocked_door', 'rubble_pile'],
  },
  {
    id: 'FLOOD_DEPOSITED_SILT',
    category: 'CATASTROPHE_AND_COLLAPSE',
    title: 'Limo Alluvionale Essiccato',
    narrativeClue: 'Strato spesso di fango e limo del Nilo essiccato e screpolato in blocchi poligonali sul pavimento.',
    requiredProps: ['dried_mud_slabs', 'water_marks'],
  },
  {
    id: 'FALLEN_OBELISK_TIP',
    category: 'CATASTROPHE_AND_COLLAPSE',
    title: 'Il Pyramidion Spezzato',
    narrativeClue: 'La cuspide piramidale di un obelisco caduta al suolo, con l electrum di rivestimento ancora visibile sui bordi.',
    requiredProps: ['pyramidion', 'fractured_granite'],
  },
  {
    id: 'SINKHOLE_IN_CHAMBER',
    category: 'CATASTROPHE_AND_COLLAPSE',
    title: 'Voragine nel Pavimento',
    narrativeClue: 'Il pavimento centrale è sprofondato in una cavità sotterranea non documentata nelle mappe degli architetti.',
    requiredProps: ['sinkhole', 'broken_slabs'],
  },
  {
    id: 'CRUSHED_TREASURE_CHEST',
    category: 'CATASTROPHE_AND_COLLAPSE',
    title: 'Bottino Sepolto',
    narrativeClue: 'Uno scrigno di bronzo appiattito sotto un concio caduto, con anelli e pettorali deformati visibili tra le macerie.',
    requiredProps: ['flattened_chest', 'crushed_jewelry'],
  },

  // ── ASTRONOMICAL AND MYSTIC (41-48) ─────────────────────────────────────
  {
    id: 'ORION_CONSTELLATION_ALIGNMENT',
    category: 'ASTRONOMICAL_AND_MYSTIC',
    title: 'Allineamento con Orione',
    narrativeClue: 'Un condotto d aerazione orientato esattamente verso la cintura di Orione (Sah), che convogliava l anima del faraone verso le stelle imperiture.',
    requiredProps: ['air_shaft', 'star_shaft_relief'],
  },
  {
    id: 'POLARIS_STAR_SHAFT',
    category: 'ASTRONOMICAL_AND_MYSTIC',
    title: 'Il Canale del Nord',
    narrativeClue: 'Una fessura stretta nella parete settentrionale puntata verso Thuban, l antica stella polare dell Antico Regno.',
    requiredProps: ['north_shaft', 'hieroglyph_north'],
  },
  {
    id: 'SOLSTICE_LIGHT_BEAM_MARKER',
    category: 'ASTRONOMICAL_AND_MYSTIC',
    title: 'Segno del Solstizio',
    narrativeClue: 'Una linea d oro intarsiata nel pavimento che riceveva il raggio solare unicamente nel giorno del solstizio d estate.',
    requiredProps: ['gold_line', 'solstice_marker'],
  },
  {
    id: 'ZODIAC_CEILING_DENDERAH',
    category: 'ASTRONOMICAL_AND_MYSTIC',
    title: 'Zodiaco Circolare Dipinto',
    narrativeClue: 'Raffigurazione monumentale della volta celeste con i decani stellari, i pianeti e le costellazioni egiziane.',
    requiredProps: ['zodiac_painting', 'lapis_ceiling'],
  },
  {
    id: 'MYSTIC_ANKH_GLOW_SPOT',
    category: 'ASTRONOMICAL_AND_MYSTIC',
    title: 'L Ankh della Rinascita',
    narrativeClue: 'Un grande Ankh scolpito in altorilievo sulla parete che emana una flebile bioluminescenza dorata al contatto con la luce.',
    requiredProps: ['ankh_relief', 'golden_glow'],
  },
  {
    id: 'HORIZON_OF_KHUFU_MAP',
    category: 'ASTRONOMICAL_AND_MYSTIC',
    title: 'Mappa dell Orizzonte di Cheope',
    narrativeClue: 'Una pianta topografica della piana di Giza incisa su una tavola di diorite levigata con le posizioni dei complessi templari.',
    requiredProps: ['diorite_map', 'stone_compass'],
  },
  {
    id: 'HOUR_WATER_CLOCK_CLEPSYDRA',
    category: 'ASTRONOMICAL_AND_MYSTIC',
    title: 'Clessidra ad Acqua Sacerdotale',
    narrativeClue: 'Un vaso tronco-conico in alabastro con tacche orarie interne usato per calcolare le ore notturne dei rituali.',
    requiredProps: ['clepsydra_vase', 'hour_markings'],
  },
  {
    id: 'DECANS_CALENDAR_STELE',
    category: 'ASTRONOMICAL_AND_MYSTIC',
    title: 'Stele dei 36 Decani',
    narrativeClue: 'Tavola astronomica con le 36 stelle guida usate per scandire l anno civile egizio di 360 giorni più 5 epagomeni.',
    requiredProps: ['decan_stele', 'star_rows'],
  },

  // ── CURSE OF THE PHARAOHS (49-54) ───────────────────────────────────────
  {
    id: 'CURSE_INSCRIPTION_ENTRANCE',
    category: 'CURSE_OF_THE_PHARAOHS',
    title: 'La Maledizione Incisa',
    narrativeClue: '"A colui che spezzerà questo sigillo: la morte volerà sulle sue ali rapide e nessun figlio porterà il suo nome".',
    requiredProps: ['curse_cartouche', 'warning_glyphs'],
  },
  {
    id: 'SEALED_FALSE_DOOR_BLOOD_OCHRE',
    category: 'CURSE_OF_THE_PHARAOHS',
    title: 'Falsa Porta Sigillata in Ocホa',
    narrativeClue: 'Una finta porta monumentale spalmata di ocra rossa e bitume, con sigilli sacerdotali intatti a protezione del Ka.',
    requiredProps: ['false_door_red', 'wax_amulets'],
  },
  {
    id: 'BROKEN_PROTECTIVE_AMULET_ASH',
    category: 'CURSE_OF_THE_PHARAOHS',
    title: 'Amuleto Spezzato nella Cenere',
    narrativeClue: 'Un amuleto Djed di protezione spezzato in due metà annerite dal fuoco al centro di una macchia scura.',
    requiredProps: ['broken_djed', 'scorch_mark'],
  },
  {
    id: 'MUMMY_OPENED_FROM_INSIDE',
    category: 'CURSE_OF_THE_PHARAOHS',
    title: 'Risveglio del Guardiano',
    narrativeClue: 'I cardini di bronzo del sarcofago sono stati piegati e divelti verso l esterno, lasciando impronte resinose verso l uscita.',
    requiredProps: ['forced_sarcophagus', 'tar_footprints'],
  },
  {
    id: 'VOICES_IN_THE_WALLS_GLYPHS',
    category: 'CURSE_OF_THE_PHARAOHS',
    title: 'Pareti Sussurranti',
    narrativeClue: 'Geroglifici scolpiti che sembrano vibrare alla luce della torcia, descrivendo il castigo eterno di Osiride.',
    requiredProps: ['pulsing_glyphs', 'vibrating_relief'],
  },
  {
    id: 'SACRED_COBRA_NEST_HOLE',
    category: 'CURSE_OF_THE_PHARAOHS',
    title: 'L Ureo Vendicatore',
    narrativeClue: 'Una tana murale coronata dalla scultura di un cobra reale eretto con occhi di rubino, circondata da pelli di serpente mute.',
    requiredProps: ['cobra_shrine', 'shed_snake_skin'],
  },
];

/** Mappa indicizzata per ID. */
const STORY_BY_ID = new Map<string, EnvironmentalStory>(
  ENVIRONMENTAL_STORIES.map((s) => [s.id, s]),
);

/**
 * Risolve lo scenario narrativo per una stanza in modo deterministico.
 */
export function resolveEnvironmentalStory(
  seed: number,
  roomId: number,
  role: RoomRole,
  theme: RoomTheme,
): EnvironmentalStory {
  // Filtra gli scenari coerenti con il tema e ruolo
  let categoryFilter: StoryCategory = 'SACRILEGE_AND_THEFT';

  if (role === 'TREASURE') {
    categoryFilter = 'SACRILEGE_AND_THEFT';
  } else {
    switch (theme) {
      case 'ROYAL':
      case 'TREASURE_VAULT':
        categoryFilter = 'CURSE_OF_THE_PHARAOHS';
        break;
      case 'SACRED':
        categoryFilter = 'RITUAL_AND_WORSHIP';
        break;
      case 'FUNERARY':
        categoryFilter = 'DEATH_AND_MUMMIFICATION';
        break;
      case 'COLLAPSED':
      case 'SAND_FILLED':
        categoryFilter = 'CATASTROPHE_AND_COLLAPSE';
        break;
      case 'ASTRONOMICAL':
        categoryFilter = 'ASTRONOMICAL_AND_MYSTIC';
        break;
      case 'INFESTED':
      case 'PLUNDERED':
      case 'PLAIN':
      case 'GREAT_GALLERY':
      default:
        categoryFilter = 'SACRILEGE_AND_THEFT';
        break;
    }
  }

  const matching = ENVIRONMENTAL_STORIES.filter((s) => s.category === categoryFilter);
  const pool = matching.length > 0 ? matching : ENVIRONMENTAL_STORIES;

  const h = hash32(seed * 1019 + roomId * 53, roomId * 17 + seed);
  const index = h % pool.length;

  return pool[index] ?? ENVIRONMENTAL_STORIES[0]!;
}

/** Recupera uno scenario per ID. */
export function getEnvironmentalStoryById(id: string): EnvironmentalStory | undefined {
  return STORY_BY_ID.get(id);
}
