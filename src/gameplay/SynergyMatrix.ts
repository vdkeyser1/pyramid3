/**
 * Scopo: SynergyMatrix (Fase 3) — risolutore delle sinergie emergenti nel buildcrafting.
 *        Combina armi egizie, benedizioni degli dei e reliquie per scatenare effetti a catena.
 * Ownership: gameplay.
 */

export interface ActiveSynergy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly fireWaveBonusDamage?: number;
  readonly instantDecapitateHpThreshold?: number;
  readonly lifeStealPercent?: number;
  readonly wallEchoDetectionRadiusM?: number;
  readonly unlitDamageMultiplier?: number;
}

export function resolveSynergies(
  equippedWeaponId: string,
  activeBlessingIds: readonly string[],
  isTorchLit: boolean,
): readonly ActiveSynergy[] {
  const list: ActiveSynergy[] = [];

  const hasRa = activeBlessingIds.some((id) => id.includes('RA'));
  const hasAnubis = activeBlessingIds.some((id) => id.includes('ANUBIS'));
  const hasOsiris = activeBlessingIds.some((id) => id.includes('OSIRIS'));
  const hasThoth = activeBlessingIds.some((id) => id.includes('THOTH'));
  const hasSekhmet = activeBlessingIds.some((id) => id.includes('SEKHMET'));

  // 1. Supernova Solare (Lancia di Ra + Ra)
  if (equippedWeaponId.includes('spear') && hasRa) {
    list.push({
      id: 'SOLAR_SUPERNOVA',
      name: 'Supernova Solare',
      description: 'Gli affondi della lancia scatenano un onda d urto termica che incendia i nemici.',
      fireWaveBonusDamage: 12,
    });
  }

  // 2. Sentenza del Boia (Khopesh Dorato + Anubi)
  if (equippedWeaponId.includes('golden_khopesh') && hasAnubis) {
    list.push({
      id: 'EXECUTIONER_VERDICT',
      name: 'Sentenza del Boia',
      description: 'Ogni parry riuscito decapita all istante i nemici feriti con meno del 35% di salute.',
      instantDecapitateHpThreshold: 0.35,
    });
  }

  // 3. Mietitore di Ka (Falce di Anubi + Osiride)
  if (equippedWeaponId.includes('sickle') && hasOsiris) {
    list.push({
      id: 'KA_REAPER',
      name: 'Mietitore di Ka',
      description: 'Il 20% del danno inflitto ai nemici viene convertito in salute rigenerata.',
      lifeStealPercent: 0.20,
    });
  }

  // 4. Eco Archeologico (Thoth + Qualsiasi arma)
  if (hasThoth) {
    list.push({
      id: 'ARCHAEOLOGICAL_ECHO',
      name: 'Eco Archeologico',
      description: 'I colpi contro le pareti rivelano le trappole e i forzieri nascosti nel raggio di 14 metri.',
      wallEchoDetectionRadiusM: 14,
    });
  }

  // 5. Frenesia Faraonica (Sekhmet + Torcia spenta)
  if (hasSekhmet && !isTorchLit) {
    list.push({
      id: 'PHARAOH_FRENZY',
      name: 'Frenesia Faraonica',
      description: 'Nel buio più assoluto, i tuoi colpi infliggono il doppio dei danni.',
      unlitDamageMultiplier: 2.0,
    });
  }

  return list;
}
