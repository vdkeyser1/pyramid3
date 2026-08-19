/**
 * Validazione del contenuto di balance.ts a build time (§16, §40.3).
 * Verifica range sensati per tutti i valori numerici.
 *
 * Uso: node scripts/verify-content.mjs
 * Esito: exit 0 se tutto OK, exit 1 con elenco puntuale altrimenti.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();

// ── Regole di validazione ──────────────────────────────────────────────────

const RULES = [
  // PLAYER
  { path: 'PLAYER.walkSpeedMps',        min: 1,   max: 10  },
  { path: 'PLAYER.sprintSpeedMps',      min: 2,   max: 15  },
  { path: 'PLAYER.crouchSpeedMps',      min: 0.5, max: 5   },
  { path: 'PLAYER.capsuleHeightM',      min: 1.0, max: 2.5 },
  { path: 'PLAYER.capsuleRadiusM',      min: 0.1, max: 0.6 },
  { path: 'PLAYER.maxSlopeDeg',         min: 20,  max: 60  },
  { path: 'PLAYER.baseHealthHp',        min: 50,  max: 200 },
  { path: 'PLAYER.fovMinDeg',           min: 60,  max: 90  },
  { path: 'PLAYER.fovMaxDeg',           min: 90,  max: 120 },

  // TORCH
  { path: 'TORCH.initialFuelSeconds',   min: 60,  max: 600 },
  { path: 'TORCH.kaEchoCostSeconds',    min: 1,   max: 10  },

  // COMBAT
  { path: 'COMBAT.armorCap',            min: 0.5, max: 0.95 },
  { path: 'COMBAT.minimumDamageHp',     min: 1,   max: 5   },
  { path: 'COMBAT.durabilityWarningThreshold', min: 0.1, max: 0.4 },

  // WEAPONS — damage > 0, durability > 0
  { path: 'WEAPONS.fists.damageHp',     min: 1,   max: 10  },
  { path: 'WEAPONS.khopesh.damageHp',   min: 10,  max: 30  },
  { path: 'WEAPONS.staff.damageHp',     min: 5,   max: 20  },
  { path: 'WEAPONS.shovel.damageHp',    min: 3,   max: 15  },
  // durability: le armi da mischia si misurano in HITS (durabilityUnit: 'HITS'),
  // la pala in SCAVI (durabilityUnit: 'DIGS') — range diversi per unità diverse.
  { path: 'WEAPONS.khopesh.durability', min: 50,  max: 300 },
  { path: 'WEAPONS.staff.durability',   min: 50,  max: 500 },
  { path: 'WEAPONS.shovel.durability',  min: 1,   max: 10  },  // DIGS, non HITS

  // DIGGING
  { path: 'DIGGING.segments',           min: 2,   max: 8   },
  { path: 'DIGGING.fragmentRewardAmount', min: 1, max: 100 },
  { path: 'DIGGING.maxSoundingsForCertainty', min: 1, max: 10 },

  // DIRECTOR
  { path: 'DIRECTOR.minSpawnDistanceM', min: 2,   max: 10  },

  // FLOOR_CONSTRAINTS
  { path: 'FLOOR_CONSTRAINTS.braidingRatio', min: 0.1, max: 0.5 },

  // DARKNESS
  { path: 'DARKNESS.thresholds.calm',     min: 10,  max: 50  },
  { path: 'DARKNESS.thresholds.witness',  min: 80,  max: 120 },
];

// ── Caricamento dinamico del modulo ────────────────────────────────────────

async function loadBalance() {
  // Prova a importare il modulo compilato; se non esiste, leggi il .ts e valuta le costanti
  const balancePath = join(ROOT, 'src', 'content', 'balance.ts');
  const source = await readFile(balancePath, 'utf8');

  // Estrae le costanti esportate: analisi semplificata via eval in contesto isolato
  // Rimuove type annotations e 'as const' per poter valutare come JS
  const cleaned = source
    .replace(/:\s*(?:number|string|boolean|readonly\s+\w+\[\])\b/g, '')
    .replace(/\bas\s+const\b/g, '')
    .replace(/\bas\s+\w+\b/g, '')
    .replace(/export\s+const/g, 'const')
    .replace(/export\s+function/g, 'function');

  const fn = new Function(`
    ${cleaned}
    return { PLAYER, NOISE_MULTIPLIER, TORCH, COMBAT, WEAPONS, DIGGING, DIRECTOR, FLOOR_CONSTRAINTS, DARKNESS };
  `);

  return fn();
}

function resolvePath(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

// ── Main ───────────────────────────────────────────────────────────────────

const balance = await loadBalance();
const violations = [];

for (const rule of RULES) {
  const value = resolvePath(balance, rule.path);
  if (value === undefined) {
    violations.push(`${rule.path}: valore non trovato`);
    continue;
  }
  if (typeof value !== 'number' || Number.isNaN(value)) {
    violations.push(`${rule.path}: non è un numero (${typeof value})`);
    continue;
  }
  if (value < rule.min || value > rule.max) {
    violations.push(`${rule.path}: ${value} fuori range [${rule.min}, ${rule.max}]`);
  }
}

// Verifica relazionale
if (balance.PLAYER) {
  if (balance.PLAYER.walkSpeedMps >= balance.PLAYER.sprintSpeedMps) {
    violations.push('PLAYER.walkSpeedMps deve essere < PLAYER.sprintSpeedMps');
  }
  if (balance.PLAYER.crouchSpeedMps >= balance.PLAYER.walkSpeedMps) {
    violations.push('PLAYER.crouchSpeedMps deve essere < PLAYER.walkSpeedMps');
  }
  if (balance.PLAYER.fovMinDeg >= balance.PLAYER.fovMaxDeg) {
    violations.push('PLAYER.fovMinDeg deve essere < PLAYER.fovMaxDeg');
  }
}

if (balance.DARKNESS?.thresholds) {
  const t = balance.DARKNESS.thresholds;
  if (!(t.calm < t.whispers && t.whispers < t.patrols && t.patrols < t.witness)) {
    violations.push('DARKNESS.thresholds devono essere in ordine crescente: calm < whispers < patrols < witness');
  }
}

if (violations.length > 0) {
  console.error('Violazioni di contenuto:\n');
  for (const v of violations) console.error(`  - ${v}`);
  console.error(`\nTotale: ${violations.length}`);
  process.exit(1);
}

console.log('Contenuto: tutti i valori nei range previsti.');
