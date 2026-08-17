/**
 * Scopo: allocatore di entità con riutilizzo di handle liberate.
 * Ownership: il World ECS possiede l'unica istanza.
 */

export const MAX_ENTITIES = 4096;
export const NULL_ENTITY = 0 as EntityId;

export type EntityId = number & { readonly __brand: 'EntityId' };

export interface EntityAllocator {
  create(): EntityId;
  destroy(id: EntityId): void;
  isAlive(id: EntityId): boolean;
  generation(id: EntityId): number;
  /** Debug overlay (v2): entità attualmente allocate (tracciato incrementale). */
  readonly aliveCount: number;
}

export function createEntityAllocator(): EntityAllocator {
  const generations = new Uint16Array(MAX_ENTITIES);
  const alive = new Uint8Array(MAX_ENTITIES);
  const freeList: number[] = [];
  let nextId = 1;
  let aliveCount = 0;

  generations.fill(1);

  return {
    get aliveCount(): number {
      return aliveCount;
    },

    create(): EntityId {
      const reusedId = freeList.pop();
      const id = reusedId ?? nextId;
      if (id >= MAX_ENTITIES) {
        throw new Error(`EntityAllocator: limite massimo di ${MAX_ENTITIES} entità raggiunto`);
      }
      if (reusedId === undefined) {
        nextId++;
      }
      alive[id] = 1;
      aliveCount++;
      return id as EntityId;
    },

    destroy(id: EntityId): void {
      if (id === NULL_ENTITY) return;
      const idx = id as number;
      if (!alive[idx]) return;
      alive[idx] = 0;
      generations[idx] = (generations[idx] ?? 0) + 1;
      freeList.push(idx);
      aliveCount--;
    },

    isAlive(id: EntityId): boolean {
      if (id === NULL_ENTITY) return false;
      return (alive[id as number] ?? 0) === 1;
    },

    generation(id: EntityId): number {
      if (id === NULL_ENTITY) return 0;
      return generations[id as number] ?? 0;
    },
  };
}
