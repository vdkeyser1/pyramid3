import { describe, it, expect } from 'vitest';
import {
  createSwingingBladeMesh,
  createDartWallTrapMesh,
  createPressurePlateMesh,
} from '../../src/rendering/EgyptianTrapsMesh';
import {
  updateSwingingBlades,
  updatePressurePlates,
} from '../../src/gameplay/traps/EgyptianTrapsSystem';

describe('EgyptianTraps', () => {
  it('crea le mesh 3D per tutte le trappole', () => {
    const blade = createSwingingBladeMesh();
    const dartWall = createDartWallTrapMesh();
    const plate = createPressurePlateMesh();

    expect(blade.name).toBe('SwingingBladeTrap');
    expect(dartWall.name).toBe('DartWallTrap');
    expect(plate.name).toBe('PressurePlateTrap');
  });

  it('calcola l oscillazione della lama e applica danno se il player entra nel raggio', () => {
    const blade = {
      id: 'b1',
      x: 0,
      y: 3.5,
      z: 0,
      axis: 'x' as const,
      speedRadSec: 2.0,
      maxAngleRad: 0.8,
      currentAngleRad: 0,
      damageHp: 35,
      hitRadiusM: 1.2,
    };

    const res = updateSwingingBlades([blade], 0, { x: 0, y: 0.7, z: 0 });
    expect(res.totalDamage).toBe(35);
    expect(res.hitBladeId).toBe('b1');
  });

  it('attiva la piastra a pressione quando il player ci cammina sopra', () => {
    const plate = {
      id: 'p1',
      x: 2,
      z: 2,
      triggerRadiusM: 0.8,
      isTriggered: false,
      cooldownSec: 0,
      dartDamageHp: 20,
    };

    const res = updatePressurePlates([plate], 0.1, { x: 2.1, y: 0, z: 2.1 });
    expect(res.triggeredPlate).toBeDefined();
    expect(res.damageHp).toBe(20);
    expect(plate.isTriggered).toBe(true);
  });
});
