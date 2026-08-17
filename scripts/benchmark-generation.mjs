/**
 * Benchmark della generazione procedurale (§13.2, MIG-08).
 * Genera N piani e misura tempo medio e p95.
 * Target: < 200 ms per piano su hardware medio.
 *
 * Uso: node scripts/benchmark-generation.mjs [iterations]
 */

import { performance } from 'node:perf_hooks';

const ITERATIONS = parseInt(process.argv[2] ?? '50', 10);
const TARGET_MS = 200;

// ── Placeholder: importazione del generatore ───────────────────────────────
// Quando FloorGenerator sarà compilato come modulo ESM standalone:
// import { generateFloor } from '../dist/procedural/FloorGenerator.js';

/**
 * Simulazione: sostituire con la vera generateFloor() quando disponibile.
 */
async function generateFloor(seed, floorIndex) {
  // TODO: collegare al vero FloorGenerator
  const start = performance.now();
  // Simula lavoro
  let sum = 0;
  for (let i = 0; i < 100_000; i++) sum += Math.sin(i * seed);
  return { elapsed: performance.now() - start, rooms: Math.floor(6 + seed % 5), sum };
}

// ── Benchmark ──────────────────────────────────────────────────────────────

const timings = [];

console.log(`Benchmark generazione procedurale: ${ITERATIONS} iterazioni\n`);

for (let i = 0; i < ITERATIONS; i++) {
  const seed = 42 + i;
  const floorIndex = 1 + (i % 5);
  const start = performance.now();
  await generateFloor(seed, floorIndex);
  const elapsed = performance.now() - start;
  timings.push(elapsed);
}

timings.sort((a, b) => a - b);

const avg = timings.reduce((s, t) => s + t, 0) / timings.length;
const p50 = timings[Math.floor(timings.length * 0.5)];
const p95 = timings[Math.floor(timings.length * 0.95)];
const p99 = timings[Math.floor(timings.length * 0.99)];
const max = timings[timings.length - 1];

console.log(`  Media:  ${avg.toFixed(2)} ms`);
console.log(`  p50:    ${p50.toFixed(2)} ms`);
console.log(`  p95:    ${p95.toFixed(2)} ms`);
console.log(`  p99:    ${p99.toFixed(2)} ms`);
console.log(`  Max:    ${max.toFixed(2)} ms`);
console.log(`  Target: < ${TARGET_MS} ms`);
console.log();

if (p95 > TARGET_MS) {
  console.error(`FAIL: p95 (${p95.toFixed(2)} ms) supera il target (${TARGET_MS} ms)`);
  process.exit(1);
}

console.log('OK: generazione entro il target.');
