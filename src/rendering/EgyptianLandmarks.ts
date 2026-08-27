/**
 * ART-004b — Landmark egizi procedurali.
 *
 * Scopo: sostituire le primitive astratte dei landmark privi di modello.
 *        13 dei 18 landmark hanno `modelPath: null` in assets.ts e finivano
 *        in scena come un cono, una scatola o un cilindro — forme che non
 *        rappresentano nulla e non dicono al giocatore cosa sta guardando.
 *
 * Ownership: rendering. Consumato da ThreeDungeonLayout quando il manifest
 *        non fornisce un GLB per quel tipo.
 *
 * Invarianti:
 *   - ogni forma è composta ma leggera (poche decine di triangoli);
 *   - l'origine è a terra (y = 0): il chiamante posiziona senza offset;
 *   - nessun materiale proprio — usa quello passato, così la palette del
 *     piano resta coerente.
 *
 * Failure mode: nessuno — geometria puramente procedurale.
 */

import * as THREE from 'three';

/**
 * Statua monumentale seduta, sul modello dei colossi di Menfi.
 *
 * Sostituisce un ConeGeometry: un cono non è una statua, e in scena non
 * comunicava alcuna presenza.
 */
export function buildStatue(material: THREE.Material): THREE.Group {
  const g = new THREE.Group();

  // Trono/basamento: la statua egizia seduta è sempre su un blocco.
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.2), material);
  base.position.y = 0.275;
  g.add(base);

  // Gambe: due blocchi paralleli protesi in avanti.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.95), material);
    leg.position.set(side * 0.34, 0.76, 0.22);
    g.add(leg);
  }

  // Busto, leggermente rastremato verso le spalle.
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 1.0, 8), material);
  torso.position.y = 1.47;
  g.add(torso);

  // Braccia lungo i fianchi, appoggiate alle ginocchia.
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.20), material);
    arm.position.set(side * 0.52, 1.35, 0.10);
    arm.rotation.x = -0.18;
    g.add(arm);
  }

  // Nemes: il copricapo trapezoidale che rende la silhouette inconfondibile.
  const nemes = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.30, 0.52, 6), material);
  nemes.position.y = 2.20;
  g.add(nemes);

  // Volto.
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.30), material);
  head.position.set(0, 2.12, 0.22);
  g.add(head);

  // Barba cerimoniale posticcia, dritta sotto il mento.
  const beard = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.28, 0.10), material);
  beard.position.set(0, 1.86, 0.28);
  g.add(beard);

  for (const child of g.children) {
    child.castShadow = true;
    child.receiveShadow = true;
  }
  return g;
}

export type SarcophagusVariant = 'CLOSED' | 'OPEN' | 'BROKEN' | 'ROYAL_GOLD';

/**
 * Sarcofago egizio antropomorfo procedurale con 4 varianti:
 *  - CLOSED: cassa sigillata intatta;
 *  - OPEN: coperchio scoperchiato di sbieco con cavità interna;
 *  - BROKEN: cassa spaccata e frammenti di pietra sparsi;
 *  - ROYAL_GOLD: cassa dorata con maschera funeraria, barba cerimoniale e scettro.
 */
export function buildSarcophagus(
  material: THREE.Material,
  variant: SarcophagusVariant = 'CLOSED',
  goldMaterial?: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const mat = material;
  const accentMat = goldMaterial ?? material;

  // Cassa principale rastremata
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.34, 2.05, 8), mat);
  body.rotation.z = Math.PI / 2;
  body.scale.set(1, 1, 0.62);
  body.position.y = 0.34;
  g.add(body);

  if (variant === 'OPEN') {
    // Coperchio scoperchiato e traslato di sbieco
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.30, 1.95, 8, 1, false, 0, Math.PI), mat);
    lid.rotation.set(0.12, 0.25, Math.PI / 2);
    lid.scale.set(1, 1, 0.62);
    lid.position.set(0.2, 0.62, 0.38);
    g.add(lid);

    // Testa scolpita sul coperchio traslato
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), mat);
    head.scale.set(1, 1.15, 0.75);
    head.position.set(-0.72, 0.64, 0.38);
    g.add(head);

    // Cavità interna scura
    const cavityMat = new THREE.MeshBasicMaterial({ color: 0x070605 });
    const cavity = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.48), cavityMat);
    cavity.rotation.x = -Math.PI / 2;
    cavity.position.set(0, 0.42, 0);
    g.add(cavity);
  } else if (variant === 'BROKEN') {
    // Coperchio spezzato a metà
    const halfLid = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.38, 0.95, 8, 1, false, 0, Math.PI), mat);
    halfLid.rotation.set(-0.15, 0.1, Math.PI / 2);
    halfLid.scale.set(1, 1, 0.62);
    halfLid.position.set(0.45, 0.52, 0.12);
    g.add(halfLid);

    // Frammenti di pietra sparsi attorno
    for (let i = 0; i < 4; i++) {
      const shard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.28), mat);
      const angle = (i * Math.PI) / 2 + 0.3;
      shard.position.set(Math.cos(angle) * 0.85, 0.06, Math.sin(angle) * 0.55);
      shard.rotation.set(0.2 * i, 0.5 * i, 0.1 * i);
      g.add(shard);
    }
  } else if (variant === 'ROYAL_GOLD') {
    // Coperchio intatto con maschera dorata
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.30, 1.95, 8, 1, false, 0, Math.PI), accentMat);
    lid.rotation.set(0, 0, Math.PI / 2);
    lid.scale.set(1, 1, 0.62);
    lid.position.y = 0.60;
    g.add(lid);

    // Maschera funeraria faraonica (Nemes)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), accentMat);
    head.scale.set(1.1, 1.25, 0.85);
    head.position.set(-0.92, 0.64, 0);
    g.add(head);

    // Barba cerimoniale faraonica
    const beard = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.28, 6), accentMat);
    beard.rotation.z = Math.PI / 2 + 0.25;
    beard.position.set(-1.18, 0.52, 0);
    g.add(beard);

    // Scettri regali incrociati sul petto (Flagello e Bastone pastorale)
    const scepter1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.65, 6), accentMat);
    scepter1.rotation.set(0.4, 0, 0.6);
    scepter1.position.set(-0.45, 0.72, 0);
    g.add(scepter1);

    const scepter2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.65, 6), accentMat);
    scepter2.rotation.set(-0.4, 0, 0.6);
    scepter2.position.set(-0.45, 0.72, 0);
    g.add(scepter2);
  } else {
    // CLOSED standard
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.30, 1.95, 8, 1, false, 0, Math.PI), mat);
    lid.rotation.set(0, 0, Math.PI / 2);
    lid.scale.set(1, 1, 0.62);
    lid.position.y = 0.60;
    g.add(lid);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), mat);
    head.scale.set(1, 1.15, 0.75);
    head.position.set(-0.92, 0.62, 0);
    g.add(head);
  }

  for (const child of g.children) {
    child.castShadow = true;
    child.receiveShadow = true;
  }
  return g;
}

/**
 * Vaso canopo monumentale: corpo panciuto e coperchio a testa di divinità.
 * Sostituisce un cilindro nudo.
 */
export function buildCanopicJar(material: THREE.Material): THREE.Group {
  const g = new THREE.Group();

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.20, 0.95), material);
  plinth.position.y = 0.10;
  g.add(plinth);

  // Corpo: due tronchi di cono opposti danno la pancia del vaso.
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.28, 0.55, 12), material);
  lower.position.y = 0.47;
  g.add(lower);
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.42, 0.45, 12), material);
  upper.position.y = 0.97;
  g.add(upper);

  // Collo e coperchio a testa.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.30, 0.12, 12), material);
  neck.position.y = 1.25;
  g.add(neck);

  const headLid = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.34, 8), material);
  headLid.position.y = 1.48;
  g.add(headLid);

  // Orecchie/muso stilizzati: bastano a leggere come testa animale.
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.26), material);
  snout.position.set(0, 1.46, 0.20);
  g.add(snout);

  for (const child of g.children) {
    child.castShadow = true;
    child.receiveShadow = true;
  }
  return g;
}

/**
 * Pozzo: vera cavità nel pavimento con parapetto, non un cilindro pieno.
 * Il fondo scuro suggerisce profondità senza scavare geometria.
 */
export function buildWell(material: THREE.Material): THREE.Group {
  const g = new THREE.Group();

  // Parapetto ad anello.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.20, 8, 20), material);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.38;
  g.add(rim);

  // Ghiera bassa attorno alla bocca.
  const kerb = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.18, 0.24, 20, 1, true), material);
  kerb.position.y = 0.12;
  g.add(kerb);

  // Fondo: disco nero opaco che legge come vuoto profondo.
  const voidMat = new THREE.MeshBasicMaterial({ color: 0x05060A });
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.95, 20), voidMat);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.02;
  g.add(bottom);

  for (const child of g.children) {
    child.castShadow = true;
    child.receiveShadow = true;
  }
  return g;
}

/**
 * Altare a gradoni con lastra d'offerta e corna sacrificali agli angoli.
 * Sostituisce una scatola liscia.
 */
export function buildAltar(material: THREE.Material): THREE.Group {
  const g = new THREE.Group();

  const step1 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.26, 1.4), material);
  step1.position.y = 0.13;
  g.add(step1);
  const step2 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.26, 1.15), material);
  step2.position.y = 0.39;
  g.add(step2);

  // Lastra d'offerta, leggermente aggettante.
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.16, 1.3), material);
  slab.position.y = 0.60;
  g.add(slab);

  // Corna agli angoli: il segno che distingue un altare da un tavolo.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 5), material);
      horn.position.set(sx * 0.80, 0.81, sz * 0.52);
      g.add(horn);
    }
  }

  for (const child of g.children) {
    child.castShadow = true;
    child.receiveShadow = true;
  }
  return g;
}

export type HorusMaterialVariant = 'SANDSTONE' | 'BASALT' | 'GOLD';

/**
 * Statua monumentale di Horus, dio Falco protettore dei faraoni.
 * Silhouette con ali ripiegate, becco ricurvo e corona sacra Pschent.
 */
export function buildHorusStatue(
  material: THREE.Material,
  variant: HorusMaterialVariant = 'SANDSTONE',
): THREE.Group {
  const g = new THREE.Group();

  let activeMat = material;
  if (variant === 'BASALT') {
    activeMat = new THREE.MeshStandardMaterial({
      color: 0x181716,
      roughness: 0.35,
      metalness: 0.25,
    });
  } else if (variant === 'GOLD') {
    activeMat = new THREE.MeshStandardMaterial({
      color: 0xd4a05a,
      roughness: 0.3,
      metalness: 0.8,
    });
  }

  // Basamento a gradino doppio
  const base1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.4), activeMat);
  base1.position.y = 0.15;
  g.add(base1);

  const base2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 1.1), activeMat);
  base2.position.y = 0.425;
  g.add(base2);

  // Corpo eretto da rapace
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 1.4, 8), activeMat);
  body.position.set(0, 1.25, 0);
  g.add(body);

  // Ali ripiegate ai lati
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.55), activeMat);
    wing.position.set(side * 0.42, 1.15, -0.05);
    wing.rotation.z = side * 0.12;
    g.add(wing);
  }

  // Petto pronunciato
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), activeMat);
  chest.position.set(0, 1.45, 0.22);
  g.add(chest);

  // Testa di falco
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.38), activeMat);
  head.position.set(0, 2.05, 0.05);
  g.add(head);

  // Becco ricurvo affilato
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 5), activeMat);
  beak.position.set(0, 1.96, 0.38);
  beak.rotation.x = Math.PI / 2 + 0.3;
  g.add(beak);

  // Corona Pschent dell Alto e Basso Egitto
  const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.35, 6), activeMat);
  crownBase.position.set(0, 2.35, 0.02);
  g.add(crownBase);

  const crownSpire = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.65, 5), activeMat);
  crownSpire.position.set(0, 2.80, -0.04);
  g.add(crownSpire);

  for (const child of g.children) {
    child.castShadow = true;
    child.receiveShadow = true;
  }
  return g;
}

