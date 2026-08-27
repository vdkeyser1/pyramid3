/**
 * Scopo: PactSarcophagi (Fase 3) — sarcofagi maledetti con patti del faraone (Risk/Reward).
 *        Offrono ricompense imponenti in cambio di maledizioni e condizioni di riscatto.
 * Ownership: content (puro e deterministico).
 */

export interface PharaohPact {
  readonly id: string;
  readonly name: string;
  readonly boonDescription: string;
  readonly curseDescription: string;
  readonly goldReward: number;
  readonly guaranteedLegendaryWeaponId?: string;
  readonly visionRadiusM?: number;
  readonly missDamagePenaltyHp?: number;
  readonly enemySpeedIncreasePercent?: number;
  readonly purgeKillsRequired: number;
}

export const PHARAOH_PACTS: readonly PharaohPact[] = [
  {
    id: 'PACT_BLIND_TREASURE',
    name: 'Patto della Sabbia Cieca',
    boonDescription: 'Ricevi all istante 150 pezzi d oro puro del tesoro reale.',
    curseDescription: 'La polvere maledetta riduce il tuo campo visivo a soli 4 metri finché non abbatti 6 nemici.',
    goldReward: 150,
    visionRadiusM: 4.0,
    purgeKillsRequired: 6,
  },
  {
    id: 'PACT_BLOOD_REAP',
    name: 'Patto del Sangue Freddo',
    boonDescription: 'Ottieni la Falce Rituale di Anubi forgiata in basalto nero.',
    curseDescription: 'Ogni fendente sferrato a vuoto consuma 2 punti salute per la sete di sangue della lama.',
    goldReward: 0,
    guaranteedLegendaryWeaponId: 'anubis_sickle',
    missDamagePenaltyHp: 2,
    purgeKillsRequired: 8,
  },
  {
    id: 'PACT_SEKHMET_CHALLENGE',
    name: 'Sfida della Dea Leonessa',
    boonDescription: 'Il danno di tutte le tue armi aumenta del 50%.',
    curseDescription: 'Tutti i nemici del piano si muovono al 130% di velocità e sono immuni allo stagger.',
    goldReward: 80,
    enemySpeedIncreasePercent: 30,
    purgeKillsRequired: 10,
  },
];

export function getPharaohPactById(id: string): PharaohPact | undefined {
  return PHARAOH_PACTS.find((p) => p.id === id);
}
