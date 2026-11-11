import type {
  ParsedPoe1Tree,
  Poe1MasteryEffect,
  Poe1TreeNode,
} from "../types";
import type { Poe1AllocationState } from "../allocation/model.mjs";
import type { TreeStatRow } from "../../sharedTree/stats/aggregateTreeStats.mjs";

export interface Poe1EffectiveTreeNode extends Poe1TreeNode {
  selectedMasteryEffect?: Poe1MasteryEffect;
}

export interface Poe1MasteryEffectSummary {
  key: string;
  name: string;
  effectId: number;
  stats: string[];
  reminderText: string[];
}

export interface Poe1AllocationSummary {
  rows: TreeStatRow[];
  masteryEffects: Poe1MasteryEffectSummary[];
}

export function getPoe1EffectiveNode(
  node: Poe1TreeNode,
  effectId: number | null | undefined,
): Poe1EffectiveTreeNode;
export function summarizePoe1Allocation(
  tree: ParsedPoe1Tree,
  state: Poe1AllocationState,
): Poe1AllocationSummary;
