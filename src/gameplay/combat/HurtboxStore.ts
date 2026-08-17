/**
 * Scopo: storage SoA per le hurtbox dei nemici (§31.2).
 * Ownership: simulazione. Layer separati per hurtbox e mondo.
 * Invarianti:
 *   - le hurtbox non sono mesh visive;
 *   - i dati sono packed per iterazione lineare.
 */

import type { EntityId } from '@/ecs/EntityAllocator.js';

export interface HurtboxEntry {
  readonly entityId: EntityId;
  readonly centerX: number;
  readonly centerY: number;
  readonly centerZ: number;
  readonly radiusM: number;
  readonly heightM: number;
}

export class HurtboxStore {
  private readonly entries: HurtboxEntry[] = [];

  add(entry: HurtboxEntry): void {
    this.entries.push(entry);
  }

  remove(entityId: EntityId): void {
    const idx = this.entries.findIndex((e) => e.entityId === entityId);
    if (idx >= 0) this.entries.splice(idx, 1);
  }

  update(entityId: EntityId, centerX: number, centerY: number, centerZ: number): void {
    const entry = this.entries.find((e) => e.entityId === entityId);
    if (entry === undefined) return;
    // Mutable update per performance (hot path nel fixed step)
    (entry as { centerX: number }).centerX = centerX;
    (entry as { centerY: number }).centerY = centerY;
    (entry as { centerZ: number }).centerZ = centerZ;
  }

  getAll(): readonly HurtboxEntry[] {
    return this.entries;
  }

  getByEntity(entityId: EntityId): HurtboxEntry | undefined {
    return this.entries.find((e) => e.entityId === entityId);
  }

  clear(): void {
    this.entries.length = 0;
  }

  get count(): number {
    return this.entries.length;
  }
}
