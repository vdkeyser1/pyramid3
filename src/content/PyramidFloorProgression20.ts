/**
 * Scopo: PyramidFloorProgression20 — progressione completa su 20 livelli dall Apice alla Cripta Primordiale.
 *        La piramide si espande dall alto verso il basso:
 *        - Piano 1: Pyramidion d Oro (Benbenet) — il vertice baciato dal sole;
 *        - Piani 2-5: Camere Reali e Grandi Gallerie Superiori;
 *        - Piani 6-10: Camere di Scarico e Labirinto dei Falsi Passaggi;
 *        - Piani 11-15: Sale Ipostile Intermedie e Archivi della Duat;
 *        - Piani 16-19: Cunicoli Sommersi di Sabbia e Necropoli degli Shabti;
 *        - Piano 20: La Cripta Primordiale del Faraone Eterno (Tomba di Osiride).
 * Ownership: content (puro e deterministico).
 */

import type { RoomTheme } from './RoomThemes.js';

export interface PyramidFloorTier {
  readonly floor: number;
  readonly name: string;
  readonly sectionTitle: string;
  readonly primaryTheme: RoomTheme;
  readonly baseRoomCount: number;
  readonly secretCount: number;
  readonly narrativeIntro: string;
  readonly dangerRating: 1 | 2 | 3 | 4 | 5;
}

export const PYRAMID_20_FLOORS: readonly PyramidFloorTier[] = [
  // FASCIA 1: L'APICE DORATO (Piani 1-5)
  {
    floor: 1,
    name: 'Il Pyramidion di Ra (Benbenet)',
    sectionTitle: 'Cuspide della Piramide',
    primaryTheme: 'SACRED',
    baseRoomCount: 6,
    secretCount: 1,
    narrativeIntro: 'Sei penetrato attraverso il Pyramidion d elettro. Il sole di mezzogiorno trafigge i primi blocchi di calcare.',
    dangerRating: 1,
  },
  {
    floor: 2,
    name: 'La Grande Galleria Superiore',
    sectionTitle: 'Gallerie del Cielo',
    primaryTheme: 'ASTRONOMICAL',
    baseRoomCount: 7,
    secretCount: 1,
    narrativeIntro: 'Le pareti sono incise con le costellazioni di Orione e Sirio. L aria è secca e profuma di loto.',
    dangerRating: 1,
  },
  {
    floor: 3,
    name: 'Anticamera dei Nobili di Menfi',
    sectionTitle: 'Cripte dei Principi',
    primaryTheme: 'FUNERARY',
    baseRoomCount: 8,
    secretCount: 2,
    narrativeIntro: 'Sarcofagi intagliati in pietra calcarea vegliano sui passaggi stretti. Sotto le statue si celano varchi occulti.',
    dangerRating: 2,
  },
  {
    floor: 4,
    name: 'Santuario degli Occhi di Horus',
    sectionTitle: 'Santuari Solari',
    primaryTheme: 'SACRED',
    baseRoomCount: 9,
    secretCount: 2,
    narrativeIntro: 'I falchi dorati guardano verso il basso. I geroglifici indicano percorsi celati dietro le false porte.',
    dangerRating: 2,
  },
  {
    floor: 5,
    name: 'Camera del Faraone Ascendente',
    sectionTitle: 'Tombe Reali Superiori',
    primaryTheme: 'ROYAL',
    baseRoomCount: 10,
    secretCount: 2,
    narrativeIntro: 'Un maestoso sarcofago di granito rosso domina la sala. Le prime mummie guardiane iniziano a risvegliarsi.',
    dangerRating: 2,
  },

  // FASCIA 2: CAMERE DI SCARICO & LABIRINTO DEI FALSI PASSAGGI (Piani 6-10)
  {
    floor: 6,
    name: 'Le Camere di Scarico Monolitiche',
    sectionTitle: 'Vuoti Strutturali',
    primaryTheme: 'COLLAPSED',
    baseRoomCount: 11,
    secretCount: 2,
    narrativeIntro: 'Travi di pietra ciclopiche sorreggono il peso di milioni di tonnellate. Le fessure celano cunicoli stretti.',
    dangerRating: 3,
  },
  {
    floor: 7,
    name: 'Labirinto dei Dardi Avvelenati',
    sectionTitle: 'Cunicoli delle Trappole',
    primaryTheme: 'PLUNDERED',
    baseRoomCount: 12,
    secretCount: 3,
    narrativeIntro: 'Piastre a pressione e feritoie nei muri. Solo seguendo i cartigli autentici eviterai le lame.',
    dangerRating: 3,
  },
  {
    floor: 8,
    name: 'Cripta dei Vasi Canopi Sigillati',
    sectionTitle: 'Archivi dell Imbalsamazione',
    primaryTheme: 'FUNERARY',
    baseRoomCount: 12,
    secretCount: 3,
    narrativeIntro: 'Centinaia di urne d alabastro custodiscono le viscere dei sacerdoti. I passi risuonano nel vuoto.',
    dangerRating: 3,
  },
  {
    floor: 9,
    name: 'Corridoio Inclinato del Vento d Ombra',
    sectionTitle: 'Passaggi a Chevrons',
    primaryTheme: 'ASTRONOMICAL',
    baseRoomCount: 13,
    secretCount: 3,
    narrativeIntro: 'La pendenza del pavimento aumenta. Correnti d aria fredda filtrano da sotto i basamenti delle statue.',
    dangerRating: 3,
  },
  {
    floor: 10,
    name: 'Trono dei Cento Guardiani di Pietra',
    sectionTitle: 'Bastione Centrale',
    primaryTheme: 'ROYAL',
    baseRoomCount: 14,
    secretCount: 3,
    narrativeIntro: 'Una schiera di statue Shabti armate di lancia circonda il varco che conduce alle profondità della Duat.',
    dangerRating: 4,
  },

  // FASCIA 3: SALE IPOSTILE & ARCHIVI DELLA DUAT (Piani 11-15)
  {
    floor: 11,
    name: 'La Grande Sala Ipostila di Tebe',
    sectionTitle: 'Foresta di Colonne',
    primaryTheme: 'GREAT_GALLERY',
    baseRoomCount: 15,
    secretCount: 3,
    narrativeIntro: 'Colonnati a capitello papiriforme alti cinque metri. Tra i fusti si muovono le ombre degli sciacalli.',
    dangerRating: 4,
  },
  {
    floor: 12,
    name: 'Archivio Proibito del Libro dei Morti',
    sectionTitle: 'Scriptorium Sacro',
    primaryTheme: 'SACRED',
    baseRoomCount: 16,
    secretCount: 4,
    narrativeIntro: 'Rotoli di papiro ricoperti di formule di resurrezione. Le pareti rivelano passaggi a chi sa decifrarli.',
    dangerRating: 4,
  },
  {
    floor: 13,
    name: 'Forgia Rituale del Bronzo e dell Oro',
    sectionTitle: 'Officine Funerarie',
    primaryTheme: 'TREASURE_VAULT',
    baseRoomCount: 16,
    secretCount: 4,
    narrativeIntro: 'Crogioli dorati e lingotti di rame. Forzieri nascosti sotto il pavimento attendono la pala dell archeologo.',
    dangerRating: 4,
  },
  {
    floor: 14,
    name: 'Santuario della Furia di Sekhmet',
    sectionTitle: 'Templi di Sangue',
    primaryTheme: 'INFESTED',
    baseRoomCount: 17,
    secretCount: 4,
    narrativeIntro: 'La dea leonessa esige tributi di sangue. I bracieri ardono di una fiamma cremisi ostile.',
    dangerRating: 4,
  },
  {
    floor: 15,
    name: 'Sepolcro del Gran Sacerdote di Eliopoli',
    sectionTitle: 'Cripte Sacerdotali',
    primaryTheme: 'FUNERARY',
    baseRoomCount: 18,
    secretCount: 4,
    narrativeIntro: 'Un labirinto di sarcofagi doppi. Il Boia di Anubi pattuglia l ingresso della scala monumentale.',
    dangerRating: 4,
  },

  // FASCIA 4: NECROPOLI SOMMERSA & CATACOMBE DELLA ROCCIA MADRE (Piani 16-19)
  {
    floor: 16,
    name: 'Cunicoli Sommersi dalle Sabbie del Tempo',
    sectionTitle: 'Necropoli Insabbiata',
    primaryTheme: 'SAND_FILLED',
    baseRoomCount: 19,
    secretCount: 4,
    narrativeIntro: 'La sabbia del deserto ha invaso le sale inferiori. Camminare è faticoso e i cobra delle fessure sono in agguato.',
    dangerRating: 5,
  },
  {
    floor: 17,
    name: 'Gallerie Allagate del Nilo Sotterraneo',
    sectionTitle: 'Abisso di Sobek',
    primaryTheme: 'PLAIN',
    baseRoomCount: 20,
    secretCount: 4,
    narrativeIntro: 'Bacini d acqua stagnante riflettono la luce della torcia. I Figli di Sobek nuotano nelle profondità.',
    dangerRating: 5,
  },
  {
    floor: 18,
    name: 'Le Catacombe dei Dannati Senza Nome',
    sectionTitle: 'Prigioni della Duat',
    primaryTheme: 'PLUNDERED',
    baseRoomCount: 21,
    secretCount: 5,
    narrativeIntro: 'Celle scavate nella roccia viva dove riposano coloro a cui fu negato il passaggio nell Oltretomba.',
    dangerRating: 5,
  },
  {
    floor: 19,
    name: 'L Anticamera dell Ombra Eterna',
    sectionTitle: 'Soglia del Faraone',
    primaryTheme: 'SACRED',
    baseRoomCount: 22,
    secretCount: 5,
    narrativeIntro: 'La temperatura scende a zero. I geroglifici brillano di luce propria e le porte segrete richiedono sacrifici di Ka.',
    dangerRating: 5,
  },

  // FASCIA 5: IL CUORE PRIMORDIALE (Piano 20)
  {
    floor: 20,
    name: 'La Cripta Primordiale del Faraone Eterno',
    sectionTitle: 'Il Trono della Duat',
    primaryTheme: 'ROYAL',
    baseRoomCount: 24,
    secretCount: 6,
    narrativeIntro: 'Sei giunto alla roccia madre della Terra dei Faraoni. Il Sarcofago Supremo custodisce il segreto dell immortalità.',
    dangerRating: 5,
  },
];

export function getPyramidFloorTier(floorIndex: number): PyramidFloorTier {
  const idx = Math.max(1, Math.min(20, floorIndex)) - 1;
  return PYRAMID_20_FLOORS[idx] ?? PYRAMID_20_FLOORS[0]!;
}
