/**
 * Scopo: RoomNarrativeDirector — generatore dello scenario testuale e descrizioni archeologiche per tutte le stanze.
 *        Crea l immersione letteraria per ogni camera, monumento e scoperta segreta.
 * Ownership: gameplay / narrative.
 */

import type { RoomTheme } from '@/content/RoomThemes.js';
import { hash32 } from '@/procedural/Hash32.js';

export interface RoomNarrativeEntry {
  readonly title: string;
  readonly description: string;
  readonly atmosphericClue: string;
}

const THEME_NARRATIVES: Record<RoomTheme, readonly { title: string; desc: string; clue: string }[]> = {
  SACRED: [
    {
      title: 'Santuario del Sole Nascente',
      desc: 'L aria profuma di mirra e loto essiccato. Pareti di calcare levigato riflettono la luce con bagliori dorati.',
      clue: 'I geroglifici sacri attorno all altare narrano di una benedizione per chi offre il proprio Ka.',
    },
    {
      title: 'Sacello dei Due Orizzonti',
      desc: 'I bassorilievi mostrano Ra che attraversa la notte a bordo della barca solare.',
      clue: 'Le ali della statua di Horus proiettano un ombra insolita sul pavimento a nord.',
    },
  ],
  ASTRONOMICAL: [
    {
      title: 'Osservatorio delle Stelle Imperiture',
      desc: 'Il soffitto di lapislazzuli è costellato di sfere d oro zecchino allineate con la cintura di Orione.',
      clue: 'Un sottile raggio di luce filtra dalla volta, puntando verso uno specchio di bronzo.',
    },
  ],
  FUNERARY: [
    {
      title: 'Cripta dei Custodi Imbalsamati',
      desc: 'L odore acre di bitume e natron impregna le pareti. Urne canopiche sono allineate in nicchie scavate nella roccia.',
      clue: 'Il basamento del sarcofago centrale presenta tracce di sabbia fresca: qualcosa è stato mosso di recente.',
    },
    {
      title: 'Anticamera del Sonno Millenario',
      desc: 'Bende di lino e polvere di mummia ricoprono le lastre del pavimento. I silenzi sono rotti solo dal gocciolio della pietra.',
      clue: 'Un eco sordo risuona sotto il pavimento a ogni passo pesante.',
    },
  ],
  ROYAL: [
    {
      title: 'Camera del Faraone Divinizzato',
      desc: 'Colonne massicce con capitelli dorati sorreggono architravi incisi con il cartiglio dell Eternità.',
      clue: 'Dietro il trono si intravede una fessura con una scala a gradini che sprofonda nella terra.',
    },
  ],
  COLLAPSED: [
    {
      title: 'Galleria dei Conci Fratturati',
      desc: 'Blocchi ciclopici precipitati dal soffitto hanno spezzato le antiche arcate. Cumuli di calcare ostruiscono la visuale.',
      clue: 'Tra le macerie si apre un varco stretto: strisciando è possibile raggiungere un intercapedine segreta.',
    },
  ],
  SAND_FILLED: [
    {
      title: 'Cripta Invasa dal Deserto',
      desc: 'Dune di sabbia finissima ricoprono per metà le porte monumentali. Il terreno cede morbidamente sotto i passi.',
      clue: 'Un vaso d alabastro spunta dalla sabbia vicino alla parete est.',
    },
  ],
  PLUNDERED: [
    {
      title: 'Cella dei Dannati e Saccheggiatori',
      desc: 'Sbarre di bronzo piegate e pareti ruvide. Qui i predatori di tombe tentarono invano di forzare le cripte.',
      clue: 'Una fessura nel muro nasconde una nicchia dove furono celati i gioielli rubati.',
    },
  ],
  TREASURE_VAULT: [
    {
      title: 'Tesoreria Reale delle Dinastie',
      desc: 'Casse di pietra e forzieri cerimoniali intarsiati d elettro custodiscono i tributi dell Alto e Basso Egitto.',
      clue: 'Sotto il mosaico centrale dello scarabeo è celata una botola a bilanciere.',
    },
  ],
  PLAIN: [
    {
      title: 'Gallerie del Nilo Sotterraneo',
      desc: 'Pietra calcarea nuda e vasche d acqua che riflettono l oscurità della piramide.',
      clue: 'Sul fondo della roccia brilla un amuleto di diaspro intatto.',
    },
  ],
  INFESTED: [
    {
      title: 'Nido Sotterraneo dei Coleotteri di Lapis',
      desc: 'Migliaia di gusci di scarabeo brillano di blu fosforescente sulle pareti. Un ronzio costante pervade l aria.',
      clue: 'La fiamma della torcia tiene a distanza i parassiti, svelando un passaggio alle loro spalle.',
    },
  ],
  GREAT_GALLERY: [
    {
      title: 'La Grande Galleria Ascendente',
      desc: 'Un corridoio a volta corbelled alto otto metri sale ripido tra conci di calcare bianco perfettamente giuntati.',
      clue: 'Le scanalature laterali nel pavimento servivano a far scivolare i blocchi di granito di chiusura.',
    },
  ],
};

export function getRoomNarrative(
  seed: number,
  floorIndex: number,
  roomId: number,
  theme: RoomTheme,
): RoomNarrativeEntry {
  const narratives = THEME_NARRATIVES[theme] ?? THEME_NARRATIVES.SACRED;
  const h = hash32(seed * 521 + floorIndex * 67 + roomId * 19, 0x4f1b);
  const selected = narratives[h % narratives.length] ?? narratives[0]!;

  return {
    title: `${selected.title} — Piano ${floorIndex}`,
    description: selected.desc,
    atmosphericClue: selected.clue,
  };
}
