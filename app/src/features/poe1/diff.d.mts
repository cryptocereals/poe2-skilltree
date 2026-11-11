import type { ParsedPoe1Tree, Poe1NodeKind } from "./types";
import type { TreeVersionDiff } from "../sharedTree/nodeDiff.mjs";

export function computePoe1Diff(
  previousTree: ParsedPoe1Tree,
  nextTree: ParsedPoe1Tree,
): TreeVersionDiff<Poe1NodeKind>;
