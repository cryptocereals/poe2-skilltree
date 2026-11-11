function edgeKey(left, right) {
  return left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
}

/** Build an undirected adjacency map from an allowed node set and edge list. */
export function createAdjacency(nodeKeys, edges) {
  const adjacency = new Map();
  for (const key of nodeKeys) {
    if (typeof key === "string" && !adjacency.has(key)) {
      adjacency.set(key, []);
    }
  }

  const seen = new Set();
  for (const edge of edges ?? []) {
    const from = edge?.fromKey;
    const to = edge?.toKey;
    if (
      typeof from !== "string" ||
      typeof to !== "string" ||
      from === to ||
      !adjacency.has(from) ||
      !adjacency.has(to)
    ) {
      continue;
    }

    const signature = edgeKey(from, to);
    if (seen.has(signature)) continue;
    seen.add(signature);
    adjacency.get(from).push(to);
    adjacency.get(to).push(from);
  }

  return adjacency;
}

/** All nodes reachable from `start` over edges where `allowed(neighbour)` holds. */
export function reach(adjacency, start, allowed) {
  const seen = new Set([start]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    for (const neighbour of adjacency.get(queue[index]) ?? []) {
      if (!seen.has(neighbour) && allowed(neighbour)) {
        seen.add(neighbour);
        queue.push(neighbour);
      }
    }
  }
  return seen;
}

/**
 * Shortest path from any source to `target`, traversing only allowed nodes.
 * The returned path excludes existing sources and includes the target.
 */
export function pathFrom(adjacency, sources, target, canTraverse) {
  if (sources.has(target)) return [];

  const parent = new Map();
  const queue = [];
  for (const source of sources) {
    parent.set(source, null);
    queue.push(source);
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    if (current === target) break;

    for (const neighbour of adjacency.get(current) ?? []) {
      if (parent.has(neighbour)) continue;
      if (neighbour !== target && !canTraverse(neighbour)) continue;
      parent.set(neighbour, current);
      queue.push(neighbour);
    }
  }

  if (!parent.has(target)) return null;

  const path = [];
  let current = target;
  while (current != null && !sources.has(current)) {
    path.push(current);
    current = parent.get(current) ?? null;
  }
  path.reverse();
  return path;
}

/** Keep only members still connected to `start` through the allocated set. */
export function prunedSet(adjacency, set, start) {
  const connected = reach(adjacency, start, (key) => set.has(key));
  const result = new Set();
  for (const key of set) {
    if (connected.has(key)) result.add(key);
  }
  return result;
}
