#!/usr/bin/env node
/**
 * Scopo: ottimizzazione asset GLB (G-17 residuo — gltf-transform).
 *        Dedup + prune + Draco per tutti i modelli in public/assets/.
 *        Uso: node scripts/optimize-assets.mjs [--draco]
 *        (senza --draco usa solo optimize: dedup/prune, lossless)
 * Ownership: pipeline build (dev-only). NON fa parte di npm run verify.
 * Failure mode: file corrotto ⇒ skip con warning (mai crash).
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, renameSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'public', 'assets');
const useDraco = process.argv.includes('--draco');
// Entry JS del CLI (npx/.cmd non spawnabili direttamente da Node su Windows).
const gltfCli = join(root, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');

function collectGlbs(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectGlbs(full));
    } else if (full.toLowerCase().endsWith('.glb')) {
      out.push(full);
    }
  }
  return out;
}

const glbs = collectGlbs(assetsDir);
if (glbs.length === 0) {
  console.log('Nessun GLB trovato in public/assets/');
  process.exit(0);
}

let savedTotal = 0;
for (const glb of glbs) {
  const before = statSync(glb).size;
  const tmp = `${glb}.opt.glb`;
  // Entry JS diretto: primo arg = sotto-comando (niente 'gltf-transform').
  // --texture-compress false: i GLB non hanno texture da convertire in KTX2
  // (evita il fallimento 'colourspace: parameter space not set').
  const args = ['optimize', glb, tmp, '--texture-compress', 'false'];
  if (useDraco) {
    args.push('--compress', 'draco');
  }
  try {
    execFileSync(process.execPath, [gltfCli, ...args], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
    if (existsSync(tmp)) {
      const after = statSync(tmp).size;
      renameSync(tmp, glb);
      const delta = before - after;
      savedTotal += Math.max(0, delta);
      console.log(
        `${glb.replace(assetsDir + '/', '')}: ${(before / 1024).toFixed(1)}KB → ${(after / 1024).toFixed(1)}KB (${delta > 0 ? `-${(delta / 1024).toFixed(1)}KB` : `+${(-delta / 1024).toFixed(1)}KB`})`,
      );
    } else {
      console.log(`SKIP ${glb}: nessun output`);
    }
  } catch (err) {
    console.log(`SKIP ${glb}: ${String(err).split('\n').slice(-2).join(' ')}`);
  }
}
console.log(`Totale risparmiato: ${(savedTotal / 1024).toFixed(1)}KB`);
