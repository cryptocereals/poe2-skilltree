export type TreeDiffStatus = "added" | "removed" | "stats" | "renamed" | "moved";

export interface ComparableTreeNode<Kind extends string = string> {
  key: string;
  name: string;
  stats: string[];
  x: number;
  y: number;
  kind: Kind;
}

export interface TreeDiffEntry<Kind extends string = string> {
  status: TreeDiffStatus;
  oldName?: string;
  newName?: string;
  oldStats?: string[];
  newStats?: string[];
  ghost?: { x: number; y: number; name: string; kind: Kind };
}

export interface TreeMovedEntry {
  key: string;
  name: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface TreeVersionDiff<Kind extends string = string> {
  byKey: Map<string, TreeDiffEntry<Kind>>;
  removed: TreeDiffEntry<Kind>[];
  moved: TreeMovedEntry[];
  counts: { added: number; removed: number; stats: number; renamed: number; moved: number };
}

export interface NodeDiffOptions {
  isMeaningfulName?: (name: string) => boolean;
  statsAreEqual?: (left: string[], right: string[]) => boolean;
  moveThreshold?: number;
}

export function computeNodeDiff<Kind extends string>(
  previousNodes: ReadonlyMap<string, ComparableTreeNode<Kind>>,
  nextNodes: ReadonlyMap<string, ComparableTreeNode<Kind>>,
  options?: NodeDiffOptions,
): TreeVersionDiff<Kind>;

export const DIFF_COLORS: Readonly<Record<TreeDiffStatus, string>>;
