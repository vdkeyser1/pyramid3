#!/usr/bin/env node
/**
 * G-02: Script di generazione del daily-seed.json.
 *
 * Eseguito da GitHub Actions ogni giorno alle 00:05 UTC.
 * Output: public/daily-seed.json (servito come static asset,
 *         precachato dal Service Worker con NetworkFirst, 25h).
 *
 * Usage: node scripts/generate-daily-seed.mjs [YYYY-MM-DD]
 *   - senza argomento: usa la data UTC odierna
 *   - con argomento:   genera il seed per la data specificata (testing)
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'public', 'daily-seed.json');

// ─── Hash deterministico (stesso algoritmo di DailyChallengeSystem.ts) ────

function murmurHash32(str) {
  let h = 0xdeadbeef;
  for (let i = 0; i < str.length; i++) {
    let k = str.charCodeAt(i);
    k = Math.imul(k, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);
    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = (Math.imul(h, 5) + 0xe6546b64) | 0;
  }
  h ^= str.length;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

const ALL_MODIFIERS = [
  'FAST_ENEMIES', 'GOLDEN_RUN', 'CURSED_FLOOR',
  'NO_TORCH', 'SPEED_RUN', 'ONE_HIT_KILL',
];

function pickModifiers(seed) {
  const roll = (seed & 0xFF) / 255;
  let count;
  if (roll < 0.30) count = 0;
  else if (roll < 0.80) count = 1;
  else count = 2;

  const mods = [];
  const pool = [...ALL_MODIFIERS];
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = murmurHash32(String(s));
    const idx = s % pool.length;
    mods.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return mods;
}

function pickTargetFloor(seed) {
  const roll = (seed >> 8) & 0xF;
  const table = [1, 2, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 7, 7];
  return table[roll] ?? 4;
}

const DESCRIPTIONS = {
  0: 'Discendi nelle profondità — nessun modificatore oggi.',
  1: 'Il modificatore del giorno mette alla prova una sola abilità.',
  2: 'Doppia sfida: due modificatori combinati. I coraggiosi prevalgono.',
};

// ─── Main ─────────────────────────────────────────────────────────────────

const arg = process.argv[2];
let dateStr;
if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) {
  dateStr = arg;
} else {
  const now = new Date();
  const y   = now.getUTCFullYear();
  const m   = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d   = String(now.getUTCDate()).padStart(2, '0');
  dateStr   = `${y}-${m}-${d}`;
}

const seed      = murmurHash32(dateStr);
const modifiers = pickModifiers(seed);
const floor     = pickTargetFloor(seed);

const payload = {
  date:        dateStr,
  seed,
  modifiers,
  targetFloor: floor,
  description: DESCRIPTIONS[modifiers.length] ?? 'Sfida del giorno.',
  generatedAt: new Date().toISOString(),
};

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2), 'utf-8');

console.log(`[daily-seed] Generato per ${dateStr}:`);
console.log(`  seed: ${seed}`);
console.log(`  modifiers: [${modifiers.join(', ')}]`);
console.log(`  targetFloor: ${floor}`);
console.log(`  output: ${OUTPUT_PATH}`);
