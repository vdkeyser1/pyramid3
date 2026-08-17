/**
 * Scopo: materiali e shader custom del progetto (G-16) — dissolve per la morte
 *        dei nemici, texture procedurale geroglifica per i landmark luminosi e
 *        sabbia/pietra con dettaglio procedurale. Tutto generato a runtime:
 *        nessun asset esterno richiesto (coerente con la filosofia del progetto).
 * Ownership: rendering. Consumato da ThreeRendererService/ThreeDungeonLayout.
 * Invarianti:
 *   - le texture procedurali sono deterministiche (nessun Math.random);
 *   - il dissolve è un valore 0..1 pilotato dal chiamante (mai qui);
 *   - i materiali restano compatibili con WebGL2 e WebGPU (MeshStandardMaterial).
 * Failure mode: canvas 2D non disponibile → texture null (materiale piatto).
 */

import * as THREE from 'three';
import { createLogger } from '@/core/Logger.js';

const log = createLogger('Materials');

// ── Texture procedurale geroglifica ─────────────────────────────────────────

const GLYPH_BLOCKS = [
  // Pattern geroglifici stilizzati: 0 = vuoto, 1 = tratto, 2 = ankh, 3 = occhio
  [
    [0, 0, 1, 0, 2, 0, 1, 0, 0],
    [0, 1, 0, 1, 0, 1, 0, 1, 0],
    [1, 0, 2, 0, 1, 0, 2, 0, 1],
    [0, 1, 0, 1, 0, 1, 0, 1, 0],
    [0, 0, 1, 0, 3, 0, 1, 0, 0],
    [0, 1, 0, 1, 0, 1, 0, 1, 0],
    [1, 0, 2, 0, 1, 0, 2, 0, 1],
    [0, 1, 0, 1, 0, 1, 0, 1, 0],
    [0, 0, 1, 0, 2, 0, 1, 0, 0],
  ],
];

/**
 * Genera una texture Canvas 2D con un pattern geroglifico stilizzato.
 * Deterministico: stesso seed ⇒ stessa texture.
 */
export function createHieroglyphTexture(
  seed = 0,
  size = 256,
  color = '#6ee0d1',
): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  context.fillStyle = '#05080a';
  context.fillRect(0, 0, size, size);
  context.strokeStyle = color;
  context.lineWidth = Math.max(1, size / 220);
  context.fillStyle = color;

  const block = GLYPH_BLOCKS[seed % GLYPH_BLOCKS.length] ?? GLYPH_BLOCKS[0];
  if (!block) {
    return null;
  }
  const cell = size / 9;
  for (let row = 0; row < 9; row++) {
    const glyphRow = block[row];
    if (!glyphRow) continue;
    for (let col = 0; col < 9; col++) {
      const glyph = glyphRow[col];
      if (!glyph) continue;
      const x = col * cell + cell / 2;
      const y = row * cell + cell / 2;
      if (glyph === 1) {
        // Tratto orizzontale (geroglifico "acqua/corda")
        context.beginPath();
        context.moveTo(x - cell * 0.32, y);
        context.lineTo(x + cell * 0.32, y);
        context.stroke();
      } else if (glyph === 2) {
        // Ankh stilizzato
        context.beginPath();
        context.arc(x, y - cell * 0.1, cell * 0.16, 0, Math.PI * 2);
        context.stroke();
        context.beginPath();
        context.moveTo(x, y + cell * 0.06);
        context.lineTo(x, y + cell * 0.34);
        context.stroke();
        context.beginPath();
        context.moveTo(x - cell * 0.12, y + cell * 0.16);
        context.lineTo(x + cell * 0.12, y + cell * 0.16);
        context.stroke();
      } else {
        // Occhio di Horus stilizzato (ellisse + punto)
        context.beginPath();
        context.ellipse(x, y, cell * 0.22, cell * 0.12, 0, 0, Math.PI * 2);
        context.stroke();
        context.beginPath();
        context.arc(x, y, cell * 0.05, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// ── Texture procedurale sabbia ──────────────────────────────────────────────

/**
 * Genera una texture di sabbia granulare con variabilità leggera.
 * Deterministico: nessun Math.random (uso hash del pixel).
 */
export function createSandTexture(size = 256, base = '#8a7350'): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  context.fillStyle = base;
  context.fillRect(0, 0, size, size);

  const imageData = context.getImageData(0, 0, size, size);
  const data = imageData.data;
  // Granuli deterministici via hash di (x,y)
  let state = 0x9e3779b9;
  for (let i = 0; i < data.length; i += 4) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const noise = ((state >>> 16) % 24) - 12;
    const r = data[i] ?? 128;
    const g = data[i + 1] ?? 128;
    const b = data[i + 2] ?? 128;
    data[i] = Math.max(0, Math.min(255, r + noise));
    data[i + 1] = Math.max(0, Math.min(255, g + noise));
    data[i + 2] = Math.max(0, Math.min(255, b + noise));
  }
  context.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

// ── Materiale dissolve (morte nemici) ──────────────────────────────────────

/**
 * Crea un materiale con supporto dissolve: il chiamante imposta `uniforms.uDissolve`
 * da 0 (intatto) a 1 (sparito). Base MeshStandardMaterial con onBeforeCompile
 * che inietta il clipping per soglia + bordo emissivo.
 */
export function createDissolveMaterial(
  color = 0x8a7a5a,
  dissolveColor = 0xd4a05a,
): { material: THREE.MeshStandardMaterial; setDissolve: (value: number) => void } {
  const uniforms = {
    uDissolve: { value: 0 },
    uDissolveColor: { value: new THREE.Color(dissolveColor) },
  };

  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.15 });

  material.onBeforeCompile = (shader): void => {
    shader.uniforms.uDissolve = uniforms.uDissolve;
    shader.uniforms.uDissolveColor = uniforms.uDissolveColor;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       varying vec2 vDissolveUv;`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
       vDissolveUv = uv;`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       uniform float uDissolve;
       uniform vec3 uDissolveColor;
       varying vec2 vDissolveUv;`,
    );
    // Clipping per soglia: sopra la soglia il pixel viene scartato
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
       float noise = fract(sin(dot(vDissolveUv * 37.0, vec2(12.9898, 78.233))) * 43758.5453);
       float threshold = uDissolve;
       if (vDissolveUv.y < threshold - noise * 0.06) discard;
       float edge = smoothstep(threshold - 0.08, threshold, vDissolveUv.y);
       gl_FragColor.rgb = mix(gl_FragColor.rgb, uDissolveColor, edge * 0.9);`,
    );
  };

  return {
    material,
    setDissolve: (value: number): void => {
      uniforms.uDissolve.value = Math.max(0, Math.min(1, value));
    },
  };
}

// ── Texture PBR da file (ambientCG, CC0) con fallback procedurale ──────────

export interface PbrTextureSet {
  color: THREE.Texture | null;
  normal: THREE.Texture | null;
  /** G-16 esteso: roughness map (sabbia lucida vs opaca) opzionale. */
  roughness: THREE.Texture | null;
  /** G-16 esteso: ambient occlusion (incavi scuri) opzionale. */
  ao: THREE.Texture | null;
}

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');

function configureRepeat(texture: THREE.Texture, repeatX: number, repeatY: number): THREE.Texture {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Carica colore + normal (+ roughness/AO opzionali) da /textures
 * (ambientCG CC0). Se un file manca (sviluppo offline o asset rimossi),
 * ritorna null per quel canale e il chiamante usa il fallback procedurale —
 * nessun crash.
 */
export function loadPbrTextureSet(
  colorPath: string,
  normalPath: string | null,
  repeatX = 1,
  repeatY = 1,
  roughnessPath: string | null = null,
  aoPath: string | null = null,
): PbrTextureSet {
  const set: PbrTextureSet = { color: null, normal: null, roughness: null, ao: null };
  try {
    set.color = configureRepeat(textureLoader.load(colorPath), repeatX, repeatY);
    if (normalPath) {
      const normal = configureRepeat(textureLoader.load(normalPath), repeatX, repeatY);
      normal.colorSpace = THREE.NoColorSpace;
      set.normal = normal;
    }
    if (roughnessPath) {
      const roughness = configureRepeat(textureLoader.load(roughnessPath), repeatX, repeatY);
      roughness.colorSpace = THREE.NoColorSpace;
      set.roughness = roughness;
    }
    if (aoPath) {
      const ao = configureRepeat(textureLoader.load(aoPath), repeatX, repeatY);
      ao.colorSpace = THREE.NoColorSpace;
      set.ao = ao;
    }
  } catch (error) {
    log.warn('Texture PBR non caricata, fallback procedurale', { colorPath, error: String(error) });
    return { color: null, normal: null, roughness: null, ao: null };
  }
  return set;
}
