import type { Poe1TreeNode } from "../types";

export function nodeKindLabel(node: Poe1TreeNode): string {
  if (node.kind === "keystone") return "Keystone";
  if (node.kind === "notable") return "Notable";
  if (node.kind === "mastery") return "Mastery";
  if (node.kind === "jewel") return "Jewel socket";
  if (node.kind === "ascendancyStart") return "Ascendancy start";
  return "Passive";
}
