import type { ParsedPoe1Tree, Poe1TreeNode } from "../types";
import type { Poe1AllocationState } from "./model.mjs";

export function classStartKeys(tree: ParsedPoe1Tree): Set<string>;
export function isMainPathNode(
  tree: ParsedPoe1Tree,
  node: Poe1TreeNode | null | undefined,
  starts: ReadonlySet<string>,
): boolean;
export function reachableMainAllocations(
  tree: ParsedPoe1Tree,
  state: Poe1AllocationState,
): Set<string>;
export function canUnlockPoe1Mastery(
  tree: ParsedPoe1Tree,
  state: Poe1AllocationState,
  nodeKey: string,
): boolean;
export function canChoosePoe1MasteryEffect(
  tree: ParsedPoe1Tree,
  state: Poe1AllocationState,
  nodeKey: string,
  effectId: number,
): boolean;
export function getPoe1MasteryEffect(
  node: Poe1TreeNode | null | undefined,
  effectId: number | null | undefined,
): Poe1TreeNode["masteryEffects"][number] | null;
export function normalizeMainAllocation(
  tree: ParsedPoe1Tree,
  state: Poe1AllocationState,
  candidateKeys: Iterable<string>,
  candidateChoices?: Map<string, number>,
): Poe1AllocationState;
export function choosePoe1MasteryEffect(
  tree: ParsedPoe1Tree,
  state: Poe1AllocationState,
  nodeKey: string,
  effectId: number,
): Poe1AllocationState;
export function clearPoe1MasteryChoice(
  tree: ParsedPoe1Tree,
  state: Poe1AllocationState,
  nodeKey: string,
): Poe1AllocationState;
export function removePoe1Mastery(
  tree: ParsedPoe1Tree,
  state: Poe1AllocationState,
  nodeKey: string,
): Poe1AllocationState;
