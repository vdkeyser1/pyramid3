/**
 * Verifica statica dei confini architetturali dichiarati nella Master Bible v4 (§22).
 * Un confine che non fallisce la build non è un confine.
 *
 * Uso: node scripts/verify-boundaries.mjs
 * Esito: exit 0 se nessuna violazione, exit 1 con elenco puntuale altrimenti.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

/** Ogni regola: cartella sorgente -> import vietati (match su stringa iniziale). */
const RULES = [
  {
    from: join('src', 'simulation'),
    forbidden: ['three', '@dimforge/rapier3d', 'idb', '../rendering', '../physics', '../ui'],
    reason: 'la simulazione deve restare indipendente da rendering, fisica concreta, storage e DOM',
  },
  {
    from: join('src', 'ecs'),
    forbidden: ['three', '@dimforge/rapier3d', 'idb'],
    reason: 'l ECS non conosce librerie di presentazione o persistenza',
  },
  {
    from: join('src', 'content'),
    forbidden: ['three', '@dimforge/rapier3d', '../rendering', '../physics'],
    reason: 'le definizioni di contenuto non possono referenziare oggetti runtime',
  },
  {
    from: join('src', 'ui'),
    forbidden: ['../ecs/World', '../simulation/Simulation'],
    reason: 'la UI consuma view-model, non il world ECS',
  },
  {
    from: join('src', 'procedural'),
    forbidden: ['three', '@dimforge/rapier3d', 'idb', '../rendering', '../physics', '../ui'],
    reason: 'la generazione procedurale è pura: no rendering, fisica concreta, storage o DOM',
  },
  {
    from: join('src', 'ai'),
    forbidden: ['three', '@dimforge/rapier3d', 'idb', '../rendering', '../ui'],
    reason: 'l AI non conosce rendering, storage o DOM',
  },
  {
    from: join('src', 'gameplay'),
    forbidden: ['three', '@dimforge/rapier3d', 'idb', '../rendering', '../ui'],
    // Il PlayerCharacterController è un adapter gameplay↔physics: dipende da Rapier
    // per il KinematicCharacterController. In futuro va spostato in src/adapters/.
    except: [join('src', 'gameplay', 'player', 'PlayerCharacterController.ts')],
    reason: 'il gameplay non dipende da rendering, storage o DOM',
  },
];

/** Simboli vietati nella simulazione: distruggono il determinismo. */
const FORBIDDEN_SYMBOLS = [
  { pattern: /\bMath\.random\s*\(/, message: 'Math.random: usare SeedRng' },
  { pattern: /\bDate\.now\s*\(/, message: 'Date.now: usare il clock fisso' },
  { pattern: /\bperformance\.now\s*\(/, message: 'performance.now: usare il clock fisso' },
];
const SYMBOL_SCOPES = [join('src', 'simulation'), join('src', 'procedural'), join('src', 'ai')];

const IMPORT_RE = /(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx|mts)$/.test(entry.name)) yield full;
  }
}

const violations = [];

for await (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const source = await readFile(file, 'utf8');

  for (const rule of RULES) {
    if (!rel.startsWith(rule.from + sep)) continue;
    if (rule.except?.some((e) => rel === e || rel.startsWith(e + sep))) continue;
    for (const match of source.matchAll(IMPORT_RE)) {
      const specifier = match[1] ?? match[2];
      if (!specifier) continue;
      if (rule.forbidden.some((f) => specifier === f || specifier.startsWith(f))) {
        violations.push(`${rel}: import vietato "${specifier}" — ${rule.reason}`);
      }
    }
  }

  if (SYMBOL_SCOPES.some((scope) => rel.startsWith(scope + sep))) {
    for (const { pattern, message } of FORBIDDEN_SYMBOLS) {
      if (pattern.test(source)) violations.push(`${rel}: ${message}`);
    }
  }
}

if (violations.length > 0) {
  console.error('Violazioni dei confini architetturali:\n');
  for (const v of violations) console.error(`  - ${v}`);
  console.error(`\nTotale: ${violations.length}`);
  process.exit(1);
}

console.log('Confini architetturali: nessuna violazione.');
