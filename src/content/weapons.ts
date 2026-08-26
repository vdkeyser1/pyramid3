/**
 * Scopo: definizioni delle armi del vertical slice (§9.4).
 * Ownership: contenuto immutabile.
 */

import { WEAPONS } from './balance.js';
import { secondsToTicks } from './balance.js';
import type { WeaponDefinition } from '../gameplay/weapons/WeaponDefinition.js';

export type WeaponId = string & { readonly __brand: 'WeaponId' };

export const WEAPON_FISTS: WeaponDefinition = {
  id: 'fists' as WeaponId,
  name: 'Mani nude',
  damageHp: WEAPONS.fists.damageHp,
  intervalTicks: WEAPONS.fists.intervalTicks,
  reachM: WEAPONS.fists.reachM,
  durability: WEAPONS.fists.durability,
  durabilityUnit: 'HITS',
  attacks: [
    {
      id: 'fists_jab',
      anticipationTicks: secondsToTicks(0.15),
      activeTicks: secondsToTicks(0.1),
      recoveryTicks: secondsToTicks(0.3),
      damage: WEAPONS.fists.damageHp,
      stagger: 0.1,
      shape: { kind: 'ARC', radiusM: WEAPONS.fists.reachM, arcDeg: 110 },
      interruptibleUntilTick: secondsToTicks(0.1),
      audioCue: 'sfx_fist_swing',
      effectCue: '',
      punishWindowTicks: 0,
      parryable: false,
      knockbackDirectionLocal: { x: 0, z: -1 },
      knockbackForce: 0.5,
    },
  ],
};

export const WEAPON_KHOPESH: WeaponDefinition = {
  id: 'khopesh' as WeaponId,
  name: 'Khopesh',
  damageHp: WEAPONS.khopesh.damageHp,
  intervalTicks: WEAPONS.khopesh.intervalTicks,
  reachM: WEAPONS.khopesh.reachM,
  durability: WEAPONS.khopesh.durability,
  durabilityUnit: 'HITS',
  attacks: [
    {
      id: 'khopesh_slash',
      anticipationTicks: secondsToTicks(0.25),
      activeTicks: secondsToTicks(0.15),
      recoveryTicks: secondsToTicks(0.38),
      damage: WEAPONS.khopesh.damageHp,
      stagger: 0.4,
      shape: { kind: 'ARC', radiusM: WEAPONS.khopesh.reachM, arcDeg: 120 },
      interruptibleUntilTick: secondsToTicks(0.15),
      audioCue: 'sfx_khopesh_slash',
      effectCue: 'vfx_slash_trail',
      punishWindowTicks: 0,
      parryable: true,
      knockbackDirectionLocal: { x: 0, z: -1 },
      knockbackForce: 1.5,
    },
  ],
};

export const WEAPON_STAFF: WeaponDefinition = {
  id: 'staff' as WeaponId,
  name: 'Bastone',
  damageHp: WEAPONS.staff.damageHp,
  intervalTicks: WEAPONS.staff.intervalTicks,
  reachM: WEAPONS.staff.reachM,
  durability: WEAPONS.staff.durability,
  durabilityUnit: 'HITS',
  attacks: [
    {
      id: 'staff_sweep',
      anticipationTicks: secondsToTicks(0.18),
      activeTicks: secondsToTicks(0.12),
      recoveryTicks: secondsToTicks(0.25),
      damage: WEAPONS.staff.damageHp,
      stagger: 0.6,
      shape: { kind: 'ARC', radiusM: WEAPONS.staff.reachM, arcDeg: 140 },
      interruptibleUntilTick: secondsToTicks(0.12),
      audioCue: 'sfx_staff_sweep',
      effectCue: '',
      punishWindowTicks: 0,
      parryable: true,
      knockbackDirectionLocal: { x: 0, z: -1 },
      knockbackForce: 2.0,
    },
  ],
};

export const WEAPON_SHOVEL: WeaponDefinition = {
  id: 'shovel' as WeaponId,
  name: 'Pala',
  damageHp: WEAPONS.shovel.damageHp,
  intervalTicks: WEAPONS.shovel.intervalTicks,
  reachM: WEAPONS.shovel.reachM,
  durability: WEAPONS.shovel.durability,
  durabilityUnit: 'DIGS',
  attacks: [
    {
      id: 'shovel_swing',
      anticipationTicks: secondsToTicks(0.3),
      activeTicks: secondsToTicks(0.2),
      recoveryTicks: secondsToTicks(0.5),
      damage: WEAPONS.shovel.damageHp,
      stagger: 0.2,
      shape: { kind: 'ARC', radiusM: WEAPONS.shovel.reachM, arcDeg: 120 },
      interruptibleUntilTick: secondsToTicks(0.2),
      audioCue: 'sfx_shovel_swing',
      effectCue: '',
      punishWindowTicks: 0,
      parryable: false,
      knockbackDirectionLocal: { x: 0, z: -1 },
      knockbackForce: 1.0,
    },
  ],
};

export const WEAPON_SPEAR_OF_RA: WeaponDefinition = {
  id: 'spear_of_ra' as WeaponId,
  name: 'Lancia Solare di Ra',
  damageHp: WEAPONS.spear.damageHp,
  intervalTicks: WEAPONS.spear.intervalTicks,
  reachM: WEAPONS.spear.reachM,
  durability: WEAPONS.spear.durability,
  durabilityUnit: 'HITS',
  attacks: [
    {
      id: 'spear_thrust',
      anticipationTicks: secondsToTicks(0.20),
      activeTicks: secondsToTicks(0.12),
      recoveryTicks: secondsToTicks(0.38),
      damage: WEAPONS.spear.damageHp,
      stagger: 0.7,
      shape: { kind: 'ARC', radiusM: WEAPONS.spear.reachM, arcDeg: 75 },
      interruptibleUntilTick: secondsToTicks(0.12),
      audioCue: 'sfx_khopesh_slash',
      effectCue: 'vfx_slash_trail',
      punishWindowTicks: 0,
      parryable: true,
      knockbackDirectionLocal: { x: 0, z: -1 },
      knockbackForce: 2.2,
    },
  ],
};

export const WEAPON_GOLDEN_KHOPESH: WeaponDefinition = {
  id: 'golden_khopesh' as WeaponId,
  name: 'Khopesh Faraonico',
  damageHp: WEAPONS.golden_khopesh.damageHp,
  intervalTicks: WEAPONS.golden_khopesh.intervalTicks,
  reachM: WEAPONS.golden_khopesh.reachM,
  durability: WEAPONS.golden_khopesh.durability,
  durabilityUnit: 'HITS',
  attacks: [
    {
      id: 'golden_khopesh_slash',
      anticipationTicks: secondsToTicks(0.20),
      activeTicks: secondsToTicks(0.12),
      recoveryTicks: secondsToTicks(0.32),
      damage: WEAPONS.golden_khopesh.damageHp,
      stagger: 0.5,
      shape: { kind: 'ARC', radiusM: WEAPONS.golden_khopesh.reachM, arcDeg: 130 },
      interruptibleUntilTick: secondsToTicks(0.12),
      audioCue: 'sfx_khopesh_slash',
      effectCue: 'vfx_slash_trail',
      punishWindowTicks: 0,
      parryable: true,
      knockbackDirectionLocal: { x: 0, z: -1 },
      knockbackForce: 1.8,
    },
  ],
};

export const WEAPON_ANUBIS_SICKLE: WeaponDefinition = {
  id: 'anubis_sickle' as WeaponId,
  name: 'Falce Rituale di Anubi',
  damageHp: WEAPONS.anubis_sickle.damageHp,
  intervalTicks: WEAPONS.anubis_sickle.intervalTicks,
  reachM: WEAPONS.anubis_sickle.reachM,
  durability: WEAPONS.anubis_sickle.durability,
  durabilityUnit: 'HITS',
  attacks: [
    {
      id: 'sickle_reap',
      anticipationTicks: secondsToTicks(0.18),
      activeTicks: secondsToTicks(0.10),
      recoveryTicks: secondsToTicks(0.30),
      damage: WEAPONS.anubis_sickle.damageHp,
      stagger: 0.4,
      shape: { kind: 'ARC', radiusM: WEAPONS.anubis_sickle.reachM, arcDeg: 125 },
      interruptibleUntilTick: secondsToTicks(0.13),
      audioCue: 'sfx_khopesh_slash',
      effectCue: 'vfx_slash_trail',
      punishWindowTicks: 0,
      parryable: true,
      knockbackDirectionLocal: { x: 0, z: -1 },
      knockbackForce: 1.4,
    },
  ],
};

export const ALL_WEAPONS: readonly WeaponDefinition[] = [
  WEAPON_FISTS,
  WEAPON_KHOPESH,
  WEAPON_STAFF,
  WEAPON_SHOVEL,
  WEAPON_SPEAR_OF_RA,
  WEAPON_GOLDEN_KHOPESH,
  WEAPON_ANUBIS_SICKLE,
];
