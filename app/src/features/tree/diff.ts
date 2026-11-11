import type { ParsedTree, VersionDiff } from "../../types";
import { cleanStat } from "../../lib/text";
import {
  computeNodeDiff,
  DIFF_COLORS,
} from "../sharedTree/nodeDiff.mjs";

const isReal = (name: string) => !!name && !name.startsWith("[DNT");
const sameStats = (left: string[], right: string[]) =>
  left.length === right.length &&
  left.every((stat, index) => cleanStat(stat) === cleanStat(right[index]));

export { DIFF_COLORS };

/**
 * Compare the shared node properties, then account for PoE2's class-specific
 * start-node overrides. PoE1 uses the same semantic engine without adopting
 * PoE2's parsed tree schema.
 */
export function computeDiff(prev: ParsedTree, next: ParsedTree): VersionDiff {
  const result = computeNodeDiff(prev.nodes, next.nodes, {
    isMeaningfulName: isReal,
    statsAreEqual: sameStats,
  });
  const { byKey, counts } = result;

  const classIdx = new Set<number>([
    ...prev.classOverrides.keys(),
    ...next.classOverrides.keys(),
  ]);
  for (const classIndex of classIdx) {
    const previousOverrides = prev.classOverrides.get(classIndex);
    const nextOverrides = next.classOverrides.get(classIndex);
    const keys = new Set<string>([
      ...(previousOverrides ? previousOverrides.keys() : []),
      ...(nextOverrides ? nextOverrides.keys() : []),
    ]);

    for (const key of keys) {
      if (byKey.has(key)) continue;
      const previous = previousOverrides?.get(key);
      const nextOverride = nextOverrides?.get(key);
      const oldName = previous?.name ?? "";
      const newName = nextOverride?.name ?? "";
      const oldStats = previous?.stats ?? [];
      const newStats = nextOverride?.stats ?? [];
      const statsChanged = !sameStats(oldStats, newStats);
      if (!statsChanged && oldName === newName) continue;

      if (statsChanged) {
        byKey.set(key, {
          status: "stats",
          oldName,
          newName,
          oldStats,
          newStats,
        });
        counts.stats += 1;
      } else {
        byKey.set(key, { status: "renamed", oldName, newName });
        counts.renamed += 1;
      }
    }
  }

  return {
    byKey,
    removed: result.removed,
    moved: result.moved,
    counts,
  };
}
