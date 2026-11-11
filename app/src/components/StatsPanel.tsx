import { memo, useMemo } from "react";
import { aggregateTreeStats } from "../features/sharedTree/stats/aggregateTreeStats.mjs";
import TreeStatsPanel from "../features/sharedTree/components/TreeStatsPanel";
import type { ParsedTree } from "../types";
import type { Tag } from "../lib/buildState";

interface Props {
  tree: ParsedTree;
  alloc: Map<string, Tag>;
  ascAlloc: Set<string>;
  selectedClass: number | null;
}

function StatsPanelInner({ tree, alloc, ascAlloc, selectedClass }: Props) {
  const classOverrides =
    selectedClass == null
      ? null
      : tree.classOverrides.get(selectedClass) ?? null;
  const rows = useMemo(
    () =>
      aggregateTreeStats(
        tree.nodes,
        [...alloc.keys(), ...ascAlloc],
        classOverrides,
      ),
    [tree, alloc, ascAlloc, classOverrides],
  );

  return (
    <TreeStatsPanel
      rows={rows}
      totalNodes={alloc.size + ascAlloc.size}
    />
  );
}

export default memo(StatsPanelInner);
