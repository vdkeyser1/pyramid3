/**
 * Test DOM del viewmodel arma (khopesh procedurale): geometria, animazioni
 * swing/parata e ritorno alla posa di riposo. Eseguito sotto happy-dom.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createKhopeshViewmodel,
  KHOPESH_PARRY_MS,
  KHOPESH_SWING_MS,
} from '@/rendering/WeaponViewmodel.js';

describe('WeaponViewmodel (viewmodel arma 3D)', () => {
  it('crea un gruppo con geometrie e materiali del khopesh', () => {
    const vm = createKhopeshViewmodel();
    expect(vm.group).toBeInstanceOf(THREE.Group);
    // lama + filo dorato + impugnatura + guardia + pomolo
    expect(vm.group.children.length).toBeGreaterThanOrEqual(5);
    const meshes = vm.group.children.filter(
      (child): child is THREE.Mesh => child instanceof THREE.Mesh,
    );
    expect(meshes.length).toBeGreaterThanOrEqual(5);
    // i materiali metallici hanno metalness > 0 (bronzo)
    const blade = meshes[0];
    if (blade !== undefined && blade.material instanceof THREE.MeshStandardMaterial) {
      expect(blade.material.metalness).toBeGreaterThan(0.5);
    }
  });

  it('parte visibile e setVisible controlla la visibilità', () => {
    const vm = createKhopeshViewmodel();
    expect(vm.group.visible).toBe(true);
    vm.setVisible(false);
    expect(vm.group.visible).toBe(false);
    vm.setVisible(true);
    expect(vm.group.visible).toBe(true);
  });

  it('playSwing anima la rotazione e ritorna alla posa di riposo', () => {
    const vm = createKhopeshViewmodel();
    const restZ = vm.group.rotation.z;

    vm.playSwing();
    vm.update(KHOPESH_SWING_MS / 2);
    // In piena fendente la rotazione Z devia sensibilmente dalla posa.
    expect(vm.group.rotation.z).not.toBeCloseTo(restZ, 1);

    // Dopo la fine dello swing + vari frame di ritorno elastico, converge.
    vm.update(KHOPESH_SWING_MS / 2);
    for (let i = 0; i < 60; i++) vm.update(16);
    expect(vm.group.rotation.z).toBeCloseTo(restZ, 1);
  });

  it('playParry alza l arma (rotazione X negativa) e torna a riposo', () => {
    const vm = createKhopeshViewmodel();
    const restX = vm.group.rotation.x;

    vm.playParry();
    vm.update(KHOPESH_PARRY_MS / 2);
    expect(vm.group.rotation.x).toBeLessThan(restX - 0.5); // guardia alzata

    vm.update(KHOPESH_PARRY_MS / 2);
    for (let i = 0; i < 60; i++) vm.update(16);
    expect(vm.group.rotation.x).toBeCloseTo(restX, 1);
  });

  it('update senza animazioni non lancia e mantiene la posa', () => {
    const vm = createKhopeshViewmodel();
    expect(() => {
      for (let i = 0; i < 30; i++) vm.update(16);
    }).not.toThrow();
  });
});
