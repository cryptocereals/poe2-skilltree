const DEFAULT_MOVE_THRESHOLD = 100;

const isRealName = (name) => Boolean(name) && !name.startsWith("[DNT");
const sameStats = (left, right) =>
  left.length === right.length && left.every((stat, index) => stat === right[index]);

export const DIFF_COLORS = Object.freeze({
  added: "#4ad6a0",
  removed: "#ef5d5d",
  stats: "#f5b740",
  renamed: "#5fd6cd",
  moved: "#6f93ff",
});

/**
 * Compare two games' node maps without converting either game's tree schema.
 * The node maps only need stable keys, names, stats, positions, and node kinds.
 */
export function computeNodeDiff(previousNodes, nextNodes, options = {}) {
  const isMeaningfulName = options.isMeaningfulName ?? isRealName;
  const statsAreEqual = options.statsAreEqual ?? sameStats;
  const moveThreshold = Number.isFinite(options.moveThreshold)
    ? Math.max(0, options.moveThreshold)
    : DEFAULT_MOVE_THRESHOLD;
  const byKey = new Map();
  const removed = [];
  const moved = [];
  const counts = { added: 0, removed: 0, stats: 0, renamed: 0, moved: 0 };

  for (const [key, next] of nextNodes) {
    const previous = previousNodes.get(key);
    if (!previous) {
      if (isMeaningfulName(next.name) || next.stats.length) {
        byKey.set(key, {
          status: "added",
          newName: next.name,
          newStats: next.stats,
        });
        counts.added += 1;
      }
      continue;
    }

    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    if (dx * dx + dy * dy > moveThreshold * moveThreshold) {
      moved.push({
        key,
        name: next.name || previous.name,
        fromX: previous.x,
        fromY: previous.y,
        toX: next.x,
        toY: next.y,
      });
    }

    const previousStats = previous.stats ?? [];
    const nextStats = next.stats ?? [];
    const statsChanged = !statsAreEqual(previousStats, nextStats);
    const nameChanged =
      previous.name !== next.name &&
      isMeaningfulName(previous.name) &&
      isMeaningfulName(next.name);

    if (
      statsChanged &&
      (isMeaningfulName(previous.name) || isMeaningfulName(next.name)) &&
      (previousStats.length > 0 || nextStats.length > 0)
    ) {
      byKey.set(key, {
        status: "stats",
        oldName: previous.name,
        newName: next.name,
        oldStats: previousStats,
        newStats: nextStats,
      });
      counts.stats += 1;
    } else if (nameChanged) {
      byKey.set(key, {
        status: "renamed",
        oldName: previous.name,
        newName: next.name,
      });
      counts.renamed += 1;
    }
  }

  for (const [key, previous] of previousNodes) {
    if (nextNodes.has(key) || !isMeaningfulName(previous.name)) continue;
    const entry = {
      status: "removed",
      oldName: previous.name,
      oldStats: previous.stats ?? [],
      ghost: {
        x: previous.x,
        y: previous.y,
        name: previous.name,
        kind: previous.kind,
      },
    };
    byKey.set(key, entry);
    removed.push(entry);
    counts.removed += 1;
  }

  counts.moved = moved.length;
  return { byKey, removed, moved, counts };
}
