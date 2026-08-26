import * as THREE from 'three';
import { resolveLandmarkPlaceholder } from '@/content/LandmarkPlaceholders.js';
import { presetFor, type CeilingVariant, type RoomTheme } from '@/content/RoomThemes.js';
import {
  buildAltar, buildCanopicJar, buildSarcophagus, buildStatue, buildWell,
} from '@/rendering/EgyptianLandmarks.js';
import {
  buildBladePendulumMesh, buildDartLauncherMesh, buildLeverMesh,
  buildPressurePlateMesh, buildRollingBoulderMesh, buildSealMesh,
} from '@/rendering/TrapMesh.js';
import {
  createInstancedDungeonGroup,
  type TileTransform,
} from '@/rendering/InstancedDungeonRenderer.js';
import { createEgyptianCeiling } from '@/rendering/EgyptianCeilings.js';
import { resolveFeatureFlags } from '@/config/FeatureFlags.js';
import type { RoomBounds as CullBounds } from '@/rendering/FrustumCuller.js';
import type {
  FloorSceneCorridor,
  FloorSceneLandmark,
  FloorSceneLayout,
  FloorSceneLeverPassage,
  FloorSceneRoom,
  FloorSceneTrap,
} from '@/world/FloorSceneLayout.js';

const FLOOR_THICKNESS_M = 0.2;
const WALL_HEIGHT_M = 4.5;
const WALL_THICKNESS_M = 0.45;
const DOOR_WIDTH_M = 2.8;
/**
 * Spessore del soffitto. La piramide è un volume di pietra piena: le camere
 * sono cavità scavate, non stanze a cielo aperto — senza soffitto si vede il
 * vuoto sopra le pareti e l'illusione di essere sottoterra sparisce.
 */
const CEILING_THICKNESS_M = 0.35;
/**
 * I corridoi hanno soffitto più basso delle camere: la compressione dei
 * passaggi stretti che si aprono nelle sale è il ritmo spaziale tipico
 * dell'architettura funeraria egizia.
 */
const CORRIDOR_CEILING_HEIGHT_M = 3.2;

/**
 * Landmark composito per i tipi che hanno una forma riconoscibile.
 * null per i tipi che restano primitive (obelisco e portale sono già
 * caratterizzati, il pannello glyph è per sua natura una lastra piatta).
 */
function buildCompositeLandmark(
  kind: string,
  material: THREE.Material,
): THREE.Group | null {
  switch (kind) {
    case 'statue':      return buildStatue(material);
    case 'sarcophagus': return buildSarcophagus(material);
    case 'relic':       return buildCanopicJar(material);
    case 'well':        return buildWell(material);
    case 'altar':       return buildAltar(material);
    default:            return null;
  }
}

/** Variante di soffitto del tema, con fallback sicuro. */
function ceilingVariantFor(theme: RoomTheme): CeilingVariant {
  return presetFor(theme).ceiling;
}

function createPortalGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.9, 0);
  shape.lineTo(-0.9, 2.4);
  shape.lineTo(-0.5, 2.8);
  shape.lineTo(0.5, 2.8);
  shape.lineTo(0.9, 2.4);
  shape.lineTo(0.9, 0);
  shape.lineTo(0.55, 0);
  shape.lineTo(0.55, 2.05);
  shape.lineTo(0.25, 2.35);
  shape.lineTo(-0.25, 2.35);
  shape.lineTo(-0.55, 2.05);
  shape.lineTo(-0.55, 0);
  shape.lineTo(-0.9, 0);
  return new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false });
}

export interface BuildDungeonLayoutOptions {
  readonly layout: FloorSceneLayout;
  readonly dungeonRoot: THREE.Group;
  readonly floorMaterial: THREE.Material;
  readonly wallMaterial: THREE.Material;
  readonly createStaticBox: (
    x: number,
    y: number,
    z: number,
    hx: number,
    hy: number,
    hz: number,
  ) => void;
  /** G-16: texture emissiva dei geroglifici (CanvasTexture procedurale). */
  readonly glyphEmissiveMap?: THREE.Texture | null;
  /** B-06: color map papiro reale per i landmark glyph (fallback: nessuna). */
  readonly glyphColorMap?: THREE.Texture | null;
  /**
   * Soffitto stellato delle camere (blu egizio + stelle ocra).
   * Se assente si usa wallMaterial: il soffitto c'è comunque, ma in pietra.
   */
  readonly ceilingMaterial?: THREE.Material | null;
  /**
   * ART-006: callback invocata per ogni piastra a pressione costruita.
   * Il chiamante ottiene spikesGroup (il gruppo delle 9 punte) e lo collega
   * a TrapSystem per l'animazione verticale.
   * Opzionale — se assente la trappola è renderizzata ma non animata.
   */
  readonly onPressurePlateMeshReady?: (
    trapId: string,
    spikesGroup: THREE.Object3D,
  ) => void;
  /**
   * ART-006: callback invocata per ogni pendolo a lama costruito.
   * Il chiamante ottiene pivotGroup e imposta rotation.z (corridoio X)
   * o rotation.x (corridoio Z) ogni frame tramite TrapSystem.
   * Opzionale — se assente il pendolo è renderizzato ma fermo.
   */
  readonly onPendulumMeshReady?: (
    trapId: string,
    pivotGroup: THREE.Object3D,
    corridorAxis: 'x' | 'z',
  ) => void;
  /** GAME-ART-012: dardo — travel01 + visible. */
  readonly onDartLauncherMeshReady?: (
    trapId: string,
    dartMesh: THREE.Object3D,
    fireAxis: 'x' | 'z',
  ) => void;
  /** GAME-ART-012: masso — offset lungo l'asse. */
  readonly onRollingBoulderMeshReady?: (
    trapId: string,
    boulderMesh: THREE.Object3D,
    rollAxis: 'x' | 'z',
  ) => void;
  /**
   * ART-006: callback invocata per il meccanismo leva+sigillo.
   * handleMesh ruota di rotation.z quando la leva viene tirata;
   * sealMesh.position.y scende da sealDropM/2 a –sealDropM/2.
   * Opzionale — se assente il meccanismo è renderizzato ma statico.
   */
  readonly onLeverMeshReady?: (
    leverId: string,
    handleMesh: THREE.Mesh,
    sealMesh: THREE.Mesh,
  ) => void;
}

export function buildDungeonLayout(options: BuildDungeonLayoutOptions): CullBounds[] {
  const { layout, dungeonRoot, floorMaterial, wallMaterial, createStaticBox, glyphEmissiveMap } = options;
  // Senza soffitto stellato le camere restano chiuse comunque, in pietra.
  const ceilingMaterial = options.ceilingMaterial ?? wallMaterial;

  // R-03: active room group — geometry goes here instead of dungeonRoot during
  // addRoom / addCorridor so the FrustumCuller can cull per-room.
  let _roomGroup: THREE.Group | null = null;

  // GAME-ART-003/010: pavimenti batched in un solo InstancedMesh.
  const useInstancedFloors = resolveFeatureFlags().instancedFloors;
  const floorTiles: TileTransform[] = [];
  const instancedFloors = useInstancedFloors
    ? createInstancedDungeonGroup(floorMaterial, wallMaterial, wallMaterial)
    : null;
  if (instancedFloors) {
    dungeonRoot.add(instancedFloors.root);
  }

  function addFloorSlab(width: number, depth: number, x: number, z: number): void {
    createStaticBox(x, -FLOOR_THICKNESS_M / 2, z, width / 2, FLOOR_THICKNESS_M / 2, depth / 2);
    if (instancedFloors) {
      floorTiles.push({
        x,
        y: 0,
        z,
        scaleX: width,
        scaleZ: depth,
      });
      return;
    }
    addDungeonBox(width, FLOOR_THICKNESS_M, depth, x, -FLOOR_THICKNESS_M / 2, z, floorMaterial);
  }

  function addDungeonBox(
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    castShadow = false,
  ): void {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    // G-16 esteso: uv2 = uv per l'aoMap (la AO map richiede il secondo set UV).
    const uv = geometry.attributes.uv;
    if (uv) {
      geometry.setAttribute('uv2', uv);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    (_roomGroup ?? dungeonRoot).add(mesh);
  }

  function addWallSegment(width: number, height: number, depth: number, x: number, y: number, z: number): void {
    addDungeonBox(width, height, depth, x, y, z, wallMaterial, true);
    createStaticBox(x, y, z, width / 2, height / 2, depth / 2);
  }

  function addDirectionalWall(
    direction: 'north' | 'south' | 'east' | 'west',
    centerX: number,
    centerZ: number,
    halfWidth: number,
    halfDepth: number,
    wallY: number,
    hasOpening: boolean,
  ): void {
    if (direction === 'north' || direction === 'south') {
      const wallZ = direction === 'north'
        ? centerZ - halfDepth - WALL_THICKNESS_M / 2
        : centerZ + halfDepth + WALL_THICKNESS_M / 2;
      const width = halfWidth * 2;
      if (!hasOpening) {
        addWallSegment(width, WALL_HEIGHT_M, WALL_THICKNESS_M, centerX, wallY, wallZ);
        return;
      }
      const segmentWidth = Math.max(0.8, (width - DOOR_WIDTH_M) / 2);
      addWallSegment(segmentWidth, WALL_HEIGHT_M, WALL_THICKNESS_M, centerX - (DOOR_WIDTH_M + segmentWidth) / 2, wallY, wallZ);
      addWallSegment(segmentWidth, WALL_HEIGHT_M, WALL_THICKNESS_M, centerX + (DOOR_WIDTH_M + segmentWidth) / 2, wallY, wallZ);
      return;
    }

    const wallX = direction === 'west'
      ? centerX - halfWidth - WALL_THICKNESS_M / 2
      : centerX + halfWidth + WALL_THICKNESS_M / 2;
    const depth = halfDepth * 2;
    if (!hasOpening) {
      addWallSegment(WALL_THICKNESS_M, WALL_HEIGHT_M, depth, wallX, wallY, centerZ);
      return;
    }
    const segmentDepth = Math.max(0.8, (depth - DOOR_WIDTH_M) / 2);
    addWallSegment(WALL_THICKNESS_M, WALL_HEIGHT_M, segmentDepth, wallX, wallY, centerZ - (DOOR_WIDTH_M + segmentDepth) / 2);
    addWallSegment(WALL_THICKNESS_M, WALL_HEIGHT_M, segmentDepth, wallX, wallY, centerZ + (DOOR_WIDTH_M + segmentDepth) / 2);
  }

  function addRoom(room: FloorSceneRoom): void {
    const width = room.bounds.maxX - room.bounds.minX;
    const depth = room.bounds.maxZ - room.bounds.minZ;
    addFloorSlab(width, depth, room.center.x, room.center.z);

    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const wallY = WALL_HEIGHT_M / 2;
    const openings = new Set(room.openings);

    addDirectionalWall('north', room.center.x, room.center.z, halfWidth, halfDepth, wallY, openings.has('north'));
    addDirectionalWall('south', room.center.x, room.center.z, halfWidth, halfDepth, wallY, openings.has('south'));
    addDirectionalWall('east', room.center.x, room.center.z, halfWidth, halfDepth, wallY, openings.has('east'));
    addDirectionalWall('west', room.center.x, room.center.z, halfWidth, halfDepth, wallY, openings.has('west'));

    // ART-004: il soffitto dipende dal tema della stanza.
    //  - STARRY     → cielo dipinto (camere nobili e funerarie)
    //  - HIGH_VAULT → pietra, ma molto più in alto (santuari)
    //  - COLLAPSED  → pietra con una breccia al centro
    //  - FLAT_STONE → pietra piena
    //
    // La stanza resta SEMPRE chiusa sopra. Una prima versione lasciava le
    // camere crollate senza soffitto: si rivedeva il vuoto oltre le pareti,
    // che è esattamente la rottura d'illusione che il soffitto doveva
    // eliminare. Il crollo è una breccia, non un'assenza.
    const ceilingKind = ceilingVariantFor(room.theme);
    const ceilingY = (ceilingKind === 'HIGH_VAULT' ? WALL_HEIGHT_M * 1.5 : WALL_HEIGHT_M)
      + CEILING_THICKNESS_M / 2;
    const ceilingMat = ceilingKind === 'STARRY' ? ceilingMaterial : wallMaterial;
    const fullW = width + WALL_THICKNESS_M * 2;
    const fullD = depth + WALL_THICKNESS_M * 2;

    if (ceilingKind === 'COLLAPSED') {
      // Quattro lastre attorno a un'apertura centrale: il buco lascia
      // intravedere il buio della cavità superiore senza aprire la stanza.
      const holeW = Math.min(fullW * 0.34, 4.2);
      const holeD = Math.min(fullD * 0.34, 4.2);
      const sideW = (fullW - holeW) / 2;
      const sideD = (fullD - holeD) / 2;

      // Fasce nord e sud, a tutta larghezza.
      for (const sign of [-1, 1]) {
        addDungeonBox(
          fullW, CEILING_THICKNESS_M, sideD,
          room.center.x, ceilingY, room.center.z + sign * (holeD + sideD) / 2,
          ceilingMat,
        );
      }
      // Fasce est e ovest, solo per l'altezza del buco.
      for (const sign of [-1, 1]) {
        addDungeonBox(
          sideW, CEILING_THICKNESS_M, holeD,
          room.center.x + sign * (holeW + sideW) / 2, ceilingY, room.center.z,
          ceilingMat,
        );
      }
      // Blocchi di macerie/conci pendenti dal bordo della breccia
      addDungeonBox(0.9, 0.45, 0.7, room.center.x - holeW * 0.4, ceilingY - 0.25, room.center.z - holeD * 0.45, wallMaterial);
      addDungeonBox(0.7, 0.5, 0.85, room.center.x + holeW * 0.35, ceilingY - 0.28, room.center.z + holeD * 0.4, wallMaterial);
      addDungeonBox(0.8, 0.4, 0.6, room.center.x + holeW * 0.42, ceilingY - 0.2, room.center.z - holeD * 0.35, wallMaterial);
    } else if (ceilingKind === 'COFFERED') {
      // Soffitto a cassettoni egizio: lastra superiore + reticolo di architravi a gradino incassati
      addDungeonBox(fullW, CEILING_THICKNESS_M, fullD, room.center.x, ceilingY, room.center.z, ceilingMat);
      const gridCountX = Math.max(2, Math.floor(width / 3.2));
      const gridCountZ = Math.max(2, Math.floor(depth / 3.2));
      const beamThick = 0.32;
      const beamDrop = 0.26;
      const beamY = ceilingY - CEILING_THICKNESS_M / 2 - beamDrop / 2;

      // Travi longitudinali X
      for (let i = 1; i < gridCountZ; i++) {
        const offsetZ = -depth / 2 + (i * depth) / gridCountZ;
        addDungeonBox(width, beamDrop, beamThick, room.center.x, beamY, room.center.z + offsetZ, wallMaterial);
      }
      // Travi trasversali Z
      for (let j = 1; j < gridCountX; j++) {
        const offsetX = -width / 2 + (j * width) / gridCountX;
        addDungeonBox(beamThick, beamDrop, depth, room.center.x + offsetX, beamY, room.center.z, wallMaterial);
      }
    } else if (ceilingKind === 'BEAMED') {
      // Grande galleria: architravi monolitici massicci in pietra posati a intervalli regolari
      addDungeonBox(fullW, CEILING_THICKNESS_M, fullD, room.center.x, ceilingY, room.center.z, ceilingMat);
      const beamCount = Math.max(2, Math.floor(depth / 2.6));
      const beamWidth = 0.55;
      const beamHeight = 0.42;
      const beamY = ceilingY - CEILING_THICKNESS_M / 2 - beamHeight / 2;

      for (let i = 0; i <= beamCount; i++) {
        const offsetZ = -depth / 2 + (i * depth) / Math.max(1, beamCount);
        addDungeonBox(width, beamHeight, beamWidth, room.center.x, beamY, room.center.z + offsetZ, wallMaterial);
      }
    } else if (ceilingKind === 'HIGH_VAULT') {
      // Volta monumentale: quota elevata con architravi perimetrali e costoloni di supporto
      addDungeonBox(fullW, CEILING_THICKNESS_M, fullD, room.center.x, ceilingY, room.center.z, ceilingMat);
      const vaultGroup = createEgyptianCeiling({
        width: fullW,
        depth: fullD,
        height: 0,
        style: 'corbelled_vault',
      });
      vaultGroup.position.set(room.center.x, WALL_HEIGHT_M - 0.1, room.center.z);
      if (_roomGroup) _roomGroup.add(vaultGroup);
      else dungeonRoot.add(vaultGroup);
    } else if (ceilingKind === 'STARRY') {
      // Soffitto stellato in lapislazzuli con costellazioni d'oro e disco solare
      addDungeonBox(fullW, CEILING_THICKNESS_M, fullD, room.center.x, ceilingY, room.center.z, ceilingMat);
      const starlitGroup = createEgyptianCeiling({
        width: fullW,
        depth: fullD,
        height: 0,
        style: 'starlit_lapis',
      });
      starlitGroup.position.set(room.center.x, ceilingY - CEILING_THICKNESS_M / 2, room.center.z);
      if (_roomGroup) _roomGroup.add(starlitGroup);
      else dungeonRoot.add(starlitGroup);
    } else {
      // Copre anche lo spessore delle pareti: dal basso non si vede alcuna
      // fessura verso il vuoto esterno.
      addDungeonBox(fullW, CEILING_THICKNESS_M, fullD, room.center.x, ceilingY, room.center.z, ceilingMat);
    }
  }

  function addCorridor(corridor: FloorSceneCorridor): void {
    const width = corridor.bounds.maxX - corridor.bounds.minX;
    const depth = corridor.bounds.maxZ - corridor.bounds.minZ;
    const centerX = (corridor.bounds.minX + corridor.bounds.maxX) / 2;
    const centerZ = (corridor.bounds.minZ + corridor.bounds.maxZ) / 2;
    const wallY = WALL_HEIGHT_M / 2;

    addFloorSlab(width, depth, centerX, centerZ);

    // Soffitto del corridoio: più basso di quello delle camere, e in pietra
    // (mai stellato — il cielo dipinto è riservato alle sale funerarie).
    // La compressione del passaggio rende più ampia la sala che si apre dopo.
    addDungeonBox(
      width + WALL_THICKNESS_M * 2,
      CEILING_THICKNESS_M,
      depth + WALL_THICKNESS_M * 2,
      centerX,
      CORRIDOR_CEILING_HEIGHT_M + CEILING_THICKNESS_M / 2,
      centerZ,
      wallMaterial,
    );

    if (corridor.axis === 'x') {
      addWallSegment(width, WALL_HEIGHT_M, WALL_THICKNESS_M, centerX, wallY, corridor.bounds.minZ - WALL_THICKNESS_M / 2);
      addWallSegment(width, WALL_HEIGHT_M, WALL_THICKNESS_M, centerX, wallY, corridor.bounds.maxZ + WALL_THICKNESS_M / 2);
      return;
    }

    addWallSegment(WALL_THICKNESS_M, WALL_HEIGHT_M, depth, corridor.bounds.minX - WALL_THICKNESS_M / 2, wallY, centerZ);
    addWallSegment(WALL_THICKNESS_M, WALL_HEIGHT_M, depth, corridor.bounds.maxX + WALL_THICKNESS_M / 2, wallY, centerZ);
  }

  function addLandmark(landmark: FloorSceneLandmark): void {
    const placeholder = resolveLandmarkPlaceholder(landmark.landmarkId, landmark.role);
    const material = new THREE.MeshStandardMaterial({
      color: placeholder.baseColorHex,
      roughness: placeholder.kind === 'portal' ? 0.45 : 0.62,
      metalness: placeholder.kind === 'glyph' || placeholder.kind === 'portal' ? 0.35 : 0.18,
      emissive: placeholder.emissiveColorHex,
      emissiveIntensity: placeholder.kind === 'glyph' || placeholder.kind === 'portal' ? 0.75 : 0.2,
    });
    // G-16: i glifi usano la texture geroglifica come mappa emissiva —
    // i geroglifici "si accendono" quando la torcia si avvicina.
    if (placeholder.kind === 'glyph' && glyphEmissiveMap) {
      material.emissiveMap = glyphEmissiveMap;
      material.emissive.setHex(0x6ee0d1);
      material.emissiveIntensity = 0.9;
    }
    // B-06: il papiro reale (OpenGameArt CC0) come color map dei glifi —
    // il testo è scolpito nella pietra invece del colore piatto.
    if (placeholder.kind === 'glyph' && options.glyphColorMap) {
      material.map = options.glyphColorMap;
      material.color.setHex(0xffffff);
    }
    // ART-004b: forme composite riconoscibili al posto delle primitive.
    // 13 landmark su 18 non hanno un GLB nel manifest e finivano in scena
    // come coni e scatole: forme che non rappresentano nulla e non dicono
    // al giocatore cosa sta guardando. Il GLB, quando c'è, viene comunque
    // caricato sopra da loadLandmarkModels e copre questa geometria.
    const composite = buildCompositeLandmark(placeholder.kind, material);
    if (composite) {
      composite.position.set(landmark.position.x, 0, landmark.position.z);
      (_roomGroup ?? dungeonRoot).add(composite);
      createStaticBox(landmark.position.x, 0.9, landmark.position.z, 0.8, 0.9, 0.8);
      return;
    }

    let geometry: THREE.BufferGeometry;
    let yOffset: number;
    switch (placeholder.kind) {
      case 'altar':
        geometry = new THREE.BoxGeometry(1.8, 0.95, 1.2);
        yOffset = 0.7;
        break;
      case 'brazier':
        geometry = new THREE.CylinderGeometry(0.52, 0.72, 0.45, 12);
        yOffset = 1.05;
        break;
      case 'glyph':
        geometry = new THREE.BoxGeometry(1.7, 1.05, 0.22);
        yOffset = 1.0;
        break;
      case 'obelisk':
        // B-02: prisma rettangolare + piramide apicale (obelisco autentico)
        geometry = new THREE.BoxGeometry(0.55, 2.6, 0.55);
        yOffset = 1.62;
        break;
      case 'portal':
        geometry = createPortalGeometry();
        yOffset = 0;
        break;
      case 'sarcophagus':
        // B-02: corpo sarcofago + coperchio stilizzato (aggiunto sotto)
        geometry = new THREE.BoxGeometry(1.9, 0.75, 0.95);
        yOffset = 0.6;
        break;
      case 'statue':
        // B-02: corpo cilindrico stiforme + testa (sfera aggiunta sotto)
        geometry = new THREE.CylinderGeometry(0.32, 0.42, 1.65, 8);
        yOffset = 1.12;
        break;
      case 'well':
        geometry = new THREE.CylinderGeometry(0.9, 1.05, 0.9, 14);
        yOffset = 0.62;
        break;
      case 'relic':
      default:
        geometry = new THREE.ConeGeometry(0.76, 2.35, 6);
        yOffset = 1.25;
        break;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(landmark.position.x, yOffset, landmark.position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    dungeonRoot.add(mesh);

    // B-02: geometrie dettaglio aggiuntive per landmark chiave
    if (placeholder.kind === 'sarcophagus') {
      // Coperchio dorato a rilievo sopra il corpo
      const lidMat = new THREE.MeshStandardMaterial({
        color: 0xc8a84b,
        roughness: 0.45,
        metalness: 0.72,
        emissive: 0x2a1900,
        emissiveIntensity: 0.15,
      });
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.22, 0.93), lidMat);
      lid.position.set(landmark.position.x, yOffset + 0.48, landmark.position.z);
      lid.castShadow = true;
      dungeonRoot.add(lid);
      // Bordo decorativo (geroglifico) sul coperchio
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x3a3020, roughness: 0.6, metalness: 0.3 });
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.08, 0.97), trimMat);
      trim.position.set(landmark.position.x, yOffset + 0.37, landmark.position.z);
      dungeonRoot.add(trim);
    } else if (placeholder.kind === 'obelisk') {
      // Piramide apicale dorata (pyramidion)
      const pyramidMat = new THREE.MeshStandardMaterial({
        color: 0xd4a05a,
        roughness: 0.3,
        metalness: 0.8,
        emissive: 0x3a2800,
        emissiveIntensity: 0.3,
      });
      const pyramidion = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.55, 4, 1), pyramidMat);
      pyramidion.rotation.y = Math.PI / 4; // allinea gli spigoli
      pyramidion.position.set(landmark.position.x, yOffset + 1.35, landmark.position.z);
      pyramidion.castShadow = true;
      dungeonRoot.add(pyramidion);
      // Base quadrata dell'obelisco
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x5c4a2a, roughness: 0.7, metalness: 0.25 });
      const obelBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.9), baseMat);
      obelBase.position.set(landmark.position.x, 0.46, landmark.position.z);
      obelBase.castShadow = true;
      dungeonRoot.add(obelBase);
    } else if (placeholder.kind === 'statue') {
      // Testa sferica con copricapo nemes (disco piatto dorato)
      const headMat = new THREE.MeshStandardMaterial({ color: placeholder.baseColorHex, roughness: 0.55, metalness: 0.2 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), headMat);
      head.position.set(landmark.position.x, yOffset + 1.0, landmark.position.z);
      head.castShadow = true;
      dungeonRoot.add(head);
      // Copricapo nemes: disco dorato schiacciato
      const nemesMat = new THREE.MeshStandardMaterial({ color: 0xc8a84b, roughness: 0.35, metalness: 0.78 });
      const nemes = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.1, 12), nemesMat);
      nemes.position.set(landmark.position.x, yOffset + 1.22, landmark.position.z);
      dungeonRoot.add(nemes);
    }

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.1, 0.35, 8),
      wallMaterial,
    );
    pedestal.position.set(landmark.position.x, 0.18, landmark.position.z);
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    dungeonRoot.add(pedestal);

    if (placeholder.kind === 'brazier' || placeholder.kind === 'portal' || placeholder.kind === 'glyph') {
      const accent = new THREE.Mesh(
        new THREE.SphereGeometry(placeholder.kind === 'portal' ? 0.18 : 0.14, 8, 8),
        new THREE.MeshStandardMaterial({
          color: placeholder.accentColorHex,
          emissive: placeholder.accentColorHex,
          emissiveIntensity: placeholder.kind === 'portal' ? 1.35 : 0.85,
          roughness: 0.2,
          metalness: 0.45,
        }),
      );
      accent.position.set(
        landmark.position.x,
        placeholder.kind === 'portal' ? 2.15 : 1.32,
        landmark.position.z,
      );
      accent.castShadow = false;
      accent.receiveShadow = false;
      dungeonRoot.add(accent);
    }

    createStaticBox(landmark.position.x, 0.18, landmark.position.z, 0.55, 0.18, 0.55);
  }

  /**
   * ART-006: piastra a pressione.
   *
   * La lastra è sul pavimento; le punte sono figlie di spikesGroup, che
   * parte con position.y = 0 (punte nascoste) e viene animato verso l'alto
   * da TrapSystem. Il corpo fisico non è necessario: le trappole sono
   * geometria pura, il danno è calcolato dalla simulazione (distanza).
   */
  function addPressurePlate(trap: FloorSceneTrap): void {
    const { plate, spikesGroup } = buildPressurePlateMesh(wallMaterial);
    plate.position.set(trap.position.x, 0, trap.position.z);
    dungeonRoot.add(plate);
    spikesGroup.position.set(trap.position.x, 0, trap.position.z);
    dungeonRoot.add(spikesGroup);
    options.onPressurePlateMeshReady?.(trap.trapId, spikesGroup);
  }

  /**
   * ART-006: pendolo a lama da soffitto.
   *
   * Il mountMesh è statico (il blocco al soffitto). pivotGroup contiene braccio
   * e lama e viene animato in rotazione da TrapSystem. L'asse di rotazione
   * dipende dal corridoio ospite: corridoio X → rotation.z, corridoio Z → rotation.x.
   * Questa mappatura avviene nel codice che registra l'animator in TrapSystem,
   * non qui: il renderer si limita a consegnare il pivotGroup alla callback.
   */
  function addBladePendulum(trap: FloorSceneTrap): void {
    const { pivotGroup, mountMesh } = buildBladePendulumMesh(wallMaterial);
    mountMesh.position.set(trap.position.x, 0, trap.position.z);
    pivotGroup.position.set(trap.position.x, 0, trap.position.z);
    dungeonRoot.add(mountMesh);
    dungeonRoot.add(pivotGroup);
    options.onPendulumMeshReady?.(trap.trapId, pivotGroup, trap.corridorAxis ?? 'x');
  }

  function addDartLauncher(trap: FloorSceneTrap): void {
    const { housing, dartMesh } = buildDartLauncherMesh(wallMaterial);
    housing.position.set(trap.position.x, 0, trap.position.z);
    dartMesh.position.set(trap.position.x, 1.15, trap.position.z);
    const axis = trap.corridorAxis ?? 'x';
    if (axis === 'z') {
      dartMesh.rotation.set(Math.PI / 2, 0, 0);
    }
    dungeonRoot.add(housing);
    dungeonRoot.add(dartMesh);
    options.onDartLauncherMeshReady?.(trap.trapId, dartMesh, axis);
  }

  function addRollingBoulder(trap: FloorSceneTrap): void {
    const { boulderMesh } = buildRollingBoulderMesh(wallMaterial);
    boulderMesh.position.set(trap.position.x, 0.72, trap.position.z);
    dungeonRoot.add(boulderMesh);
    options.onRollingBoulderMeshReady?.(trap.trapId, boulderMesh, trap.corridorAxis ?? 'x');
  }

  /**
   * ART-006: meccanismo leva + sigillo di pietra.
   *
   * La leva è addossata alla parete; il sigillo è posizionato secondo
   * sealPosition (centro della lastra nella posizione "chiusa").
   * Nessun corpo fisico per il sigillo: il passaggio è sempre aperto,
   * la lastra è solo visiva.
   */
  function addLeverPassage(passage: FloorSceneLeverPassage): void {
    const { leverGroup, handleMesh } = buildLeverMesh(wallMaterial);
    leverGroup.position.set(passage.leverPosition.x, 0, passage.leverPosition.z);
    dungeonRoot.add(leverGroup);

    const sealMesh = buildSealMesh(wallMaterial, passage.sealWidthM, passage.sealDepthM);
    sealMesh.position.set(
      passage.sealPosition.x,
      passage.sealPosition.y,
      passage.sealPosition.z,
    );
    dungeonRoot.add(sealMesh);

    options.onLeverMeshReady?.(passage.leverId, handleMesh, sealMesh);
  }

  const cullBounds: CullBounds[] = [];

  for (const room of layout.rooms) {
    const group = new THREE.Group();
    dungeonRoot.add(group);
    _roomGroup = group;
    addRoom(room);
    _roomGroup = null;
    cullBounds.push({
      id: String(room.roomId),
      min: { x: room.bounds.minX, y: -FLOOR_THICKNESS_M, z: room.bounds.minZ },
      max: { x: room.bounds.maxX, y: WALL_HEIGHT_M, z: room.bounds.maxZ },
      group,
    });
  }

  for (const corridor of layout.corridors) {
    const group = new THREE.Group();
    dungeonRoot.add(group);
    _roomGroup = group;
    addCorridor(corridor);
    _roomGroup = null;
    cullBounds.push({
      id: `${String(corridor.fromRoomId)}-${String(corridor.toRoomId)}`,
      min: { x: corridor.bounds.minX, y: -FLOOR_THICKNESS_M, z: corridor.bounds.minZ },
      max: { x: corridor.bounds.maxX, y: WALL_HEIGHT_M, z: corridor.bounds.maxZ },
      group,
    });
  }

  for (const landmark of layout.landmarks) {
    addLandmark(landmark);
  }

  // ART-006 / GAME-ART-012: trappole e meccanismo leva.
  for (const trap of layout.traps) {
    switch (trap.kind) {
      case 'pressurePlate':
        addPressurePlate(trap);
        break;
      case 'bladePendulum':
        addBladePendulum(trap);
        break;
      case 'dartLauncher':
        addDartLauncher(trap);
        break;
      case 'rollingBoulder':
        addRollingBoulder(trap);
        break;
    }
  }
  if (layout.leverPassage) {
    addLeverPassage(layout.leverPassage);
  }

  if (instancedFloors) {
    instancedFloors.setFloorTiles(floorTiles);
  }

  return cullBounds;
}
