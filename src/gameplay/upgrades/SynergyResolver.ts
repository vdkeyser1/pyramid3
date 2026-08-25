/**
 * G-03 — Sinergie tra maledizioni e oggetti.
 *
 * Scopo: data-table + resolver puro che calcola i bonus di sinergia attivi dato
 *        il set corrente di oggetti e maledizioni del giocatore.
 * Ownership: pura — nessuna dipendenza di rendering, no performance.now().
 *            Chiamato dal sistema di aggiornamento statistiche dopo ogni pickup.
 *
 * Design:
 *   Una SynergyRule si attiva se l'insieme di requiredItems ⊆ activeItems
 *   AND l'insieme di requiredCurses ⊆ activeCurses.
 *   Una regola può richiedere solo oggetti, solo maledizioni, o entrambi.
 *   Se nessun requisito è specificato la regola è ignorata (evita sinergie vacue).
 *
 * Invarianti:
 *   - Ogni regola ha id univoco;
 *   - requiredItems e requiredCurses non possono essere entrambi vuoti;
 *   - i SynergyEffect sono additivi (si sommano tra loro).
 */

// ── Tipi ─────────────────────────────────────────────────────────────────────

/** ID di un oggetto (arma, amuleto, reliquia…). */
export type ItemId = string & { readonly __brand: 'ItemId' };

/** ID di una maledizione attiva. */
export type CurseId = string & { readonly __brand: 'CurseId' };

/** Tipo di effetto di sinergia. */
export type SynergyEffectKind =
  | 'DAMAGE_MULTIPLIER'        // moltiplica il danno base
  | 'SPEED_MULTIPLIER'         // moltiplica la velocità di movimento
  | 'INVINCIBILITY_FRAMES'     // aggiunge frame di invincibilità
  | 'HP_REGEN_PER_KILL'        // HP rigenerati per ogni kill
  | 'LOOT_QUANTITY_BONUS'      // oggetti extra nei drop
  | 'PROJECTILE_COUNT'         // proiettili aggiuntivi per attacco
  | 'CURSE_DURATION_REDUCTION' // riduce la durata delle maledizioni (%)
  | 'TRAP_IMMUNITY'            // immunità a una categoria di trappola
  | 'BOSS_DAMAGE_BONUS';       // bonus danno vs boss

/** Singolo effetto prodotto da una sinergia. */
export interface SynergyEffect {
  readonly kind:        SynergyEffectKind;
  /** Valore numerico dell'effetto (semantica dipende dal kind). */
  readonly value:       number;
  /** ID della sinergia che ha generato l'effetto (per debug e UI). */
  readonly synergyId:   string;
  /** Nome leggibile mostrato in HUD/tooltip. */
  readonly displayName: string;
  /** Descrizione per il tooltip dell'inventario. */
  readonly description: string;
}

/** Regola di sinergia: condizioni + effetti prodotti se soddisfatte. */
export interface SynergyRule {
  readonly id:             string;
  readonly displayName:    string;
  readonly description:    string;
  /** Oggetti necessari (tutti devono essere presenti). Può essere vuoto. */
  readonly requiredItems:  readonly ItemId[];
  /** Maledizioni necessarie (tutte devono essere presenti). Può essere vuoto. */
  readonly requiredCurses: readonly CurseId[];
  /** Effetti applicati se la regola è attiva. */
  readonly effects:        readonly Omit<SynergyEffect, 'synergyId'>[];
}

// ── Tabella sinergie ──────────────────────────────────────────────────────────

/**
 * Forza la conversione di stringa letterale a ItemId / CurseId branded type.
 * Solo in questo modulo — non esportare queste helper per evitare cast non controllati.
 */
const item  = (s: string) => s as ItemId;
const curse = (s: string) => s as CurseId;

/**
 * Tabella globale delle sinergie disponibili.
 * Aggiungere nuove righe qui per estendere il sistema — nessun altro file da modificare.
 */
export const SYNERGY_RULES: readonly SynergyRule[] = [

  // ── Sinergie oggetto + maledizione ─────────────────────────────────────────

  {
    id:             'SYN_SCARAB_CURSE_SWARM',
    displayName:    'Sciame Benedetto',
    description:    'Amuleto dello Scarabeo + Maledizione della Sciamatura: i proiettili aggiuntivi riflettono i tuoi peccati.',
    requiredItems:  [item('AMULET_SCARAB')],
    requiredCurses: [curse('CURSE_SWARM')],
    effects: [
      {
        kind:        'PROJECTILE_COUNT',
        value:       2,
        displayName: '+2 proiettili per attacco',
        description: 'La maledizione amplifica il potere dello scarabeo.',
      },
      {
        kind:        'SPEED_MULTIPLIER',
        value:       0.85,
        displayName: '–15% velocità',
        description: 'Il peso dello sciame rallenta i movimenti.',
      },
    ],
  },

  {
    id:             'SYN_ANKH_CURSE_DECAY',
    displayName:    'Vita nel Decadimento',
    description:    'Ankh della Resurrezione + Maledizione del Decadimento: la morte lenta alimenta la rinascita.',
    requiredItems:  [item('ANKH_RESURRECTION')],
    requiredCurses: [curse('CURSE_DECAY')],
    effects: [
      {
        kind:        'HP_REGEN_PER_KILL',
        value:       3,
        displayName: '+3 HP per kill',
        description: 'Ogni nemico ucciso rallenta il decadimento.',
      },
    ],
  },

  {
    id:             'SYN_KHOPESH_CURSE_BLOOD',
    displayName:    'Furia Sanguinaria',
    description:    'Khopesh + Maledizione del Sangue: più sei ferito, più sei letale.',
    requiredItems:  [item('WEAPON_KHOPESH')],
    requiredCurses: [curse('CURSE_BLOOD_FRENZY')],
    effects: [
      {
        kind:        'DAMAGE_MULTIPLIER',
        value:       1.5,
        displayName: '×1.5 danno',
        description: 'Il sangue versato acuisce la lama.',
      },
      {
        kind:        'INVINCIBILITY_FRAMES',
        value:       -3,
        displayName: '–3 frame invincibilità',
        description: 'La frenesia riduce i riflessi difensivi.',
      },
    ],
  },

  {
    id:             'SYN_LAPIS_CURSE_STONE',
    displayName:    'Pelle di Pietra',
    description:    'Lapislazzuli di Ra + Maledizione della Pietrificazione: la lentezza diventa armatura.',
    requiredItems:  [item('GEM_LAPIS_RA')],
    requiredCurses: [curse('CURSE_PETRIFICATION')],
    effects: [
      {
        kind:        'DAMAGE_MULTIPLIER',
        value:       0.80,
        displayName: '–20% danno subìto',
        description: 'La pietrificazione parziale protegge il corpo.',
      },
      {
        kind:        'SPEED_MULTIPLIER',
        value:       0.70,
        displayName: '–30% velocità',
        description: 'Le membra indurite rallentano ogni passo.',
      },
    ],
  },

  {
    id:             'SYN_SOBEK_SCALE_CURSE_FLOOD',
    displayName:    'Signore delle Acque',
    description:    'Scaglia di Sobek + Maledizione dell\'Alluvione: l\'acqua putrefatta non ti tocca.',
    requiredItems:  [item('SCALE_SOBEK')],
    requiredCurses: [curse('CURSE_FLOOD')],
    effects: [
      {
        kind:        'TRAP_IMMUNITY',
        value:       1,
        displayName: 'Immunità trappole d\'acqua',
        description: 'L\'acqua maledetta ti appartiene.',
      },
      {
        kind:        'BOSS_DAMAGE_BONUS',
        value:       0.25,
        displayName: '+25% danno ai boss acquatici',
        description: 'Conosci la debolezza del dio dei coccodrilli.',
      },
    ],
  },

  // ── Sinergie solo oggetti ──────────────────────────────────────────────────

  {
    id:             'SYN_DUAL_ANKH',
    displayName:    'Doppia Resurrezione',
    description:    'Due Ankh: ogni morte è soltanto una pausa.',
    requiredItems:  [item('ANKH_RESURRECTION'), item('ANKH_FRAGMENT_KHEPRI')],
    requiredCurses: [],
    effects: [
      {
        kind:        'HP_REGEN_PER_KILL',
        value:       1,
        displayName: '+1 HP per kill',
        description: 'I due amuleti rigenerano passivamente.',
      },
    ],
  },

  {
    id:             'SYN_FULL_ARSENAL',
    displayName:    'Arsenal del Faraone',
    description:    'Khopesh + Daga del Cobrar + Bastone di Ra: padrone di tutte le discipline di combattimento.',
    requiredItems:  [item('WEAPON_KHOPESH'), item('WEAPON_COBRA_DAGGER'), item('WEAPON_RA_STAFF')],
    requiredCurses: [],
    effects: [
      {
        kind:        'DAMAGE_MULTIPLIER',
        value:       1.20,
        displayName: '+20% danno',
        description: 'La maestria totale amplifica ogni colpo.',
      },
      {
        kind:        'LOOT_QUANTITY_BONUS',
        value:       1,
        displayName: '+1 oggetto extra per stanza',
        description: 'La fama attira le offerte.',
      },
    ],
  },

  // ── Sinergie solo maledizioni ──────────────────────────────────────────────

  {
    id:             'SYN_TRIPLE_CURSE',
    displayName:    'Tre Pesi',
    description:    'Tre maledizioni attive: il peso diventa forza.',
    requiredItems:  [],
    requiredCurses: [curse('CURSE_DECAY'), curse('CURSE_BLOOD_FRENZY'), curse('CURSE_SWARM')],
    effects: [
      {
        kind:        'DAMAGE_MULTIPLIER',
        value:       1.40,
        displayName: '+40% danno',
        description: 'Chi porta tre fardelli li trasforma in armi.',
      },
      {
        kind:        'CURSE_DURATION_REDUCTION',
        value:       0.20,
        displayName: '–20% durata maledizioni',
        description: 'L\'abitudine ammortizza la sofferenza.',
      },
    ],
  },

];

// ── Validator (usato dai test) ────────────────────────────────────────────────

/**
 * Verifica l'integrità della tabella sinergie.
 * Controlla: id univoci, almeno un requisito per regola.
 */
export function validateSynergyRules(): readonly string[] {
  const problems: string[] = [];
  const ids = new Set<string>();

  for (const rule of SYNERGY_RULES) {
    if (ids.has(rule.id)) {
      problems.push(`id duplicato: ${rule.id}`);
    }
    ids.add(rule.id);

    if (rule.requiredItems.length === 0 && rule.requiredCurses.length === 0) {
      problems.push(`regola senza requisiti: ${rule.id}`);
    }

    if (rule.effects.length === 0) {
      problems.push(`regola senza effetti: ${rule.id}`);
    }
  }

  return problems;
}

// ── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Calcola i SynergyEffect attivi dato il set di oggetti e maledizioni del giocatore.
 * Pura — non modifica nessuno stato globale.
 *
 * @param activeItems  - Set di ItemId presenti nell'inventario del giocatore.
 * @param activeCurses - Set di CurseId attualmente attivi.
 * @returns Array di SynergyEffect da applicare alle statistiche del giocatore.
 */
export function resolveSynergies(
  activeItems:  ReadonlySet<ItemId>,
  activeCurses: ReadonlySet<CurseId>,
): readonly SynergyEffect[] {
  const results: SynergyEffect[] = [];

  for (const rule of SYNERGY_RULES) {
    // Verifica requisiti oggetti
    const itemsOk  = rule.requiredItems.every((id) => activeItems.has(id));
    // Verifica requisiti maledizioni
    const cursesOk = rule.requiredCurses.every((id) => activeCurses.has(id));

    if (itemsOk && cursesOk) {
      for (const effect of rule.effects) {
        results.push({ ...effect, synergyId: rule.id });
      }
    }
  }

  return results;
}

/**
 * Versione tipizzata helper: converte array in Set prima di chiamare resolveSynergies.
 */
export function resolveSynergiesFromArrays(
  activeItems:  readonly ItemId[],
  activeCurses: readonly CurseId[],
): readonly SynergyEffect[] {
  return resolveSynergies(
    new Set(activeItems),
    new Set(activeCurses),
  );
}

/**
 * Filtra gli effetti per kind, utile per sommare i bonus di una singola categoria.
 *
 * @example
 * const damageMultipliers = filterEffectsByKind(effects, 'DAMAGE_MULTIPLIER');
 * const totalMultiplier   = damageMultipliers.reduce((acc, e) => acc * e.value, 1);
 */
export function filterEffectsByKind(
  effects: readonly SynergyEffect[],
  kind:    SynergyEffectKind,
): readonly SynergyEffect[] {
  return effects.filter((e) => e.kind === kind);
}
