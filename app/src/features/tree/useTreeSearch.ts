import { useMemo } from "react";
import type { ParsedTree, TreeNode } from "../../types";

export function useTreeSearch(
  tree: ParsedTree | null,
  query: string,
  selectedClass: number | null,
) {
  return useMemo(() => {
    if (!tree || query.trim().length < 1) {
      return { results: [] as TreeNode[], hits: new Set<string>() };
    }

    const normalizedQuery = query.toLowerCase();
    const overrides =
      selectedClass != null ? tree.classOverrides.get(selectedClass) ?? null : null;
    const results: TreeNode[] = [];

    for (const node of tree.nodeList) {
      if (node.kind === "mastery") continue;
      const override = overrides?.get(node.key);
      const name = override?.name ?? node.name;
      const stats = override?.stats ?? node.stats;
      if (!name || name.startsWith("[DNT")) continue;
      if (
        name.toLowerCase().includes(normalizedQuery) ||
        stats.some((stat) => stat.toLowerCase().includes(normalizedQuery))
      ) {
        results.push(node);
      }
    }

    results.sort((a, b) => rank(b.kind) - rank(a.kind));
    return { results, hits: new Set(results.map((node) => node.key)) };
  }, [tree, query, selectedClass]);
}

function rank(kind: TreeNode["kind"]): number {
  if (kind === "keystone") return 4;
  if (kind === "notable" || kind === "ascNotable") return 3;
  if (kind === "jewel") return 2;
  return 1;
}
