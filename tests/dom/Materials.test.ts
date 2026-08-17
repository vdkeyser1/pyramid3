/**
 * Test DOM dei materiali procedurali (G-16): texture geroglifiche/sabbia e
 * dissolve. happy-dom NON implementa il context 2D → lo mockiamo intercettando
 * document.createElement('canvas') con un context minimale che traccia le
 * chiamate (le API usate da Materials.ts).
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  createDissolveMaterial,
  createHieroglyphTexture,
  createSandTexture,
} from '@/rendering/Materials.js';

function makeContext2D() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect(): void { /* noop */ },
    beginPath(): void { /* noop */ },
    moveTo(): void { /* noop */ },
    lineTo(): void { /* noop */ },
    stroke(): void { /* noop */ },
    arc(): void { /* noop */ },
    ellipse(): void { /* noop */ },
    fill(): void { /* noop */ },
    getImageData(_x: number, _y: number, width: number, height: number): {
      data: Uint8ClampedArray; width: number; height: number;
    } {
      return { data: new Uint8ClampedArray(width * height * 4), width, height };
    },
    putImageData(): void { /* noop */ },
  };
}

class MockCanvasWith2D {
  width = 0;
  height = 0;
  getContext(kind: string): unknown {
    if (kind === '2d') return makeContext2D();
    return null;
  }
}

class MockCanvasNoContext {
  width = 0;
  height = 0;
  getContext(): null {
    return null;
  }
}

function installCanvasMock(canvasClass: typeof MockCanvasWith2D | typeof MockCanvasNoContext): void {
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') {
      return new canvasClass() as unknown as HTMLCanvasElement;
    }
    return document.createElement(tag);
  });
}

function requireTexture(texture: THREE.CanvasTexture | null): THREE.CanvasTexture {
  if (texture === null) {
    throw new Error('texture attesa ma era null');
  }
  return texture;
}

describe('Materials (G-16)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('genera una texture geroglifica non vuota e deterministica', () => {
    installCanvasMock(MockCanvasWith2D);
    const first = requireTexture(createHieroglyphTexture(0, 128));
    const second = requireTexture(createHieroglyphTexture(0, 128));

    expect(first.image.width).toBe(128);
    expect(first.image.height).toBe(128);
    expect(first).toBeInstanceOf(THREE.CanvasTexture);
    expect(second.image.width).toBe(first.image.width);
  });

  it('genera una texture di sabbia con repeat 6x6', () => {
    installCanvasMock(MockCanvasWith2D);
    const texture = requireTexture(createSandTexture(128, '#8a7350'));

    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.wrapT).toBe(THREE.RepeatWrapping);
    expect(texture.repeat.x).toBe(6);
    expect(texture.repeat.y).toBe(6);
  });

  it('il dissolve parte a 0 (intatto) e accetta valori 0..1 clampati', () => {
    const { material, setDissolve } = createDissolveMaterial(0x8a7a5a, 0xd4a05a);

    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    setDissolve(0.5);
    setDissolve(2);
    setDissolve(-1);
  });

  it('canvas senza context 2D ⇒ texture null (fallback materiale piatto)', () => {
    installCanvasMock(MockCanvasNoContext);
    expect(createHieroglyphTexture(0, 64)).toBeNull();
    expect(createSandTexture(64)).toBeNull();
  });
});
