/**
 * Benchmark del replay deterministico (§13.3, MIG-09).
 * Verifica che N replay dello stesso seed producano stato identico.
 * Misura tempo per step e drift detection.
 *
 * Uso: node scripts/benchmark-replay.mjs [steps] [replays]
 */

import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';

const STEPS = parseInt(process.argv[2] ?? '600', 10);   // 10 secondi a 60 Hz
const REPLAYS = parseInt(process.argv[3] ?? '5', 10);

// ── Placeholder: simulazione deterministica ────────────────────────────────
// Quando il motore sarà compilabile come modulo standalone:
// import { createSimulation, stepSimulation, serializeState } from '../dist/simulation/Simulation.js';

/**
 * Simulazione minimale: sostituire con la vera Simulation.
 * Il principio: dato lo stesso seed, N replay devono produrre hash identico.
 */
function simulateSteps(seed, steps) {
  // TODO: collegare al vero motore di simulazione
  let state = seed;
  for (let i = 0; i < steps; i++) {
    // xorshift32 deterministic
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    state = state >>> 0;
  }
  return state;
}

function hashState(state) {
  return createHash('sha256').update(String(state)).digest('hex').slice(0, 16);
}

// ── Benchmark ──────────────────────────────────────────────────────────────

console.log(`Benchmark replay deterministico: ${STEPS} step × ${REPLAYS} replay\n`);

const SEED = 12345;
const hashes = [];
const timings = [];

for (let r = 0; r < REPLAYS; r++) {
  const start = performance.now();
  const finalState = simulateSteps(SEED, STEPS);
  const elapsed = performance.now() - start;

  const hash = hashState(finalState);
  hashes.push(hash);
  timings.push(elapsed);

  console.log(`  Replay ${r + 1}: hash=${hash}  tempo=${elapsed.toFixed(2)} ms`);
}

console.log();

// Verifica determinismo: tutti gli hash devono coincidere
const allMatch = hashes.every((h) => h === hashes[0]);

if (!allMatch) {
  console.error('FAIL: replay non deterministico! Hash divergenti:');
  for (let i = 0; i < hashes.length; i++) {
    console.error(`  Replay ${i + 1}: ${hashes[i]}`);
  }
  process.exit(1);
}

const avgMs = timings.reduce((s, t) => s + t, 0) / timings.length;
const usPerStep = (avgMs * 1000) / STEPS;

console.log(`Determinismo: OK (hash=${hashes[0]})`);
console.log(`Tempo medio replay: ${avgMs.toFixed(2)} ms (${usPerStep.toFixed(1)} µs/step)`);
