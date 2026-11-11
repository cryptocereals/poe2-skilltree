import { memo, useMemo } from "react";
import TreeStatsPanel from "../../sharedTree/components/TreeStatsPanel";
import { summarizePoe1Allocation } from "../stats/summary.mjs";
import type { Poe1AllocationState } from "../allocation/model.mjs";
import type { ParsedPoe1Tree } from "../types";

interface Props {
  tree: ParsedPoe1Tree;
  allocation: Poe1AllocationState;
}

function Poe1StatsPanel({ tree, allocation }: Props) {
  const summary = useMemo(
    () => summarizePoe1Allocation(tree, allocation),
    [tree, allocation],
  );

  return (
    <TreeStatsPanel
      className="poe1-stats-panel"
      rows={summary.rows}
      verbatimGroups={summary.masteryEffects}
      totalNodes={allocation.mainAlloc.size + allocation.ascAlloc.size}
      description="Numeric base stats are summed. Chosen mastery effects are shown verbatim; conditions and enemy effects are not simulated. Quest rewards and build validity are not modeled."
    />
  );
}

export default memo(Poe1StatsPanel);
