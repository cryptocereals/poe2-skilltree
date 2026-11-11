import {
  findPoe1AscendancyStart,
  identifyPoe1Ascendancy,
} from "../data/ascendancySelection.mjs";
import {
  pathFrom,
  prunedSet,
} from "../../sharedTree/allocation/graph.mjs";
import {
  canChoosePoe1MasteryEffect,
  canUnlockPoe1Mastery,
  choosePoe1MasteryEffect,
  classStartKeys,
  clearPoe1MasteryChoice,
  getPoe1MasteryEffect,
  isMainPathNode,
  normalizeMainAllocation,
  reachableMainAllocations,
  removePoe1Mastery,
} from "./mastery.mjs";

export {
  canChoosePoe1MasteryEffect,
  canUnlockPoe1Mastery,
  choosePoe1MasteryEffect,
  clearPoe1MasteryChoice,
  getPoe1MasteryEffect,
  removePoe1Mastery,
};

export function createPoe1AllocationState(datasetId = "") {
  return {
    datasetId,
    selectedClass: null,
    selectedAscendancyId: null,
    mainAlloc: new Set(),
    ascAlloc: new Set(),
    masteryChoices: new Map(),
  };
}

export function changePoe1Dataset(state, datasetId) {
  if (state.datasetId === datasetId) return state;
  return createPoe1AllocationState(datasetId);
}

export function selectPoe1Class(state, classIndex) {
  const nextClass = Number.isInteger(classIndex) && classIndex >= 0
    ? classIndex
    : null;
  if (nextClass === state.selectedClass) return state;
  return {
    ...state,
    selectedClass: nextClass,
    selectedAscendancyId: null,
    mainAlloc: new Set(),
    ascAlloc: new Set(),
    masteryChoices: new Map(),
  };
}

export function selectPoe1Ascendancy(state, ascendancyId, tree) {
  const nextId =
    typeof ascendancyId === "string" && ascendancyId
      ? ascendancyId
      : null;
  if (
    nextId &&
    (state.selectedClass == null ||
      !findPoe1AscendancyStart(tree, state.selectedClass, nextId))
  ) {
    return state;
  }
  if (nextId === state.selectedAscendancyId) return state;
  return {
    ...state,
    selectedAscendancyId: nextId,
    ascAlloc: new Set(),
  };
}

export function clearPoe1Allocation(state) {
  if (
    state.mainAlloc.size === 0 &&
    state.ascAlloc.size === 0 &&
    (state.masteryChoices?.size ?? 0) === 0
  ) {
    return state;
  }
  return {
    ...state,
    mainAlloc: new Set(),
    ascAlloc: new Set(),
    masteryChoices: new Map(),
  };
}

function getClassForStart(tree, nodeKey, selectedClass) {
  let firstMatch = null;
  for (const [classIndex, start] of tree.classStart) {
    if (start.key !== nodeKey) continue;
    if (classIndex === selectedClass) return classIndex;
    if (firstMatch == null) firstMatch = classIndex;
  }
  return firstMatch;
}

function mainPreview(tree, state, node) {
  if (state.selectedClass == null) return null;
  const start = tree.classStart.get(state.selectedClass);
  if (!start || node.key === start.key || state.mainAlloc.has(node.key)) {
    return null;
  }

  const starts = classStartKeys(tree);
  if (!isMainPathNode(tree, node, starts)) return null;
  const sources = new Set([
    start.key,
    ...reachableMainAllocations(tree, state),
  ]);
  const path = pathFrom(
    tree.adjacency,
    sources,
    node.key,
    (key) => isMainPathNode(tree, tree.nodes.get(key), starts),
  );
  return path?.length ? { keys: path, layer: "main" } : null;
}

function ascendancyPreview(tree, state, node, identity) {
  if (
    state.selectedClass !== identity.classIndex ||
    state.selectedAscendancyId !== identity.ascendancyId
  ) {
    return null;
  }
  const start = findPoe1AscendancyStart(
    tree,
    identity.classIndex,
    identity.ascendancyId,
  );
  if (
    !start ||
    node.key === start.key ||
    node.kind === "ascendancyStart" ||
    state.ascAlloc.has(node.key)
  ) {
    return null;
  }

  const sources = new Set([start.key, ...state.ascAlloc]);
  const path = pathFrom(
    tree.adjacency,
    sources,
    node.key,
    (key) => {
      const ascendancy = identifyPoe1Ascendancy(tree, tree.nodes.get(key));
      return (
        ascendancy?.classIndex === identity.classIndex &&
        ascendancy.ascendancyId === identity.ascendancyId
      );
    },
  );
  return path?.length ? { keys: path, layer: "ascendancy" } : null;
}

/** Return the shortest legal main-tree or selected-ascendancy path to a node. */
export function previewPoe1Allocation(tree, state, node) {
  if (!tree || !node) return null;
  const target = tree.nodes.get(node.key);
  if (!target || target.isProxy) return null;
  if (target.kind === "mastery") {
    if (
      state.mainAlloc.has(target.key) ||
      !canUnlockPoe1Mastery(tree, state, target.key)
    ) {
      return null;
    }
    return { keys: [target.key], layer: "main" };
  }

  const identity = identifyPoe1Ascendancy(tree, target);
  if (identity) return ascendancyPreview(tree, state, target, identity);
  if (target.ascendancyName || target.kind === "ascendancyStart") return null;
  return mainPreview(tree, state, target);
}

function toggleMainNode(tree, state, node) {
  if (node.kind === "mastery") return state;
  if (state.selectedClass == null) return state;
  const start = tree.classStart.get(state.selectedClass);
  if (!start || node.key === start.key) return state;

  if (state.mainAlloc.has(node.key)) {
    const remaining = new Set(state.mainAlloc);
    remaining.delete(node.key);
    return normalizeMainAllocation(tree, state, remaining);
  }

  const preview = mainPreview(tree, state, node);
  if (!preview) return state;
  const mainAlloc = new Set(state.mainAlloc);
  for (const key of preview.keys) mainAlloc.add(key);
  return normalizeMainAllocation(tree, state, mainAlloc);
}

function toggleAscendancyNode(tree, state, node, identity) {
  const stateForAscendancy =
    state.selectedClass === identity.classIndex
      ? state
      : selectPoe1Class(state, identity.classIndex);
  if (stateForAscendancy.selectedAscendancyId !== identity.ascendancyId) {
    return selectPoe1Ascendancy(
      stateForAscendancy,
      identity.ascendancyId,
      tree,
    );
  }

  const start = findPoe1AscendancyStart(
    tree,
    identity.classIndex,
    identity.ascendancyId,
  );
  if (!start || node.key === start.key || node.kind === "ascendancyStart") {
    return stateForAscendancy;
  }

  if (stateForAscendancy.ascAlloc.has(node.key)) {
    const remaining = new Set(stateForAscendancy.ascAlloc);
    remaining.delete(node.key);
    return {
      ...stateForAscendancy,
      ascAlloc: prunedSet(tree.adjacency, remaining, start.key),
    };
  }

  const preview = ascendancyPreview(
    tree,
    stateForAscendancy,
    node,
    identity,
  );
  if (!preview) return stateForAscendancy;
  const ascAlloc = new Set(stateForAscendancy.ascAlloc);
  for (const key of preview.keys) ascAlloc.add(key);
  return { ...stateForAscendancy, ascAlloc };
}

/** Allocate/deallocate a node, or select its class/ascendancy when needed. */
export function clickPoe1Node(tree, state, node) {
  if (!tree || !node) return state;
  const target = tree.nodes.get(node.key);
  if (!target || target.isProxy) return state;
  if (target.kind === "mastery") return state;

  const identity = identifyPoe1Ascendancy(tree, target);
  if (identity) {
    return toggleAscendancyNode(tree, state, target, identity);
  }
  if (target.ascendancyName || target.kind === "ascendancyStart") return state;

  const startClass = getClassForStart(tree, target.key, state.selectedClass);
  if (startClass != null) return selectPoe1Class(state, startClass);
  return toggleMainNode(tree, state, target);
}

/** Drop allocation keys and selections that do not exist in the displayed tree. */
export function reconcilePoe1Allocation(tree, state) {
  if (!tree) return state;
  if (
    typeof tree.datasetId === "string" &&
    state.datasetId !== tree.datasetId
  ) {
    return createPoe1AllocationState(tree.datasetId);
  }

  const selectedClass =
    state.selectedClass != null && tree.classStart.has(state.selectedClass)
      ? state.selectedClass
      : null;
  const selectedAscendancyId =
    selectedClass != null &&
    state.selectedAscendancyId &&
    findPoe1AscendancyStart(
      tree,
      selectedClass,
      state.selectedAscendancyId,
    )
      ? state.selectedAscendancyId
      : null;
  const stateForTree = {
    ...state,
    selectedClass,
    selectedAscendancyId,
  };
  const mainState = normalizeMainAllocation(
    tree,
    stateForTree,
    state.mainAlloc,
    state.masteryChoices,
  );

  const ascStart =
    selectedClass == null || selectedAscendancyId == null
      ? null
      : findPoe1AscendancyStart(
          tree,
          selectedClass,
          selectedAscendancyId,
        );
  const ascCandidates = new Set(
    [...state.ascAlloc].filter((key) => {
      const identity = identifyPoe1Ascendancy(tree, tree.nodes.get(key));
      return (
        identity?.classIndex === selectedClass &&
        identity.ascendancyId === selectedAscendancyId &&
        tree.nodes.get(key)?.kind !== "ascendancyStart"
      );
    }),
  );
  const ascAlloc = ascStart
    ? prunedSet(tree.adjacency, ascCandidates, ascStart.key)
    : new Set();

  const currentMasteryChoices = state.masteryChoices ?? new Map();
  const sameMasteryChoices =
    mainState.masteryChoices.size === currentMasteryChoices.size &&
    [...mainState.masteryChoices].every(
      ([key, effectId]) => currentMasteryChoices.get(key) === effectId,
    );
  if (
    selectedClass === state.selectedClass &&
    selectedAscendancyId === state.selectedAscendancyId &&
    mainState.mainAlloc.size === state.mainAlloc.size &&
    [...mainState.mainAlloc].every((key) => state.mainAlloc.has(key)) &&
    ascAlloc.size === state.ascAlloc.size &&
    [...ascAlloc].every((key) => state.ascAlloc.has(key)) &&
    sameMasteryChoices
  ) {
    return state;
  }

  return {
    ...mainState,
    ascAlloc,
  };
}

export function getPoe1ActiveNodeKeys(tree, state) {
  const active = new Set([...state.mainAlloc, ...state.ascAlloc]);
  if (tree && state.selectedClass != null) {
    const mainStart = tree.classStart.get(state.selectedClass);
    if (mainStart) active.add(mainStart.key);
    if (state.selectedAscendancyId) {
      const ascStart = findPoe1AscendancyStart(
        tree,
        state.selectedClass,
        state.selectedAscendancyId,
      );
      if (ascStart) active.add(ascStart.key);
    }
  }
  return active;
}

export function getPoe1AllocationCounts(state) {
  return {
    main: state.mainAlloc.size,
    ascendancy: state.ascAlloc.size,
    total: state.mainAlloc.size + state.ascAlloc.size,
  };
}
