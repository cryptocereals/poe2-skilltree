export interface TreeStatNode {
  stats: readonly string[];
}

export interface TreeStatOverride {
  stats: readonly string[];
}

export interface TreeStatRow {
  template: string;
  total: number;
  count: number;
  isPct: boolean;
}

export function aggregateTreeStats(
  nodes: ReadonlyMap<string, TreeStatNode>,
  keys: Iterable<string>,
  overrides?: ReadonlyMap<string, TreeStatOverride> | null,
): TreeStatRow[];
