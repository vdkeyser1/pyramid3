/**
 * Colonne egizie procedurali.
 *
 * Scopo: generare colonne riconoscibilmente egizie senza dipendere da asset
 *        esterni. Sostituiscono `ruins_column` (Kenney), che è un cilindro
 *        bianco liscio con capitello classicheggiante — leggeva come colonna
 *        greco-romana, l'elemento più fuori tema della scena.
 * Ownership: rendering. Consumato da ThreeRendererService.
 * Invarianti:
 *   - nessun Math.random: la variante dipende solo dal seed passato;
 *   - le geometrie sono create per colonna e liberate con dispose();
 *   - scala reale: le colonne stanno sotto l'altezza delle pareti (4,5 m).
 *
 * Riferimenti: i tre tipi principali dell'architettura egizia sono il
 * papiriforme (pianta araldica del Basso Egitto), il lotiforme (Alto Egitto)
 * e il palmiforme (otto foglie di palma legate a un palo). Ciò che rende una
 * colonna riconoscibile è la combinazione di fusto scanalato e capitello
 * caratterizzato — nessuno dei due presente nell'asset precedente.
 */

import * as THREE from 'three';

export type EgyptianColumnKind = 'papyrus' | 'lotus' | 'palm';

export interface EgyptianColumn {
  readonly group: THREE.Group;
  /** Libera geometrie e materiali della colonna. */
  dispose(): void;
}

/** Altezza totale della colonna: sotto i 4,5 m delle pareti. */
const COLUMN_HEIGHT_M = 3.9;
/** Raggio del fusto a metà altezza. */
const SHAFT_RADIUS_M = 0.34;

/**
 * Profilo del fusto come punti (x = raggio, y = altezza), poi rivoluzionato
 * con LatheGeometry. L'entasi (rigonfiamento) e il restringimento verso il
 * capitello sono ciò che distingue una colonna scolpita da un cilindro.
 */
function shaftProfile(kind: EgyptianColumnKind): THREE.Vector2[] {
  const h = COLUMN_HEIGHT_M;
  const r = SHAFT_RADIUS_M;

  // Base a plinto: tutte le colonne egizie poggiano su un disco.
  const points: THREE.Vector2[] = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(r * 1.32, 0),
    new THREE.Vector2(r * 1.32, h * 0.035),
    new THREE.Vector2(r * 1.08, h * 0.06),
  ];

  if (kind === 'papyrus') {
    // Fusto che si assottiglia, capitello a ombrella aperta.
    points.push(
      new THREE.Vector2(r * 1.02, h * 0.10),
      new THREE.Vector2(r * 0.95, h * 0.55),
      new THREE.Vector2(r * 0.82, h * 0.78),
      // Collo stretto sotto il capitello: la legatura del fascio di steli.
      new THREE.Vector2(r * 0.72, h * 0.82),
      new THREE.Vector2(r * 0.76, h * 0.85),
      // Ombrella: si apre bruscamente verso l'alto.
      new THREE.Vector2(r * 1.55, h * 0.94),
      new THREE.Vector2(r * 1.62, h * 0.985),
      new THREE.Vector2(r * 1.30, h),
      new THREE.Vector2(0, h),
    );
  } else if (kind === 'lotus') {
    // Capitello a bocciolo chiuso: si gonfia e poi si chiude a punta.
    points.push(
      new THREE.Vector2(r * 1.0, h * 0.10),
      new THREE.Vector2(r * 0.94, h * 0.60),
      new THREE.Vector2(r * 0.80, h * 0.80),
      new THREE.Vector2(r * 0.74, h * 0.84),
      new THREE.Vector2(r * 1.18, h * 0.90),
      new THREE.Vector2(r * 1.24, h * 0.95),
      new THREE.Vector2(r * 0.55, h * 0.995),
      new THREE.Vector2(0, h),
    );
  } else {
    // Palmiforme: fusto liscio, capitello svasato a foglie.
    points.push(
      new THREE.Vector2(r * 0.98, h * 0.10),
      new THREE.Vector2(r * 0.90, h * 0.72),
      new THREE.Vector2(r * 0.78, h * 0.80),
      new THREE.Vector2(r * 1.05, h * 0.88),
      new THREE.Vector2(r * 1.48, h * 0.97),
      new THREE.Vector2(r * 1.20, h),
      new THREE.Vector2(0, h),
    );
  }

  return points;
}

/**
 * Crea una colonna egizia completa.
 *
 * @param seed - Determina il tipo e le micro-variazioni. Colonne diverse
 *               nella stessa sala devono variare senza essere casuali.
 * @param kind - Forza un tipo specifico; se omesso deriva dal seed.
 */
export function createEgyptianColumn(
  seed = 0,
  kind?: EgyptianColumnKind,
): EgyptianColumn {
  const kinds: readonly EgyptianColumnKind[] = ['papyrus', 'lotus', 'palm'];
  const resolved = kind ?? kinds[Math.abs(seed) % kinds.length] ?? 'papyrus';

  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];

  // Calcare/arenaria chiara, non marmo bianco: la pietra egizia è calda.
  const stoneMaterial = new THREE.MeshStandardMaterial({
    color: 0xB89A6E,
    roughness: 0.92,
    metalness: 0.0,
  });
  disposables.push(stoneMaterial);

  // Fascia dipinta del capitello: ocra rossa, il pigmento più comune.
  const paintMaterial = new THREE.MeshStandardMaterial({
    color: 0x9C4227,
    roughness: 0.85,
    metalness: 0.0,
  });
  disposables.push(paintMaterial);

  // ── Fusto + capitello (superficie di rivoluzione) ───────────────────────
  // 24 segmenti radiali: abbastanza per leggere tondo, poco per il budget.
  const lathe = new THREE.LatheGeometry(shaftProfile(resolved), 24);
  lathe.computeVertexNormals();
  disposables.push(lathe);
  const body = new THREE.Mesh(lathe, stoneMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // ── Scanalature del fusto ───────────────────────────────────────────────
  // Il fusto papiriforme rappresenta un fascio di steli legati: le costole
  // verticali sono il dettaglio che più dice "egizio" da vicino.
  if (resolved !== 'palm') {
    const RIBS = 8;
    const ribGeo = new THREE.CylinderGeometry(
      SHAFT_RADIUS_M * 0.14, SHAFT_RADIUS_M * 0.12, COLUMN_HEIGHT_M * 0.70, 6,
    );
    disposables.push(ribGeo);
    for (let i = 0; i < RIBS; i++) {
      const a = (i / RIBS) * Math.PI * 2;
      const rib = new THREE.Mesh(ribGeo, stoneMaterial);
      rib.position.set(
        Math.cos(a) * SHAFT_RADIUS_M * 0.92,
        COLUMN_HEIGHT_M * 0.45,
        Math.sin(a) * SHAFT_RADIUS_M * 0.92,
      );
      rib.castShadow = true;
      group.add(rib);
    }
  } else {
    // Palmiforme: otto foglie inclinate verso l'esterno sotto il capitello.
    const FRONDS = 8;
    const frondGeo = new THREE.BoxGeometry(
      SHAFT_RADIUS_M * 0.20, COLUMN_HEIGHT_M * 0.20, SHAFT_RADIUS_M * 0.06,
    );
    disposables.push(frondGeo);
    for (let i = 0; i < FRONDS; i++) {
      const a = (i / FRONDS) * Math.PI * 2;
      const frond = new THREE.Mesh(frondGeo, stoneMaterial);
      frond.position.set(
        Math.cos(a) * SHAFT_RADIUS_M * 1.15,
        COLUMN_HEIGHT_M * 0.90,
        Math.sin(a) * SHAFT_RADIUS_M * 1.15,
      );
      frond.rotation.set(0, -a, 0.34);
      frond.castShadow = true;
      group.add(frond);
    }
  }

  // ── Bande dipinte sotto il capitello ────────────────────────────────────
  // Cinque anelli stretti: la legatura del fascio, sempre dipinta a colori.
  const bandGeo = new THREE.TorusGeometry(
    SHAFT_RADIUS_M * 0.80, SHAFT_RADIUS_M * 0.055, 6, 20,
  );
  disposables.push(bandGeo);
  for (let i = 0; i < 5; i++) {
    const band = new THREE.Mesh(bandGeo, paintMaterial);
    band.rotation.x = Math.PI / 2;
    band.position.y = COLUMN_HEIGHT_M * (0.795 + i * 0.017);
    group.add(band);
  }

  return {
    group,
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
