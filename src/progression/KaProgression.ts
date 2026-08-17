/**
 * Scopo: sistema di progressione persistente (Frammenti di Ka, altare, bestiario).
 * Ownership: pura. Chiamato alla morte e all'hub.
 */

import type { SaveData } from '@/progression/SaveManager.js';

export interface KaNode {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  readonly maxLevel: number;
}

export const KA_TREE: readonly KaNode[] = [
  {
    id: 'respiro-lungo',
    name: 'Respiro Lungo',
    description: '+10% combustibile torcia per livello',
    cost: 10,
    maxLevel: 3,
  },
  {
    id: 'ka-robusto',
    name: 'Ka Robusto',
    description: '+10 HP massimi per livello',
    cost: 15,
    maxLevel: 3,
  },
  {
    id: 'mano-ferma',
    name: 'Mano Ferma',
    description: 'Inizi ogni run con un bastone',
    cost: 30,
    maxLevel: 1,
  },
  {
    id: 'occhio-del-ladro',
    name: 'Occhio del Ladro',
    description: 'Tell visivo sui sarcofagi pericolosi (fessura scura)',
    cost: 45,
    maxLevel: 1,
  },
  {
    id: 'passo-di-bastet',
    name: 'Passo di Bastet',
    description: '0.12s i-frame nella parte centrale della schivata',
    cost: 60,
    maxLevel: 1,
  },
  {
    id: 'memoria-di-thoth',
    name: 'Memoria di Thoth',
    description: 'Mappa garantita nella prima metà del piano',
    cost: 80,
    maxLevel: 1,
  },
  {
    id: 'patto-di-anubi',
    name: 'Patto di Anubi',
    description: 'Una resurrezione per run, al 30% HP',
    cost: 120,
    maxLevel: 1,
  },
  {
    id: 'sangue-di-ra',
    name: 'Sangue di Ra',
    description: 'Una maledizione può essere deposta per piano',
    cost: 200,
    maxLevel: 1,
  },
] as const;

export interface ProgressionState {
  readonly fragments: number;
  readonly purchasedNodes: Readonly<Record<string, number>>;
  readonly bestiary: readonly string[];
  readonly discoveredGrafts: readonly string[];
}

export interface KaPurchaseResult {
  readonly save: SaveData;
  readonly changed: boolean;
  readonly purchasedNodeId: string | null;
  readonly spentFragments: number;
  readonly newLevel: number;
}

function buildPurchasedNodeIndex(kaNodes: readonly string[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const nodeId of kaNodes) {
    counts[nodeId] = (counts[nodeId] ?? 0) + 1;
  }
  return counts;
}

export function getProgressionState(save: SaveData): ProgressionState {
  return {
    fragments: save.payload.fragments,
    purchasedNodes: buildPurchasedNodeIndex(save.payload.kaNodes),
    bestiary: save.payload.bestiaryEntries,
    discoveredGrafts: save.payload.discoveredGrafts,
  };
}

export function canPurchase(
  state: ProgressionState,
  nodeId: string,
): boolean {
  const node = KA_TREE.find((n) => n.id === nodeId);
  if (!node) return false;
  const currentLevel = state.purchasedNodes[nodeId] ?? 0;
  if (currentLevel >= node.maxLevel) return false;
  return state.fragments >= node.cost;
}

export function getNodeLevel(nodeId: string, state: ProgressionState): number {
  return state.purchasedNodes[nodeId] ?? 0;
}

export function purchaseKaNode(save: SaveData, nodeId: string): KaPurchaseResult {
  const state = getProgressionState(save);
  if (!canPurchase(state, nodeId)) {
    return {
      save,
      changed: false,
      purchasedNodeId: null,
      spentFragments: 0,
      newLevel: getNodeLevel(nodeId, state),
    };
  }

  const node = KA_TREE.find((entry) => entry.id === nodeId);
  if (!node) {
    return {
      save,
      changed: false,
      purchasedNodeId: null,
      spentFragments: 0,
      newLevel: 0,
    };
  }

  const nextSave: SaveData = {
    ...save,
    payload: {
      ...save.payload,
      fragments: save.payload.fragments - node.cost,
      kaNodes: [...save.payload.kaNodes, node.id],
    },
  };
  const nextState = getProgressionState(nextSave);

  return {
    save: nextSave,
    changed: true,
    purchasedNodeId: node.id,
    spentFragments: node.cost,
    newLevel: getNodeLevel(node.id, nextState),
  };
}

/**
 * Calcola la power band del giocatore per il director.
 * Vedi GDD §11.3 — anti-power-creep.
 */
export function computePowerBand(purchasedNodeCount: number): number {
  if (purchasedNodeCount <= 2) return 0;
  if (purchasedNodeCount <= 5) return 1;
  if (purchasedNodeCount <= 8) return 2;
  return 3;
}

export function computeExtraBudgetFactor(purchasedNodeCount: number): number {
  const band = computePowerBand(purchasedNodeCount);
  const factors = [0.0, 0.15, 0.3, 0.45];
  return factors[band] ?? 0.0;
}
