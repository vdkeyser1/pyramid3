/**
 * EgyptianTrapsSystem.ts
 * Gestione logica e runtime per le trappole della piramide.
 * Include:
 * - Oscillazione armonica delle lame con calcolo volume di taglio;
 * - Trigger di piastre a pressione e sparo dardi con tempo di reazione;
 * - Reset e disinnesco temporaneo.
 */

export interface SwingingBladeInstance {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly axis: 'x' | 'z';
  readonly speedRadSec: number;
  readonly maxAngleRad: number;
  currentAngleRad: number;
  readonly damageHp: number;
  readonly hitRadiusM: number;
}

export interface PressurePlateInstance {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly triggerRadiusM: number;
  isTriggered: boolean;
  cooldownSec: number;
  readonly dartDamageHp: number;
}

export function updateSwingingBlades(
  blades: SwingingBladeInstance[],
  elapsedSec: number,
  playerPos: { x: number; y: number; z: number },
): { totalDamage: number; hitBladeId: string | null } {
  let totalDamage = 0;
  let hitBladeId: string | null = null;

  for (const blade of blades) {
    blade.currentAngleRad = Math.sin(elapsedSec * blade.speedRadSec) * blade.maxAngleRad;

    // Calcolo posizione della lama a terra
    const bladeBottomY = blade.y - 2.8 * Math.cos(blade.currentAngleRad);
    const bladeOffset = 2.8 * Math.sin(blade.currentAngleRad);
    const bladeX = blade.axis === 'x' ? blade.x + bladeOffset : blade.x;
    const bladeZ = blade.axis === 'z' ? blade.z + bladeOffset : blade.z;

    const dx = playerPos.x - bladeX;
    const dy = playerPos.y - bladeBottomY;
    const dz = playerPos.z - bladeZ;
    const distSq = dx * dx + dy * dy + dz * dz;

    if (distSq <= blade.hitRadiusM * blade.hitRadiusM) {
      totalDamage += blade.damageHp;
      hitBladeId = blade.id;
    }
  }

  return { totalDamage, hitBladeId };
}

export function updatePressurePlates(
  plates: PressurePlateInstance[],
  deltaSec: number,
  playerPos: { x: number; y: number; z: number },
): { triggeredPlate: PressurePlateInstance | null; damageHp: number } {
  for (const plate of plates) {
    if (plate.cooldownSec > 0) {
      plate.cooldownSec = Math.max(0, plate.cooldownSec - deltaSec);
    }

    const dx = playerPos.x - plate.x;
    const dz = playerPos.z - plate.z;
    const dist = Math.hypot(dx, dz);

    if (dist <= plate.triggerRadiusM && plate.cooldownSec <= 0) {
      plate.isTriggered = true;
      plate.cooldownSec = 4.0;
      return { triggeredPlate: plate, damageHp: plate.dartDamageHp };
    }
  }

  return { triggeredPlate: null, damageHp: 0 };
}
