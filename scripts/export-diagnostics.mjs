/**
 * Esporta diagnostiche di progetto in un file JSON (§40.3).
 * Raccoglie: conteggio file per layer, LOC, dipendenze, errori TS.
 *
 * Uso: node scripts/export-diagnostics.mjs [output.json]
 */

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, relative, sep, extname } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const OUTPUT = process.argv[2] ?? 'diagnostics.json';

const LAYERS = ['platform', 'core', 'ecs', 'simulation', 'procedural', 'ai', 'gameplay', 'content', 'math', 'config', 'adapters', 'rendering', 'physics', 'ui'];

async function* walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      yield* walk(full);
    } else if (/\.(ts|tsx|mts)$/.test(entry.name)) {
      yield full;
    }
  }
}

// ── Conteggi ───────────────────────────────────────────────────────────────

const layerStats = {};
for (const l of LAYERS) layerStats[l] = { files: 0, lines: 0 };
layerStats['other'] = { files: 0, lines: 0 };

let totalFiles = 0;
let totalLines = 0;

for await (const file of walk(SRC)) {
  const rel = relative(SRC, file);
  const layer = rel.split(sep)[0] ?? 'other';
  const source = await readFile(file, 'utf8');
  const lines = source.split('\n').length;

  const target = layerStats[layer] ?? layerStats['other'];
  target.files++;
  target.lines += lines;
  totalFiles++;
  totalLines += lines;
}

// ── Dipendenze ─────────────────────────────────────────────────────────────

let dependencies = {};
try {
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  dependencies = {
    runtime: Object.keys(pkg.dependencies ?? {}),
    dev: Object.keys(pkg.devDependencies ?? {}),
  };
} catch { /* nessun package.json */ }

// ── Errori TypeScript ──────────────────────────────────────────────────────

let tsErrors = [];
try {
  execSync('npx tsc --noEmit 2>&1', { cwd: ROOT, encoding: 'utf8' });
} catch (e) {
  if (e.stdout) {
    tsErrors = e.stdout.split('\n').filter((l) => l.includes('error TS')).slice(0, 50);
  }
}

// ── Output ─────────────────────────────────────────────────────────────────

const diagnostics = {
  timestamp: new Date().toISOString(),
  summary: { totalFiles, totalLines },
  layers: layerStats,
  dependencies,
  tsErrors: { count: tsErrors.length, first50: tsErrors },
};

await writeFile(join(ROOT, OUTPUT), JSON.stringify(diagnostics, null, 2), 'utf8');
console.log(`Diagnostiche esportate in ${OUTPUT}`);
console.log(`  File TS: ${totalFiles}`);
console.log(`  Righe totali: ${totalLines}`);
console.log(`  Errori TS: ${tsErrors.length}`);
