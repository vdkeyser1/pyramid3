import { describe, expect, it } from 'vitest';
import {
  RoomStreamingManager,
  adjacencyFromCorridors,
  bfsHops,
} from '@/dungeon/RoomStreamingManager.js';

describe('RoomStreamingManager (G-31)', () => {
  const graph = adjacencyFromCorridors(
    ['a', 'b', 'c', 'd', 'e'],
    [
      { fromRoomId: 'a', toRoomId: 'b' },
      { fromRoomId: 'b', toRoomId: 'c' },
      { fromRoomId: 'c', toRoomId: 'd' },
      { fromRoomId: 'd', toRoomId: 'e' },
    ],
  );

  it('BFS include la stanza corrente e i vicini entro hop', () => {
    const hops0 = bfsHops('a', graph, 0);
    expect([...hops0]).toEqual(['a']);

    const hops1 = bfsHops('a', graph, 1);
    expect(hops1.has('a')).toBe(true);
    expect(hops1.has('b')).toBe(true);
    expect(hops1.has('c')).toBe(false);
  });

  it('nasconde le stanze oltre MAX_HOP', () => {
    const visible = new Map<string, boolean>();
    const manager = new RoomStreamingManager({ maxHop: 2, maxLoaded: 12 });
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      manager.register({
        id,
        setVisible(v) { visible.set(id, v); },
        dispose() { visible.delete(id); },
      });
    }
    const result = manager.onPlayerEnterRoom('a', graph);
    expect(result.needed.has('a')).toBe(true);
    expect(result.needed.has('c')).toBe(true);
    expect(result.needed.has('d')).toBe(false);
    expect(visible.get('a')).toBe(true);
    expect(visible.get('d')).toBe(false);
  });
});
