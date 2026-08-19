/**
 * G-01: Definizioni data-driven degli upgrade della meta-progressione.
 *
 * Struttura ispirata a Hades / Dead Cells:
 *   - Due layer: upgrade permanenti (Ka) + bonus di run (offerta del santuario)
 *   - Valuta unica: Ka Fragments (droppati dai nemici, dai brasieri, dai tesori)
 *   - Costo crescente: level * BASE_COST * multiplier
 *
 * Ownership: pura, immutabile. MetaProgressionStore legge, non scrive.
 */

export type UpgradeId =
  // ── Combattimento ────────────────────────────────────────────────────
  | 'MENAT_BLESSING'        // +10% HP iniziali per run (+1 livello = +10%)
  | 'KHEPRI_CARAPACE'       // -5% danno ricevuto per livello
  | 'ANUBIS_SCALE'          // finestra di parata +2 frame per livello
  | 'SEKHMET_FURY'          // +8% danno corp-a-corp per livello
  // ── Esplorazione ────────────────────────────────────────────────────
  | 'THOTH_SCROLL'          // +1 geroglifico leggibile al floor (lore)
  | 'BASTET_AGILITY'        // +5% velocità di movimento per livello
  | 'RA_TORCH'              // torcia dura +15% tick in più per livello
  | 'OSIRIS_REBIRTH'        // 1 volta per run: resurrezione a 1 HP
  // ── Utilità ─────────────────────────────────────────────────────────
  | 'SOBEK_VAULT'           // +10% oro trovato per livello
  | 'HATHOR_MEMORY'         // mostra mappa esplorata al floor successivo
  | 'PTAH_CRAFTSMAN'        // unlock slot equipaggiamento secondario
  | 'IMHOTEP_ARCHITECT';    // floor generation: +1 stanza bonus per livello

export type UpgradeCategory = 'COMBAT' | 'EXPLORATION' | 'UTILITY';

export interface UpgradeDef {
  readonly id: UpgradeId;
  readonly name: string;
  readonly description: string;
  readonly category: UpgradeCategory;
  readonly maxLevel: number;
  readonly baseCost: number;      // costo al livello 1, in Ka Fragments
  readonly costMultiplier: number; // cost al livello N = baseCost * (N * multiplier)
  /** Valore del bonus per ogni livello (interpretazione dipende dall'id). */
  readonly bonusPerLevel: number;
  /** Dipendenze: id di upgrade che devono essere almeno livello 1. */
  readonly requires?: readonly UpgradeId[];
}

export const UPGRADE_DEFS: Record<UpgradeId, UpgradeDef> = {
  MENAT_BLESSING: {
    id: 'MENAT_BLESSING',
    name: 'Benedizione di Menat',
    description: '+10% HP iniziali per livello di upgrade. La dea della protezione sorride su di te.',
    category: 'COMBAT',
    maxLevel: 5,
    baseCost: 50,
    costMultiplier: 1.8,
    bonusPerLevel: 0.10,
  },
  KHEPRI_CARAPACE: {
    id: 'KHEPRI_CARAPACE',
    name: 'Carapace di Khepri',
    description: '-5% danno ricevuto per livello. Il dio dello scarabeo ti avvolge nella sua corazza.',
    category: 'COMBAT',
    maxLevel: 4,
    baseCost: 75,
    costMultiplier: 2.0,
    bonusPerLevel: 0.05,
    requires: ['MENAT_BLESSING'],
  },
  ANUBIS_SCALE: {
    id: 'ANUBIS_SCALE',
    name: 'Bilancia di Anubi',
    description: '+2 frame di finestra di parata per livello. Anubi misura ogni azione con precisione divina.',
    category: 'COMBAT',
    maxLevel: 3,
    baseCost: 100,
    costMultiplier: 2.2,
    bonusPerLevel: 2,
  },
  SEKHMET_FURY: {
    id: 'SEKHMET_FURY',
    name: 'Furia di Sekhmet',
    description: '+8% danno corpo a corpo per livello. La leonessa della guerra guida il tuo braccio.',
    category: 'COMBAT',
    maxLevel: 5,
    baseCost: 80,
    costMultiplier: 1.9,
    bonusPerLevel: 0.08,
    requires: ['MENAT_BLESSING'],
  },
  THOTH_SCROLL: {
    id: 'THOTH_SCROLL',
    name: 'Rotolo di Thoth',
    description: '+1 iscrizione geroglifica leggibile per floor. Il dio della scrittura rivela i segreti della piramide.',
    category: 'EXPLORATION',
    maxLevel: 3,
    baseCost: 40,
    costMultiplier: 1.5,
    bonusPerLevel: 1,
  },
  BASTET_AGILITY: {
    id: 'BASTET_AGILITY',
    name: 'Agilità di Bastet',
    description: '+5% velocità di movimento per livello. La gatta divina affiila i tuoi riflessi.',
    category: 'EXPLORATION',
    maxLevel: 4,
    baseCost: 60,
    costMultiplier: 1.7,
    bonusPerLevel: 0.05,
  },
  RA_TORCH: {
    id: 'RA_TORCH',
    name: 'Torcia di Ra',
    description: '+15% durata torcia per livello. Il dio del sole infonde la sua energia nella tua fiamma.',
    category: 'EXPLORATION',
    maxLevel: 5,
    baseCost: 50,
    costMultiplier: 1.6,
    bonusPerLevel: 0.15,
  },
  OSIRIS_REBIRTH: {
    id: 'OSIRIS_REBIRTH',
    name: 'Rinascita di Osiride',
    description: 'Una volta per run, resuscita a 1 HP invece di morire. Richiede Benedizione di Menat liv. 2.',
    category: 'COMBAT',
    maxLevel: 1,
    baseCost: 300,
    costMultiplier: 1.0,
    bonusPerLevel: 1,
    requires: ['MENAT_BLESSING'],
  },
  SOBEK_VAULT: {
    id: 'SOBEK_VAULT',
    name: 'Caveau di Sobek',
    description: '+10% Ka Fragments trovati per livello. Il coccodrillo custodisce i tesori per te.',
    category: 'UTILITY',
    maxLevel: 5,
    baseCost: 45,
    costMultiplier: 1.7,
    bonusPerLevel: 0.10,
  },
  HATHOR_MEMORY: {
    id: 'HATHOR_MEMORY',
    name: 'Memoria di Hathor',
    description: 'La mappa esplorata persiste tra i floor dello stesso run. Una sola volta: liv. max 1.',
    category: 'UTILITY',
    maxLevel: 1,
    baseCost: 150,
    costMultiplier: 1.0,
    bonusPerLevel: 1,
    requires: ['THOTH_SCROLL'],
  },
  PTAH_CRAFTSMAN: {
    id: 'PTAH_CRAFTSMAN',
    name: 'Artigiano di Ptah',
    description: 'Sblocca uno slot equipaggiamento secondario (pozione o amuleto). Una volta per account.',
    category: 'UTILITY',
    maxLevel: 1,
    baseCost: 200,
    costMultiplier: 1.0,
    bonusPerLevel: 1,
  },
  IMHOTEP_ARCHITECT: {
    id: 'IMHOTEP_ARCHITECT',
    name: 'Architetto Imhotep',
    description: '+1 stanza bonus per floor per livello: più tesori, più rischi.',
    category: 'EXPLORATION',
    maxLevel: 3,
    baseCost: 90,
    costMultiplier: 2.0,
    bonusPerLevel: 1,
    requires: ['THOTH_SCROLL'],
  },
};

/**
 * Calcola il costo in Ka Fragments per portare un upgrade
 * dal livello corrente al livello successivo.
 */
export function upgradeCost(id: UpgradeId, currentLevel: number): number {
  const def = UPGRADE_DEFS[id];
  const nextLevel = currentLevel + 1;
  return Math.round(def.baseCost * nextLevel * def.costMultiplier);
}

/**
 * Calcola il valore del bonus per un upgrade al dato livello.
 */
export function upgradeBonus(id: UpgradeId, level: number): number {
  return UPGRADE_DEFS[id].bonusPerLevel * level;
}

/** Lista ordinata per categoria per la UI. */
export const UPGRADE_IDS_BY_CATEGORY: Record<UpgradeCategory, readonly UpgradeId[]> = {
  COMBAT: ['MENAT_BLESSING', 'SEKHMET_FURY', 'KHEPRI_CARAPACE', 'ANUBIS_SCALE', 'OSIRIS_REBIRTH'],
  EXPLORATION: ['BASTET_AGILITY', 'RA_TORCH', 'THOTH_SCROLL', 'HATHOR_MEMORY', 'IMHOTEP_ARCHITECT'],
  UTILITY: ['SOBEK_VAULT', 'PTAH_CRAFTSMAN'],
};
