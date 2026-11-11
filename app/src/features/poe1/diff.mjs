import { computeNodeDiff } from "../sharedTree/nodeDiff.mjs";

export function computePoe1Diff(previousTree, nextTree) {
  const toNodeMap = (tree) =>
    new Map(tree.nodeList.map((node) => [node.key, node]));
  return computeNodeDiff(toNodeMap(previousTree), toNodeMap(nextTree));
}
