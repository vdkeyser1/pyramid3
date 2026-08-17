import { describe, expect, it } from 'vitest';
import { createEntityAllocator } from '@/ecs/EntityAllocator.js';

describe('EntityAllocator', () => {
  it('riusa gli id liberati senza saltare il prossimo id disponibile', () => {
    const allocator = createEntityAllocator();

    const first = allocator.create();
    const second = allocator.create();
    allocator.destroy(first);

    const reused = allocator.create();
    const next = allocator.create();

    expect(second).toBe(2);
    expect(reused).toBe(first);
    expect(next).toBe(3);
  });

  it('incrementa la generation quando un id viene distrutto e riusato', () => {
    const allocator = createEntityAllocator();

    const entity = allocator.create();
    const firstGeneration = allocator.generation(entity);
    allocator.destroy(entity);
    const reused = allocator.create();

    expect(reused).toBe(entity);
    expect(allocator.generation(reused)).toBe(firstGeneration + 1);
  });
});
