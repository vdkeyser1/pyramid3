/**
 * Scopo: sistema di decifrazione dei geroglifici murali (P18 — Gameplay Archeologico).
 *        Permette al giocatore di leggere le iscrizioni scolpite nelle pareti
 *        per svelare segreti del dungeon (trappole, reliquie, passaggi nascosti).
 * Ownership: gameplay (data-driven e puro).
 */

import { hash32 } from '@/procedural/Hash32.js';
import { generateInscription } from '@/content/inscriptions.js';

export type InscriptionSecretType =
  | 'TRAP_HINT'
  | 'RELIC_HINT'
  | 'EXIT_HINT'
  | 'BLESSING_HINT';

export interface DecipheredInscription {
  readonly glyphs: string;
  readonly sealPreamble: string;
  readonly type: InscriptionSecretType;
  readonly translation: string;
  readonly tacticalClue: string;
}

const SECRETS: readonly {
  type: InscriptionSecretType;
  translations: readonly string[];
  tacticalClues: readonly string[];
}[] = [
  {
    type: 'TRAP_HINT',
    translations: [
      '"Non calpestare la lastra del falco: le punte di bronzo attendono il sangue dell intruso."',
      '"Il pendolo d ombra taglia il corridoio centrale ogni tre battiti del cuore."',
      '"Sotto il terzo blocco di calcare riposa il dardo avvelenato della vipera."',
    ],
    tacticalClues: [
      'Attenzione alle piastre a pressione metalliche.',
      'Sincronizza il passaggio con l oscillazione della lama.',
      'Mantieni la destra nei corridoi stretti per evitare i dardi.',
    ],
  },
  {
    type: 'RELIC_HINT',
    translations: [
      '"Il sarcofago del principe dorato custodisce l amuleto Ankh che sconfigge la morte."',
      '"Tra le ceneri dell altare a nord riposa il pettorale di lapislazzuli."',
      '"La nicchia dietro la statua di Anubi cela l olio sacro di Ra."',
    ],
    tacticalClues: [
      'Cerca il sarcofago con intarsi dorati per ottenere equipaggiamento raro.',
      'Scava vicino all altare per trovare frammenti di scarabeo.',
      'Ispeziona il retro della statua guardiana.',
    ],
  },
  {
    type: 'EXIT_HINT',
    translations: [
      '"La scala che discende verso il cuore della piramide è guidata dalla Stella Polare."',
      '"Segui le torce di bronzo verso il portale dell Oltretomba."',
      '"L arco monolitico indica il cammino verso il regno di Osiride."',
    ],
    tacticalClues: [
      'L uscita si trova nella direzione indicata dai bassorilievi solari.',
      'Cerca le arcate monolitiche per trovare la scala di discesa.',
      'La via di fuga è protetta da un guardiano addormentato.',
    ],
  },
  {
    type: 'BLESSING_HINT',
    translations: [
      '"Colui che offre l oro agli dei vedrà la sua torcia ardere della fiamma eterna di Ra."',
      '"La bilancia della verità purifica il Ka di chi combatte con onore."',
      '"Nel santuario centrale, la grazia di Thoth illumina i passi nell oscurità."',
    ],
    tacticalClues: [
      'Trova un altare per consacrare un offerta e potenziare la tua arma.',
      'Ogni parry perfetto ripristina la tua energia Ka.',
      'I glifi del santuario aumentano il raggio della torcia.',
    ],
  },
];

/**
 * Decifra un'iscrizione murale deterministica per una stanza specifica.
 */
export function decipherWallInscription(
  seed: number,
  floorIndex: number,
  roomId: number,
): DecipheredInscription {
  const generated = generateInscription(seed * 701 + floorIndex * 31 + roomId * 17);
  const h = hash32(seed * 911 + floorIndex * 43 + roomId * 29, 0x7e47);

  const secretCategory = SECRETS[h % SECRETS.length] ?? SECRETS[0]!;
  const textIndex = (h >>> 4) % secretCategory.translations.length;

  const translation = secretCategory.translations[textIndex] ?? secretCategory.translations[0]!;
  const tacticalClue = secretCategory.tacticalClues[textIndex] ?? secretCategory.tacticalClues[0]!;

  return {
    glyphs: generated.glyphs,
    sealPreamble: generated.preamble,
    type: secretCategory.type,
    translation,
    tacticalClue,
  };
}
