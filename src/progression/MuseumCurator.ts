/**
 * Scopo: MuseumCurator (Fase 4) — galleria e museo permanente dei reperti archeologici.
 *        Traccia i tesori storici recuperati nelle cripte e sblocca perk passivi permanenti nell hub.
 * Ownership: progression.
 */

export interface ArchaeologicalRelic {
  readonly id: string;
  readonly name: string;
  readonly dynasty: string;
  readonly description: string;
  readonly historicalNote: string;
  isRecovered: boolean;
}

export interface MuseumPerk {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly requiredRelicsCount: number;
  isUnlocked: boolean;
}

export class MuseumCurator {
  private _relics: ArchaeologicalRelic[] = [
    {
      id: 'CANOPIC_JAR_HORUS',
      name: 'Vaso Canopo di Duamutef',
      dynasty: 'XVIII Dinastia',
      description: 'Vaso in alabastro con testa di sciacallo sacro per la custodia dello stomaco mummificato.',
      historicalNote: 'Rinvenuto intatto nelle cripte secondarie della piana di Giza.',
      isRecovered: false,
    },
    {
      id: 'GOLDEN_SCARAB_AMULET',
      name: 'Scarabeo del Cuore di Cheope',
      dynasty: 'IV Dinastia',
      description: 'Pettorale in oro zecchino e diaspro verde inciso con il capitolo della resurrezione.',
      historicalNote: 'Proteggeva il cuore del sovrano contro le menzogne durante il giudizio di Osiride.',
      isRecovered: false,
    },
    {
      id: 'PAPYRUS_BOOK_OF_DEAD',
      name: 'Rotolo del Papiro di Ani',
      dynasty: 'XIX Dinastia',
      description: 'Frammento miniato in pigmenti vegetali con le formule segrete per superare i guardiani della Duat.',
      historicalNote: 'I colori rosso cinabro e blu egizio sono rimasti inalterati per 3000 anni.',
      isRecovered: false,
    },
    {
      id: 'ROYAL_FLAIL_AND_CROOK',
      name: 'Doppi Scettri Pastorali Reali',
      dynasty: 'XVIII Dinastia',
      description: 'Pastorale e flagello in bronzo ricoperti di foglia d oro ed elettro cerimoniale.',
      historicalNote: 'Simboli assoluti del potere e della guida del faraone sul popolo del Nilo.',
      isRecovered: false,
    },
  ];

  private _perks: MuseumPerk[] = [
    {
      id: 'PERK_EXTENDED_TORCH',
      name: 'Resina degli Imbalsamatori',
      description: 'La torcia iniziale dura 30 secondi in più ad ogni run.',
      requiredRelicsCount: 1,
      isUnlocked: false,
    },
    {
      id: 'PERK_REINFORCED_SHOVEL',
      name: 'Bronzo di Menfi',
      description: 'La pala da scavo ha 2 utilizzi addizionali prima di spezzarsi.',
      requiredRelicsCount: 2,
      isUnlocked: false,
    },
    {
      id: 'PERK_GOLD_FINDER',
      name: 'Fiuto dell Archeologo',
      description: 'Trovi il 20% di oro in più nei sarcofagi e nelle urne.',
      requiredRelicsCount: 4,
      isUnlocked: false,
    },
  ];

  public recoverRelic(relicId: string): boolean {
    const relic = this._relics.find((r) => r.id === relicId);
    if (!relic || relic.isRecovered) return false;

    relic.isRecovered = true;
    this.updatePerks();
    return true;
  }

  private updatePerks(): void {
    const count = this.recoveredCount;
    for (const perk of this._perks) {
      perk.isUnlocked = count >= perk.requiredRelicsCount;
    }
  }

  public get relics(): readonly ArchaeologicalRelic[] {
    return this._relics;
  }

  public get perks(): readonly MuseumPerk[] {
    return this._perks;
  }

  public get recoveredCount(): number {
    return this._relics.filter((r) => r.isRecovered).length;
  }
}
