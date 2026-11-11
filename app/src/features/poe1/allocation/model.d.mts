import type {
  ParsedPoe1Tree,
  Poe1MasteryEffect,
  Poe1TreeNode,
} from "../types";

export interface Poe1AllocationState {
  datasetId: string;
  selectedClass: number | null;
  selectedAscendancyId: string | null;
  mainAlloc: Set<string>;
  ascAlloc: Set<string>;
  masteryChoices: Map<string, number>;
}

export interface Poe1AllocationPreview {
  keys: string[];
  layer: "main" | "ascendancy";
}

export function createPoe1AllocationState(
  datasetId?: string,
): Poe1AllocationState;
export function changePoe1Dataset(
  state: Poe1AllocationState,
  datasetId: string,
): Poe1AllocationState;
export function selectPoe1Class(
  state: Poe1AllocationState,
  classIndex: number | null,
): Poe1AllocationState;
export function selectPoe1Ascendancy(
  state: Poe1AllocationState,
  ascendancyId: string | null,
  tree: ParsedPoe1Tree,
): Poe1AllocationState;
export function clearPoe1Allocation(
  state: Poe1AllocationState,
): Poe1AllocationState;
export function previewPoe1Allocation(
  tree: ParsedPoe1Tree,
  state: Poe1AllocationState,
  node: Poe1TreeNode | null,
): Poe1AllocationPreview | null;
export function clickPoe1Node(
  tree: ParsedPoe1Tree,
  state: Poe1AllocationState,
  node: Poe1TreeNode | null,
): Poe1AllocationState;
export function getPoe1MasteryEffect(
  node: Poe1TreeNode | null | undefined,
  effectId: number | null | undefined,
): Poe1MasteryEffect | null;
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
export function reconcilePoe1Allocation(
  tree: ParsedPoe1Tree,
  state: Poe1AllocationState,
): Poe1AllocationState;
export function getPoe1ActiveNodeKeys(
  tree: ParsedPoe1Tree | null,
  state: Poe1AllocationState,
): Set<string>;
export function getPoe1AllocationCounts(
  state: Poe1AllocationState,
): { main: number; ascendancy: number; total: number };
