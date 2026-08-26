/**
 * G-31 — RoomStreamingManager.
 *
 * Scopo: tenere caricate solo le stanze entro MAX_HOP dal player (BFS sul
 *        grafo di adiacenza). Oltre la soglia le mesh vengono nascoste e,
 *        se si supera MAX_LOADED, dispose() delle geometrie uniche.
 * Ownership: dungeon. Il renderer applica il set `needed` ai Group stanza.
 * Invarianti:
 *   - BFS non visita oltre maxHops;
 *   - la stanza corrente è sempre in `needed`;
 *   - dispose è best-effort: InstancedMesh condivisi restano al piano.
 */

export interface StreamedRoomHandle {
  readonly id: string;
  setVisible(visible: boolean): void;
  dispose(): void;
}

export interface RoomStreamingOptions {
  readonly maxHop: number;
  readonly maxLoaded: number;
}

export interface RoomStreamingResult {
  readonly needed: ReadonlySet<string>;
  readonly unloaded: readonly string[];
  readonly loadedCount: number;
}

const DEFAULTS: RoomStreamingOptions = { maxHop: 3, maxLoaded: 12 };

export class RoomStreamingManager {
  private readonly loaded = new Map<string, StreamedRoomHandle>();
  private readonly maxHop: number;
  private readonly maxLoaded: number;

  constructor(options: Partial<RoomStreamingOptions> = {}) {
    this.maxHop = options.maxHop ?? DEFAULTS.maxHop;
    this.maxLoaded = options.maxLoaded ?? DEFAULTS.maxLoaded;
  }

  get loadedCount(): number {
    return this.loaded.size;
  }

  register(handle: StreamedRoomHandle): void {
    this.loaded.set(handle.id, handle);
  }

  clear(): void {
    for (const handle of this.loaded.values()) {
      handle.dispose();
    }
    this.loaded.clear();
  }

  /**
   * Aggiorna visibilità: mostra le stanze entro hop, nasconde le altre.
   * Se loaded > maxLoaded, dispose delle più lontane (già fuori needed).
   */
  onPlayerEnterRoom(
    currentId: string,
    graph: ReadonlyMap<string, readonly string[]>,
  ): RoomStreamingResult {
    const needed = bfsHops(currentId, graph, this.maxHop);
    const unloaded: string[] = [];

    for (const [id, handle] of this.loaded) {
      const keep = needed.has(id);
      handle.setVisible(keep);
      if (!keep) {
        unloaded.push(id);
      }
    }

    if (this.loaded.size > this.maxLoaded) {
      const extra = [...this.loaded.entries()]
        .filter(([id]) => !needed.has(id))
        .slice(0, this.loaded.size - this.maxLoaded);
      for (const [id, handle] of extra) {
        handle.setVisible(false);
        handle.dispose();
        this.loaded.delete(id);
      }
    }

    return { needed, unloaded, loadedCount: this.loaded.size };
  }
}

export function bfsHops(
  start: string,
  graph: ReadonlyMap<string, readonly string[]>,
  maxHops: number,
): Set<string> {
  const visited = new Set<string>([start]);
  const queue: [string, number][] = [[start, 0]];
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    const [id, hop] = item;
    if (hop >= maxHops) continue;
    for (const neighbor of graph.get(id) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, hop + 1]);
      }
    }
  }
  return visited;
}

/** Grafo stanza → vicini da corridoi (from/to). */
export function adjacencyFromCorridors(
  roomIds: readonly string[],
  corridors: readonly { readonly fromRoomId: string | number; readonly toRoomId: string | number }[],
): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const id of roomIds) {
    graph.set(id, []);
  }
  for (const c of corridors) {
    const a = String(c.fromRoomId);
    const b = String(c.toRoomId);
    if (!graph.has(a)) graph.set(a, []);
    if (!graph.has(b)) graph.set(b, []);
    graph.get(a)?.push(b);
    graph.get(b)?.push(a);
  }
  return graph;
}
