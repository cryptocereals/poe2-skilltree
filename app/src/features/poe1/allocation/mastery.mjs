import { reach } from "../../sharedTree/allocation/graph.mjs";

export function classStartKeys(tree) {
  return new Set(
    [...(tree.classStart?.values() ?? [])].map((node) => node.key),
  );
}

export function isMainPathNode(tree, node, starts) {
  return Boolean(
    node &&
      tree.nodes.has(node.key) &&
      !node.isProxy &&
      node.kind !== "mastery" &&
      node.kind !== "ascendancyStart" &&
      !node.ascendancyName &&
      !starts.has(node.key),
  );
}

function masteryEffects(node) {
  return Array.isArray(node?.masteryEffects)
    ? node.masteryEffects.filter(
        (effect) =>
          effect &&
          Number.isSafeInteger(effect.effect) &&
          effect.effect > 0,
      )
    : [];
}

export function getPoe1MasteryEffect(node, effectId) {
  if (!Number.isSafeInteger(effectId) || effectId <= 0) return null;
  return masteryEffects(node).find((effect) => effect.effect === effectId) ?? null;
}

export function reachableMainAllocations(tree, state) {
  if (state.selectedClass == null) return new Set();
  const start = tree.classStart?.get(state.selectedClass);
  if (!start) return new Set();

  const starts = classStartKeys(tree);
  const candidates = new Set(
    [...(state.mainAlloc ?? [])].filter((key) =>
      isMainPathNode(tree, tree.nodes.get(key), starts),
    ),
  );
  const connected = reach(tree.adjacency, start.key, (key) =>
    candidates.has(key),
  );
  return new Set([...connected].filter((key) => candidates.has(key)));
}

function hasAllocatedClusterNotable(tree, mastery, connectedNodes) {
  if (
    mastery?.kind !== "mastery" ||
    mastery.isProxy ||
    mastery.ascendancyName ||
    typeof mastery.groupKey !== "string"
  ) {
    return false;
  }

  return tree.nodeList.some(
    (node) =>
      node.kind === "notable" &&
      !node.isProxy &&
      !node.ascendancyName &&
      node.groupKey === mastery.groupKey &&
      connectedNodes.has(node.key),
  );
}

export function canUnlockPoe1Mastery(tree, state, nodeKey) {
  if (
    !tree ||
    !state ||
    (typeof tree.datasetId === "string" &&
      state.datasetId !== tree.datasetId) ||
    state.selectedClass == null ||
    !tree.classStart?.has(state.selectedClass)
  ) {
    return false;
  }
  const mastery = tree.nodes.get(nodeKey);
  if (!mastery || masteryEffects(mastery).length === 0) return false;
  return hasAllocatedClusterNotable(
    tree,
    mastery,
    reachableMainAllocations(tree, state),
  );
}

export function canChoosePoe1MasteryEffect(tree, state, nodeKey, effectId) {
  if (
    !canUnlockPoe1Mastery(tree, state, nodeKey) ||
    !getPoe1MasteryEffect(tree.nodes.get(nodeKey), effectId)
  ) {
    return false;
  }

  for (const [otherKey, otherEffectId] of state.masteryChoices ?? []) {
    if (otherKey !== nodeKey && otherEffectId === effectId) return false;
  }
  return true;
}

export function normalizeMainAllocation(
  tree,
  state,
  candidateKeys,
  candidateChoices = state.masteryChoices,
) {
  const start =
    state.selectedClass == null
      ? null
      : tree.classStart?.get(state.selectedClass) ?? null;
  if (!start) {
    return {
      ...state,
      mainAlloc: new Set(),
      masteryChoices: new Map(),
    };
  }

  const starts = classStartKeys(tree);
  const regularCandidates = new Set(
    [...candidateKeys].filter((key) =>
      isMainPathNode(tree, tree.nodes.get(key), starts),
    ),
  );
  const reachable = reach(tree.adjacency, start.key, (key) =>
    regularCandidates.has(key),
  );
  const mainAlloc = new Set(
    [...reachable].filter((key) => regularCandidates.has(key)),
  );
  const masteryCandidates = [...candidateKeys].filter(
    (key) => tree.nodes.get(key)?.kind === "mastery",
  );

  for (const key of masteryCandidates) {
    const mastery = tree.nodes.get(key);
    if (
      masteryEffects(mastery).length > 0 &&
      hasAllocatedClusterNotable(tree, mastery, mainAlloc)
    ) {
      mainAlloc.add(key);
    }
  }

  const masteryChoices = new Map();
  const usedEffectIds = new Set();
  const choices =
    candidateChoices instanceof Map ? candidateChoices : new Map();
  for (const [key, effectId] of choices) {
    if (!mainAlloc.has(key) || usedEffectIds.has(effectId)) continue;
    if (!getPoe1MasteryEffect(tree.nodes.get(key), effectId)) continue;
    usedEffectIds.add(effectId);
    masteryChoices.set(key, effectId);
  }

  return { ...state, mainAlloc, masteryChoices };
}

export function choosePoe1MasteryEffect(tree, state, nodeKey, effectId) {
  if (
    !tree ||
    (typeof tree.datasetId === "string" &&
      state.datasetId !== tree.datasetId) ||
    !canChoosePoe1MasteryEffect(tree, state, nodeKey, effectId)
  ) {
    return state;
  }

  const mainAlloc = new Set(state.mainAlloc);
  mainAlloc.add(nodeKey);
  const masteryChoices = new Map(state.masteryChoices ?? []);
  masteryChoices.set(nodeKey, effectId);
  return normalizeMainAllocation(
    tree,
    { ...state, masteryChoices },
    mainAlloc,
    masteryChoices,
  );
}

export function clearPoe1MasteryChoice(tree, state, nodeKey) {
  if (
    !tree ||
    (typeof tree.datasetId === "string" &&
      state.datasetId !== tree.datasetId) ||
    !state.mainAlloc.has(nodeKey) ||
    tree.nodes.get(nodeKey)?.kind !== "mastery" ||
    !state.masteryChoices?.has(nodeKey)
  ) {
    return state;
  }

  const masteryChoices = new Map(state.masteryChoices);
  masteryChoices.delete(nodeKey);
  return { ...state, masteryChoices };
}

export function removePoe1Mastery(tree, state, nodeKey) {
  if (
    !tree ||
    (typeof tree.datasetId === "string" &&
      state.datasetId !== tree.datasetId) ||
    tree.nodes.get(nodeKey)?.kind !== "mastery" ||
    !state.mainAlloc.has(nodeKey)
  ) {
    return state;
  }

  const mainAlloc = new Set(state.mainAlloc);
  mainAlloc.delete(nodeKey);
  const masteryChoices = new Map(state.masteryChoices ?? []);
  masteryChoices.delete(nodeKey);
  return normalizeMainAllocation(
    tree,
    { ...state, masteryChoices },
    mainAlloc,
    masteryChoices,
  );
}
