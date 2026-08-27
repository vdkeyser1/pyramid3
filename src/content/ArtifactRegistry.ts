/**
 * W-5: Registro centralizzato degli artefatti 3D egiziani.
 * Modulo PURO — nessun import di THREE (boundary constraint content/).
 * I path puntano a public/models/; se un file manca, ArtifactLoader ritorna null.
 */

export type ArtifactRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type ArtifactSource = 'smithsonian' | 'quaternius' | 'sketchfab-cc0' | 'kaykit' | 'kenney' | 'procedural';

export interface ArtifactDef {
  readonly id: string;
  readonly url: string;
  readonly displayName: string;
  readonly loreName: string | null;
  readonly rarity: ArtifactRarity;
  readonly interactable: boolean;
  readonly scale: number;
  readonly description: string | null;
  readonly source: ArtifactSource;
  /** Ruotare il modello di N radianti attorno Y alla creazione. */
  readonly yRotation?: number;
}

export const ArtifactRegistry: readonly ArtifactDef[] = [
  // ── Smithsonian Open Access CC0 ──────────────────────────────────────────
  {
    id: 'canopic_jar_horus',
    url: '/models/canopic_jar.glb',
    displayName: 'Vaso Canopo di Horus',
    loreName: 'ḥr — Heru',
    rarity: 'uncommon',
    interactable: true,
    scale: 0.3,
    description: 'Custodisce il fegato del faraone. Un occhio di Horus veglia sul coperchio.',
    source: 'smithsonian',
  },
  {
    id: 'ushabti_servant',
    url: '/models/ushabti.glb',
    displayName: 'Ushabti del Servo',
    loreName: 'wšbty',
    rarity: 'common',
    interactable: false,
    scale: 0.15,
    description: "Figurina funeraria destinata a lavorare nell'aldilà al posto del defunto.",
    source: 'smithsonian',
  },
  {
    id: 'scarab_amulet',
    url: '/models/scarab.glb',
    displayName: 'Amuleto Scarabeo',
    loreName: 'ḫpr — Kheper',
    rarity: 'rare',
    interactable: true,
    scale: 0.08,
    description: 'Simbolo del dio sole nascente. Concede rigenerazione HP +2/s per 30s.',
    source: 'smithsonian',
  },
  // ── Filler pietra neutro (Kenney Mini Dungeon CC0) ────────────────────────
  // Solo silhouette accettabili in tomba: anfora / detriti / scala.
  // RIMOSSI: barrel, gate, chest, banner, wood-* (leggono da taverna/dungeon).
  // Colonnate in scena = EgyptianColumn procedurale, non `ruins_column`.
  {
    id: 'ruins_pot',
    url: '/models/ruins/pot.glb',
    displayName: 'Anfora',
    loreName: null,
    rarity: 'common',
    interactable: false,
    scale: 0.7,
    description: 'Anfora funeraria — filler di corridoio.',
    source: 'kenney',
  },
  {
    id: 'ruins_rocks',
    url: '/models/ruins/rocks.glb',
    displayName: 'Detriti di Pietra',
    loreName: null,
    rarity: 'common',
    interactable: false,
    scale: 1.0,
    description: null,
    source: 'kenney',
  },
  {
    id: 'ruins_stairs',
    url: '/models/ruins/stairs.glb',
    displayName: 'Scala di Pietra',
    loreName: null,
    rarity: 'common',
    interactable: false,
    scale: 1.0,
    description: null,
    source: 'kenney',
  },
  // ── KayKit CC0 (bauli loot — non moduli ambiente) ─────────────────────────
  {
    id: 'chest_gold',
    url: '/assets/props/chest_gold.glb',
    displayName: 'Cassa del Faraone',
    loreName: null,
    rarity: 'legendary',
    interactable: true,
    scale: 0.8,
    description: 'Contiene le riserve di Ka del faraone. Solo i valorosi possono aprirla.',
    source: 'kaykit',
  },
  {
    id: 'chest_common',
    url: '/assets/props/chest.glb',
    displayName: 'Cassa di Legno',
    loreName: null,
    rarity: 'common',
    interactable: true,
    scale: 0.8,
    description: null,
    source: 'kaykit',
  },
  // NOTA: KayKit Dungeon (colonne/scudi) e Kenney barrel/gate/banner sono fuori
  // tema — questa è una PIRAMIDE egizia, non un dungeon medievale.
] as const;

/** Lookup veloce per id. */
export function getArtifactById(id: string): ArtifactDef | undefined {
  return ArtifactRegistry.find((a) => a.id === id);
}

/**
 * Tutti gli artefatti di una certa sorgente.
 * Usato per filtrare per provenienza quando si valuta la coerenza stilistica
 * di un pack (es. verificare quali asset arrivano da una sorgente da dismettere).
 */
export function getArtifactsBySource(source: ArtifactSource): readonly ArtifactDef[] {
  return ArtifactRegistry.filter((a) => a.source === source);
}
