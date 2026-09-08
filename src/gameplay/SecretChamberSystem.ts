/**
 * Scopo: SecretChamberSystem — logica archeologica dei varchi e delle cripte segrete sotto i monumenti.
 *        Rileva indizi sensoriali, richiede crouch / interazione e sblocca la discesa a gradini.
 * Ownership: gameplay (deterministico e data-driven).
 */

import { hash32 } from '@/procedural/Hash32.js';

export type SecretChamberType =
  | 'STATUE_UNDERPASS'
  | 'SARCOPHAGUS_CRAWLWAY'
  | 'FALSE_DOOR_RECESS'
  | 'ALTAR_DROP';

export interface SecretChamber {
  readonly id: string;
  readonly roomId: number;
  readonly type: SecretChamberType;
  readonly monumentName: string;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly clueText: string;
  readonly secretDescription: string;
  readonly rewardGold: number;
  readonly rewardRelicId?: string;
  isDiscovered: boolean;
  isOpen: boolean;
  isLooted: boolean;
}

export class SecretChamberSystem {
  private _chambers: SecretChamber[] = [];

  public generateForFloor(
    seed: number,
    floorIndex: number,
    rooms: readonly { readonly roomId: number; readonly center: { readonly x: number; readonly z: number } }[],
  ): readonly SecretChamber[] {
    this._chambers = [];
    const secretCount = Math.min(5, Math.max(1, Math.floor(rooms.length / 3)));

    for (let i = 0; i < secretCount; i++) {
      const room = rooms[(i * 3 + 1) % rooms.length];
      if (!room) continue;

      const h = hash32(seed * 419 + floorIndex * 97 + i * 23, 0x9b31);
      const chamberType: SecretChamberType = (['STATUE_UNDERPASS', 'SARCOPHAGUS_CRAWLWAY', 'FALSE_DOOR_RECESS'] as const)[h % 3] ?? 'STATUE_UNDERPASS';

      let monumentName = 'Statua Monumentale di Horus';
      let clueText = 'Una scia di pulviscolo dorato filtra da sotto il basamento di pietra.';
      let secretDescription = 'Accovacciati per strisciare sotto il colosso ed entrare nella cripta segreta.';

      if (chamberType === 'SARCOPHAGUS_CRAWLWAY') {
        monumentName = 'Grande Sarcofago di Basalto';
        clueText = 'Colpendo la cassa funeraria risuona un eco profonda di vuoto sotterraneo.';
        secretDescription = 'Il fondo del sarcofago è scivolato, rivelando una scala a gradini in discesa.';
      } else if (chamberType === 'FALSE_DOOR_RECESS') {
        monumentName = 'Falsa Porta con Cartiglio Reale';
        clueText = 'I geroglifici sulla cornice indicano un perno nascosto nella pietra.';
        secretDescription = 'La lastra monolitica si è aperta verso l interno su una camera nascosta.';
      }

      const chamberEntry: SecretChamber = {
        id: `secret_floor_${floorIndex}_room_${room.roomId}_${i}`,
        roomId: room.roomId,
        type: chamberType,
        monumentName,
        position: { x: room.center.x, y: 0, z: room.center.z },
        clueText,
        secretDescription,
        rewardGold: 60 + (h % 90),
        ...(h % 2 === 0 ? { rewardRelicId: 'GOLDEN_SCARAB_AMULET' } : {}),
        isDiscovered: false,
        isOpen: false,
        isLooted: false,
      };

      this._chambers.push(chamberEntry);
    }

    return this._chambers;
  }

  public findNearbySecret(
    playerPos: { readonly x: number; readonly z: number },
    maxDistanceM = 2.5,
  ): SecretChamber | null {
    for (const chamber of this._chambers) {
      const dist = Math.hypot(chamber.position.x - playerPos.x, chamber.position.z - playerPos.z);
      if (dist <= maxDistanceM) {
        return chamber;
      }
    }
    return null;
  }

  public discoverSecret(chamberId: string): SecretChamber | null {
    const chamber = this._chambers.find((c) => c.id === chamberId);
    if (!chamber) return null;
    chamber.isDiscovered = true;
    chamber.isOpen = true;
    return chamber;
  }

  public get chambers(): readonly SecretChamber[] {
    return this._chambers;
  }
}
