export type Adjacency = Map<string, string[]>;
export type TreeEdgeKey = { fromKey: string; toKey: string };

export function createAdjacency(
  nodeKeys: Iterable<string>,
  edges: Iterable<TreeEdgeKey>,
): Adjacency;

export function reach(
  adjacency: Adjacency,
  start: string,
  allowed: (key: string) => boolean,
): Set<string>;

export function pathFrom(
  adjacency: Adjacency,
  sources: Set<string>,
  target: string,
  canTraverse: (key: string) => boolean,
): string[] | null;

export function prunedSet(
  adjacency: Adjacency,
  set: Set<string>,
  start: string,
): Set<string>;
