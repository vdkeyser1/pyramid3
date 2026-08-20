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
import { loadKTX2TextureSync } from '@/rendering/KTX2TextureLoader.js';

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

// ── Texture procedurale pannello geroglifici da parete ──────────────────────

/**
 * Genera una texture 512×256 con l'aspetto di una stele di pietra scolpita:
 * sfondo scuro + bordo cartoccio + 3–4 righe di simboli egizi stilizzati.
 * Seed = floorIndex → ogni piano ha una variante leggermente diversa.
 */
export function createHieroglyphPanelTexture(
  seed = 0,
): THREE.CanvasTexture | null {
  const W = 512;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Sfondo pietra scura
  ctx.fillStyle = '#1C1408';
  ctx.fillRect(0, 0, W, H);

  // Granulazione pietra (deterministica)
  const img = ctx.getImageData(0, 0, W, H);
  let s = (seed * 0x9e3779b9 + 0x12345678) >>> 0;
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const n = ((s >>> 16) % 18) - 9;
    img.data[i] = Math.max(0, Math.min(255, (img.data[i] ?? 0) + n));
    img.data[i + 1] = Math.max(0, Math.min(255, (img.data[i + 1] ?? 0) + Math.round(n * 0.7)));
    img.data[i + 2] = Math.max(0, Math.min(255, (img.data[i + 2] ?? 0) + Math.round(n * 0.4)));
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  // Bordo cartoccio (cornice scolpita)
  const brd = 14;
  ctx.strokeStyle = '#7A5820';
  ctx.lineWidth = 3;
  ctx.strokeRect(brd, brd, W - brd * 2, H - brd * 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#4A3010';
  ctx.strokeRect(brd + 5, brd + 5, W - (brd + 5) * 2, H - (brd + 5) * 2);

  // Linee di registro (separatori orizzontali tra righe di geroglifici)
  const rows = 4;
  const rowH = (H - brd * 2 - 10) / rows;
  ctx.strokeStyle = '#5A3C14';
  ctx.lineWidth = 1;
  for (let r = 1; r < rows; r++) {
    const y = brd + 5 + r * rowH;
    ctx.beginPath();
    ctx.moveTo(brd + 8, y);
    ctx.lineTo(W - brd - 8, y);
    ctx.stroke();
  }

  // Simboli scolpiti (color oro chiaro su pietra scura)
  ctx.strokeStyle = '#C8A030';
  ctx.fillStyle = '#C8A030';
  ctx.lineWidth = 1.5;

  // Sequenze di glifo per riga — deterministica via seed
  const GLYPHS = [
    drawAnkh, drawEye, drawBird, drawWater, drawSun, drawSnake,
    drawFeather, drawOwl, drawScarab, drawNileLotus,
  ];

  for (let r = 0; r < rows; r++) {
    const rowSeed = (seed * 31 + r * 7 + 1) >>> 0;
    const cy = brd + 5 + r * rowH + rowH / 2;
    const cols = 10;
    const colW = (W - brd * 2 - 20) / cols;
    for (let c = 0; c < cols; c++) {
      const glyphSeed = (rowSeed * 17 + c * 3 + 1) >>> 0;
      const glyphIdx = glyphSeed % GLYPHS.length;
      const fn = GLYPHS[glyphIdx];
      if (!fn) continue;
      const cx = brd + 10 + c * colW + colW / 2;
      ctx.save();
      ctx.translate(cx, cy);
      const cellR = Math.min(colW, rowH) * 0.36;
      fn(ctx, cellR);
      ctx.restore();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function drawAnkh(ctx: CanvasRenderingContext2D, r: number): void {
  // Croce + anello in cima
  ctx.beginPath();
  ctx.arc(0, -r * 0.42, r * 0.22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.18);
  ctx.lineTo(0, r * 0.55);
  ctx.moveTo(-r * 0.3, r * 0.08);
  ctx.lineTo(r * 0.3, r * 0.08);
  ctx.stroke();
}
function drawEye(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.48, r * 0.22, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.10, 0, Math.PI * 2);
  ctx.fill();
  // coda occhio di Horus
  ctx.beginPath();
  ctx.moveTo(r * 0.38, r * 0.12);
  ctx.lineTo(r * 0.55, r * 0.42);
  ctx.lineTo(r * 0.32, r * 0.35);
  ctx.stroke();
}
function drawBird(ctx: CanvasRenderingContext2D, r: number): void {
  // Ibis stilizzato
  ctx.beginPath();
  ctx.ellipse(0, r * 0.05, r * 0.30, r * 0.18, -0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.28, -r * 0.08);
  ctx.quadraticCurveTo(r * 0.55, -r * 0.30, r * 0.48, -r * 0.52);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.28, r * 0.20);
  ctx.lineTo(-r * 0.10, r * 0.55);
  ctx.moveTo(-r * 0.08, r * 0.20);
  ctx.lineTo(r * 0.10, r * 0.55);
  ctx.stroke();
}
function drawWater(ctx: CanvasRenderingContext2D, r: number): void {
  for (let i = -1; i <= 1; i++) {
    const y = i * r * 0.28;
    ctx.beginPath();
    ctx.moveTo(-r * 0.50, y);
    for (let x = -r * 0.50; x <= r * 0.50; x += r * 0.20) {
      ctx.quadraticCurveTo(x + r * 0.10, y - r * 0.14, x + r * 0.20, y);
    }
    ctx.stroke();
  }
}
function drawSun(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
  ctx.stroke();
  for (let a = 0; a < 8; a++) {
    const angle = (a / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * r * 0.32, Math.sin(angle) * r * 0.32);
    ctx.lineTo(Math.cos(angle) * r * 0.52, Math.sin(angle) * r * 0.52);
    ctx.stroke();
  }
}
function drawSnake(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  ctx.moveTo(-r * 0.42, r * 0.45);
  ctx.bezierCurveTo(-r * 0.42, -r * 0.10, r * 0.42, r * 0.10, r * 0.42, -r * 0.45);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.42, -r * 0.45, r * 0.10, 0, Math.PI * 2);
  ctx.stroke();
}
function drawFeather(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.52);
  ctx.lineTo(0, -r * 0.52);
  ctx.stroke();
  for (let i = -4; i <= 4; i++) {
    const y = i * r * 0.12;
    const len = r * 0.36 * (1 - Math.abs(i) * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(len, y - r * 0.06);
    ctx.moveTo(0, y);
    ctx.lineTo(-len, y - r * 0.06);
    ctx.stroke();
  }
}
function drawOwl(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  ctx.ellipse(0, r * 0.08, r * 0.28, r * 0.40, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-r * 0.12, -r * 0.14, r * 0.10, 0, Math.PI * 2);
  ctx.arc(r * 0.12, -r * 0.14, r * 0.10, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-r * 0.28, -r * 0.30);
  ctx.lineTo(-r * 0.12, -r * 0.18);
  ctx.moveTo(r * 0.28, -r * 0.30);
  ctx.lineTo(r * 0.12, -r * 0.18);
  ctx.stroke();
}
function drawScarab(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  ctx.ellipse(0, r * 0.10, r * 0.22, r * 0.32, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -r * 0.25, r * 0.14, 0, Math.PI * 2);
  ctx.stroke();
  for (let s = -1; s <= 1; s += 2) {
    ctx.beginPath();
    ctx.moveTo(s * r * 0.22, -r * 0.08);
    ctx.lineTo(s * r * 0.48, -r * 0.28);
    ctx.moveTo(s * r * 0.22, r * 0.10);
    ctx.lineTo(s * r * 0.50, r * 0.08);
    ctx.moveTo(s * r * 0.22, r * 0.28);
    ctx.lineTo(s * r * 0.48, r * 0.38);
    ctx.stroke();
  }
}
function drawNileLotus(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.50);
  ctx.lineTo(0, -r * 0.12);
  ctx.stroke();
  for (let i = -1; i <= 1; i++) {
    const angle = i * 0.48;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.12);
    ctx.bezierCurveTo(
      Math.sin(angle) * r * 0.32, -r * 0.32,
      Math.sin(angle) * r * 0.38, -r * 0.52,
      Math.sin(angle) * r * 0.22, -r * 0.58,
    );
    ctx.bezierCurveTo(
      Math.sin(angle) * r * 0.08, -r * 0.52,
      Math.sin(angle) * r * 0.04, -r * 0.28,
      0, -r * 0.12,
    );
    ctx.stroke();
  }
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

// ── Soffitto astronomico (tomba di Senenmut, TT 353) ───────────────────────

/**
 * Genera il soffitto stellato delle camere funerarie.
 *
 * RIFERIMENTO: piramide di Unas (V dinastia, ~2350 a.C.), il primo faraone a
 * far incidere testi nella propria piramide. Il soffitto della camera
 * funeraria era a **stelle dorate su fondo nero**, per imitare il cielo
 * notturno sotto cui venivano recitate le formule.
 *
 * Una versione precedente usava blu egizio con stelle ocra: quello è il
 * cielo di Senenmut (TT 353), una TOMBA del Nuovo Regno — riferimento
 * sbagliato per una piramide, e visivamente più piatto.
 *
 * Il repertorio decorativo alterna forme diverse invece di ripetere la stessa
 * stella: stelle a cinque punte (la forma canonica del geroglifico `sba`),
 * stelle a otto punte e rosette, separate da bande di motivi geometrici
 * (zigzag e spirali) che nelle tombe reali scandiscono i registri.
 *
 * Deterministico: nessun Math.random, la disposizione dipende solo dal seed.
 */
export function createAstronomicalCeilingTexture(
  seed = 0,
  size = 512,
): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let s = (seed * 0x9e3779b9 + 0x51ed270b) >>> 0;
  const rnd = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s >>> 8) / 0x01000000;
  };

  // Fondo nero pece, non nero puro: la pietra sotto il pigmento traspare.
  ctx.fillStyle = '#0D0A07';
  ctx.fillRect(0, 0, size, size);

  // Venature calde: il nero uniforme legge come vuoto, non come soffitto.
  for (let i = 0; i < 40; i++) {
    const cx = rnd() * size;
    const cy = rnd() * size;
    const r = size * (0.08 + rnd() * 0.16);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(58, 40, 22, 0.22)');
    grad.addColorStop(1, 'rgba(58, 40, 22, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tavolozza policroma: i soffitti egizi non sono monocromi dorati. I
  // pittori lavoravano con sei pigmenti e li usavano insieme — l'oro da solo
  // legge come ottone, non come pittura murale.
  const GOLD = '#E0AC48';       // ocra gialla
  const GOLD_DIM = '#A87C2C';
  const RED = '#B24A2A';        // ocra rossa
  const BLUE = '#2E63B8';       // blu egizio
  const GREEN = '#3F7D5C';      // malachite
  const WHITE = '#E8DCC4';      // gesso

  // ── Bande di registro: fasce orizzontali di motivi geometrici ──────────
  // Nelle tombe le fasce separano i campi stellati e danno ritmo al soffitto.
  // Ogni fascia ha il proprio colore: è la policromia a rendere il soffitto
  // "acceso" invece che uniforme.
  const bandY = [size * 0.22, size * 0.50, size * 0.78];
  const bandColors = [RED, BLUE, GREEN];
  ctx.lineWidth = Math.max(2, size / 220);
  for (let b = 0; b < bandY.length; b++) {
    const y = bandY[b] ?? 0;
    ctx.strokeStyle = bandColors[b] ?? GOLD_DIM;
    // Alterna zigzag (il motivo più antico, dal 4000 a.C.) e spirali
    // (associate al vagare dell'anima).
    if (b % 2 === 0) drawZigzagBand(ctx, y, size);
    else drawSpiralBand(ctx, y, size);
  }

  // ── Campo stellato a quinconce con forme alternate ─────────────────────
  const COLS = 6;
  const ROWS = 6;
  const cell = size / COLS;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const offset = row % 2 === 0 ? 0 : cell / 2;
      const cx = col * cell + cell / 2 + offset + (rnd() - 0.5) * cell * 0.18;
      const cy = row * cell + cell / 2 + (rnd() - 0.5) * cell * 0.18;
      if (cx < -cell || cx > size + cell) continue;

      // Le fasce di registro non devono essere coperte dalle stelle.
      if (bandY.some((by) => Math.abs(cy - by) < cell * 0.30)) continue;

      const r = cell * (0.13 + rnd() * 0.07);
      // Tre forme in rotazione, con pesi diversi: la stella a cinque punte
      // resta dominante perché è quella canonica del geroglifico `sba`.
      const pick = rnd();
      // Colore per stella: l'oro domina, ma bianco gesso e ocra rossa
      // compaiono a intervalli — è così che le tombe evitano la monotonia.
      const tint = rnd();
      ctx.fillStyle = tint > 0.88 ? WHITE : tint > 0.74 ? RED : tint > 0.62 ? GOLD_DIM : GOLD;
      if (pick < 0.55) {
        drawFivePointedStar(ctx, cx, cy, r, r * 0.42);
      } else if (pick < 0.82) {
        drawEightPointedStar(ctx, cx, cy, r, r * 0.45);
      } else {
        drawRosette(ctx, cx, cy, r * 0.85);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Stella a otto punte: variante frequente accanto a quella a cinque. */
function drawEightPointedStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / 8 - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

/** Rosetta a petali: motivo geometrico ricorrente nei soffitti dipinti. */
function drawRosette(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  const PETALS = 8;
  for (let i = 0; i < PETALS; i++) {
    const angle = (i / PETALS) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(
      cx + Math.cos(angle) * r * 0.52,
      cy + Math.sin(angle) * r * 0.52,
      r * 0.34, r * 0.17, angle, 0, Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

/** Banda a zigzag: l'ornamento egizio più antico (acqua/nun). */
function drawZigzagBand(ctx: CanvasRenderingContext2D, y: number, size: number): void {
  const step = size / 26;
  const amp = step * 0.62;
  for (let k = -1; k <= 1; k += 2) {
    ctx.beginPath();
    ctx.moveTo(0, y + k * amp * 1.5);
    for (let x = 0, up = true; x <= size; x += step, up = !up) {
      ctx.lineTo(x, y + k * amp * 1.5 + (up ? -amp : amp));
    }
    ctx.stroke();
  }
}

/** Banda a spirali continue: motivo del "vagare dell'anima". */
function drawSpiralBand(ctx: CanvasRenderingContext2D, y: number, size: number): void {
  const step = size / 9;
  for (let x = step / 2; x < size; x += step) {
    ctx.beginPath();
    // Spirale aperta a due giri, disegnata per punti.
    for (let a = 0; a < Math.PI * 4; a += 0.22) {
      const r = (a / (Math.PI * 4)) * step * 0.36;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

/** Stella a cinque punte, orientata con una punta verso l'alto. */
function drawFivePointedStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
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

// ── W-7: Materiali metallici PBR (oro, bronzo, lapislazzuli) ─────────────────

/**
 * Materiale oro egiziano: alta riflessione metallica, usufruisce dell'HDRI
 * impostato in W-1 (scene.environment) per riflessioni accurate.
 * Roughness bassa = superficie lucidata come oro da tesoro faraonico.
 */
export function createGoldMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color:     0xC49A28,   // oro egiziano — non troppo saturo
    metalness: 0.95,
    roughness: 0.12,
    emissive:  0x3A2800,   // alone caldo subsurface per leggibilità in scena buia
    emissiveIntensity: 0.18,
  });
}

/**
 * Materiale bronzo: lega opaca con patina verde chiaro—marrone.
 * Tipico degli oggetti cerimoniali: statue, coperchi di canopi, armi rituali.
 */
export function createBronzeMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color:     0x7A5228,   // bronzo ossidato
    metalness: 0.80,
    roughness: 0.40,
    emissive:  0x1A0A00,
    emissiveIntensity: 0.08,
  });
}

// NOTA: qui c'era createLapisMaterial(), rimossa perché senza consumatori.
// Gli accenti del gioco sono turchese (geroglifici, faro d'uscita), non blu
// lapislazzuli: non esisteva un punto in cui usarla senza forzarla. Se servirà
// per sarcofagi o amuleti, il colore di riferimento è #1F4080 con vene #604A10.

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

/**
 * Percorso dei file `basis_transcoder.js`/`.wasm`, copiati da
 * `three/examples/jsm/libs/basis/` in `public/basis/`.
 * NON è `/draco/`: quella cartella contiene il decoder Draco per le mesh,
 * che non ha nulla a che vedere con la transcodifica Basis delle texture.
 */
const BASIS_TRANSCODER_PATH = '/basis/';

function configureRepeat(texture: THREE.Texture, repeatX: number, repeatY: number): THREE.Texture {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Prepara un placeholder e vi transcodifica dentro il file KTX2 in modo
 * asincrono. Il chiamante riceve subito una Texture utilizzabile: i dati
 * compressi arrivano poco dopo e il materiale si aggiorna da solo.
 *
 * @param srgb - true per le mappe colore, false per normal/roughness/AO
 *               (dati lineari: interpretarli come sRGB falserebbe il PBR).
 */
function loadKtxChannel(
  path: string,
  repeatX: number,
  repeatY: number,
  srgb: boolean,
  renderer: THREE.WebGLRenderer,
): THREE.Texture {
  const placeholder = configureRepeat(new THREE.Texture(), repeatX, repeatY);
  placeholder.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  loadKTX2TextureSync(path, renderer, () => placeholder, {
    transcoderPath: BASIS_TRANSCODER_PATH,
  });
  return placeholder;
}

/**
 * Carica un set PBR (colore + normal + roughness/AO opzionali) da /textures.
 *
 * I path sono `.ktx2` (Basis ETC1S): le texture restano compresse in VRAM.
 * Senza un WebGLRenderer non è possibile transcodificare — in quel caso
 * ritorna tutti null e il chiamante usa il fallback procedurale.
 *
 * Storia: prima questa funzione scaricava il `.jpg` e POI ci sovrascriveva
 * il `.ktx2`, pagando due volte la banda. Ora carica solo il KTX2.
 */
export function loadPbrTextureSet(
  colorPath: string,
  normalPath: string | null,
  repeatX = 1,
  repeatY = 1,
  roughnessPath: string | null = null,
  aoPath: string | null = null,
  renderer?: THREE.WebGLRenderer,
): PbrTextureSet {
  const empty: PbrTextureSet = { color: null, normal: null, roughness: null, ao: null };

  // Il transcoder Basis richiede un contesto WebGL per scegliere il formato
  // GPU (ASTC/BC7/ETC2). Senza renderer restiamo sui materiali procedurali.
  if (!renderer) {
    return empty;
  }

  try {
    return {
      color:     loadKtxChannel(colorPath, repeatX, repeatY, true, renderer),
      normal:    normalPath    ? loadKtxChannel(normalPath,    repeatX, repeatY, false, renderer) : null,
      roughness: roughnessPath ? loadKtxChannel(roughnessPath, repeatX, repeatY, false, renderer) : null,
      ao:        aoPath        ? loadKtxChannel(aoPath,        repeatX, repeatY, false, renderer) : null,
    };
  } catch (error) {
    log.warn('Texture PBR non caricata, fallback procedurale', { colorPath, error: String(error) });
    return empty;
  }
}
