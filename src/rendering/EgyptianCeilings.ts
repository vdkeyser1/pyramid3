/**
 * EgyptianCeilings.ts
 * Generatore procedurale per soffitti e volte architettoniche dell'Antico Egitto.
 * Supporta:
 * - Soffitto stellato in lapislazzuli con costellazioni d'oro e dischi solari;
 * - Volta aggettante corbelled (stile Grande Galleria di Giza);
 * - Soffitto a cassettoni monumentali con bassorilievi;
 * - Fenditure crepate con cascata di sabbia.
 */

import * as THREE from 'three';

export type CeilingStyle = 'starlit_lapis' | 'corbelled_vault' | 'coffered_temple' | 'cracked_fissure';

export interface CeilingOptions {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly style: CeilingStyle;
}

export function createEgyptianCeiling(options: CeilingOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = `Ceiling_${options.style}`;

  switch (options.style) {
    case 'starlit_lapis': {
      // 1. Lastra base blu lapislazzuli scuro
      const lapisMat = new THREE.MeshStandardMaterial({
        color: 0x0c1e3d,
        roughness: 0.75,
        metalness: 0.15,
      });
      const slab = new THREE.Mesh(
        new THREE.PlaneGeometry(options.width, options.depth),
        lapisMat,
      );
      slab.rotation.x = Math.PI / 2;
      slab.position.y = options.height;
      group.add(slab);

      // 2. Stelle e costellazioni dorate scintillanti a cinque punte
      const goldStarMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xcc9900,
        emissiveIntensity: 0.85,
        metalness: 0.8,
        roughness: 0.2,
      });

      const starCount = Math.max(12, Math.floor((options.width * options.depth) / 3.5));
      const starGeo = new THREE.OctahedronGeometry(0.12, 0);

      for (let i = 0; i < starCount; i++) {
        const star = new THREE.Mesh(starGeo, goldStarMat);
        const u = ((i * 37) % 100) / 100 - 0.5;
        const v = ((i * 73) % 100) / 100 - 0.5;
        star.position.set(
          u * (options.width - 0.8),
          options.height - 0.02,
          v * (options.depth - 0.8),
        );
        star.rotation.set(0.4, (i * 0.7), 0.2);
        group.add(star);
      }

      // 3. Disco solare centrale alato
      const sunMat = new THREE.MeshStandardMaterial({
        color: 0xf5b041,
        emissive: 0xd68910,
        emissiveIntensity: 1.2,
        roughness: 0.25,
      });
      const sunDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 16), sunMat);
      sunDisc.position.set(0, options.height - 0.02, 0);
      group.add(sunDisc);
      break;
    }

    case 'corbelled_vault': {
      // Volta a gradoni aggettanti verso il colmo centrale (stile Grande Galleria)
      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x6b5432,
        roughness: 0.88,
        metalness: 0.05,
      });

      const tiers = 5;
      const stepH = 0.35;
      for (let i = 0; i < tiers; i++) {
        const inset = i * 0.38;
        const tierW = Math.max(0.6, options.width - inset * 2);
        const beam = new THREE.Mesh(
          new THREE.BoxGeometry(tierW, stepH, options.depth),
          stoneMat,
        );
        beam.position.set(0, options.height + i * stepH, 0);
        group.add(beam);
      }
      break;
    }

    case 'coffered_temple': {
      // Soffitto a cassettoni monumentali con travi ortogonali
      const beamMat = new THREE.MeshStandardMaterial({
        color: 0x544128,
        roughness: 0.82,
      });
      const panelMat = new THREE.MeshStandardMaterial({
        color: 0x3d2e1b,
        roughness: 0.90,
      });

      const baseSlab = new THREE.Mesh(
        new THREE.PlaneGeometry(options.width, options.depth),
        panelMat,
      );
      baseSlab.rotation.x = Math.PI / 2;
      baseSlab.position.y = options.height + 0.1;
      group.add(baseSlab);

      // Travi longitudinali
      const numBeamsX = Math.max(2, Math.floor(options.width / 2.5));
      for (let i = 0; i <= numBeamsX; i++) {
        const x = -options.width / 2 + (i / numBeamsX) * options.width;
        const beam = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.28, options.depth),
          beamMat,
        );
        beam.position.set(x, options.height, 0);
        group.add(beam);
      }

      // Travi trasversali
      const numBeamsZ = Math.max(2, Math.floor(options.depth / 2.5));
      for (let j = 0; j <= numBeamsZ; j++) {
        const z = -options.depth / 2 + (j / numBeamsZ) * options.depth;
        const beam = new THREE.Mesh(
          new THREE.BoxGeometry(options.width, 0.24, 0.28),
          beamMat,
        );
        beam.position.set(0, options.height, z);
        group.add(beam);
      }
      break;
    }

    case 'cracked_fissure':
    default: {
      // Lastrone crepato con fenditura centrale
      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x483a27,
        roughness: 0.92,
      });
      const slabL = new THREE.Mesh(
        new THREE.BoxGeometry(options.width * 0.48, 0.18, options.depth),
        stoneMat,
      );
      slabL.position.set(-options.width * 0.25, options.height, 0);
      slabL.rotation.z = 0.03;

      const slabR = new THREE.Mesh(
        new THREE.BoxGeometry(options.width * 0.48, 0.18, options.depth),
        stoneMat,
      );
      slabR.position.set(options.width * 0.25, options.height, 0);
      slabR.rotation.z = -0.03;

      group.add(slabL, slabR);
      break;
    }
  }

  return group;
}
