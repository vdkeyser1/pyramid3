/**
 * Scopo: impedire colpi multipli involontari nella stessa fase attiva (§31.2).
 * Ownership: stato di combattimento della simulazione.
 * Invarianti:
 *   - un bersaglio può essere colpito al massimo una volta per swing;
 *   - il registry viene azzerato ad ogni nuova fase ACTIVE.
 */

import type { EntityId } from '@/ecs/EntityAllocator.js';

interface HitRecord {
  readonly attackerId: EntityId;
  readonly attackId: string;
  /** Tick di inizio della fase ACTIVE corrente. */
  readonly activeStartTick: number;
}

export class HitRegistry {
  private readonly hits = new Set<string>();

  private key(attackerId: EntityId, targetId: EntityId, attackId: string, activeStartTick: number): string {
    return `${attackerId}:${targetId}:${attackId}:${activeStartTick}`;
  }

  /** Restituisce true se il colpo è registrato (= prima volta). False se già colpito. */
  register(record: HitRecord, targetId: EntityId): boolean {
    const k = this.key(record.attackerId, targetId, record.attackId, record.activeStartTick);
    if (this.hits.has(k)) return false;
    this.hits.add(k);
    return true;
  }

  /** Azzera tutti i record. Da chiamare ad ogni nuova fase ACTIVE o fine del combattimento. */
  clear(): void {
    this.hits.clear();
  }

  get size(): number {
    return this.hits.size;
  }
}
