import * as THREE from 'three';
import { resolveLandmarkPlaceholder } from '@/content/LandmarkPlaceholders.js';
import type { RoomBounds as CullBounds } from '@/rendering/FrustumCuller.js';
import type {
  FloorSceneCorridor,
  FloorSceneLandmark,
  FloorSceneLayout,
  FloorSceneRoom,
} from '@/world/FloorSceneLayout.js';

const FLOOR_THICKNESS_M = 0.2;
const WALL_HEIGHT_M = 4.5;
const WALL_THICKNESS_M = 0.45;
const DOOR_WIDTH_M = 2.8;

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
}

export function buildDungeonLayout(options: BuildDungeonLayoutOptions): CullBounds[] {
  const { layout, dungeonRoot, floorMaterial, wallMaterial, createStaticBox, glyphEmissiveMap } = options;

  // R-03: active room group — geometry goes here instead of dungeonRoot during
  // addRoom / addCorridor so the FrustumCuller can cull per-room.
  let _roomGroup: THREE.Group | null = null;

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
    addDungeonBox(
      width,
      FLOOR_THICKNESS_M,
      depth,
      room.center.x,
      -FLOOR_THICKNESS_M / 2,
      room.center.z,
      floorMaterial,
    );
    createStaticBox(
      room.center.x,
      -FLOOR_THICKNESS_M / 2,
      room.center.z,
      width / 2,
      FLOOR_THICKNESS_M / 2,
      depth / 2,
    );

    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const wallY = WALL_HEIGHT_M / 2;
    const openings = new Set(room.openings);

    addDirectionalWall('north', room.center.x, room.center.z, halfWidth, halfDepth, wallY, openings.has('north'));
    addDirectionalWall('south', room.center.x, room.center.z, halfWidth, halfDepth, wallY, openings.has('south'));
    addDirectionalWall('east', room.center.x, room.center.z, halfWidth, halfDepth, wallY, openings.has('east'));
    addDirectionalWall('west', room.center.x, room.center.z, halfWidth, halfDepth, wallY, openings.has('west'));
  }

  function addCorridor(corridor: FloorSceneCorridor): void {
    const width = corridor.bounds.maxX - corridor.bounds.minX;
    const depth = corridor.bounds.maxZ - corridor.bounds.minZ;
    const centerX = (corridor.bounds.minX + corridor.bounds.maxX) / 2;
    const centerZ = (corridor.bounds.minZ + corridor.bounds.maxZ) / 2;
    const wallY = WALL_HEIGHT_M / 2;

    addDungeonBox(width, FLOOR_THICKNESS_M, depth, centerX, -FLOOR_THICKNESS_M / 2, centerZ, floorMaterial);
    createStaticBox(centerX, -FLOOR_THICKNESS_M / 2, centerZ, width / 2, FLOOR_THICKNESS_M / 2, depth / 2);

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

  return cullBounds;
}
