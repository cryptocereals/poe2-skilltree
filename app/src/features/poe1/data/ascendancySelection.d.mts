import type { ParsedPoe1Tree, Poe1TreeNode } from "../types";

export function findPoe1AscendancyStart(
  tree: ParsedPoe1Tree,
  classIndex: number,
  ascendancyId: string,
): Poe1TreeNode | null;

export function identifyPoe1Ascendancy(
  tree: ParsedPoe1Tree,
  node: Poe1TreeNode | null | undefined,
): { classIndex: number; ascendancyId: string } | null;
