import assert from "node:assert/strict";
import test from "node:test";

import { createAdjacency } from "../../sharedTree/allocation/graph.mjs";
import {
  canChoosePoe1MasteryEffect,
  canUnlockPoe1Mastery,
  changePoe1Dataset,
  choosePoe1MasteryEffect,
  clearPoe1MasteryChoice,
  clearPoe1Allocation,
  clickPoe1Node,
  createPoe1AllocationState,
  getPoe1MasteryEffect,
  getPoe1ActiveNodeKeys,
  getPoe1AllocationCounts,
  previewPoe1Allocation,
  reconcilePoe1Allocation,
  removePoe1Mastery,
  selectPoe1Ascendancy,
  selectPoe1Class,
} from "./model.mjs";

function makeNode(key, options = {}) {
  return {
    key,
    skill: Number(key) || 0,
    name: key,
    kind: "small",
    x: 0,
    y: 0,
    stats: [],
    masteryEffects: [],
    flavourText: [],
    isProxy: false,
    ...options,
  };
}

function makeTree() {
  const nodes = new Map([
    ["S", makeNode("S", { classStartIndex: 0 })],
    ["S2", makeNode("S2", { classStartIndex: 1 })],
    [
      "A",
      makeNode("A", {
        kind: "notable",
        groupKey: "main-cluster",
        stats: ["10% increased damage"],
      }),
    ],
    ["B", makeNode("B")],
    ["C", makeNode("C")],
    ["D", makeNode("D")],
    ["Z", makeNode("Z")],
    ["isolated", makeNode("isolated")],
    [
      "M",
      makeNode("M", {
        kind: "mastery",
        groupKey: "main-cluster",
        masteryEffects: [
          {
            effect: 101,
            stats: ["10% increased damage"],
            reminderText: ["Only while supported"],
          },
          { effect: 102, stats: ["Cannot deal Damage"] },
        ],
      }),
    ],
    [
      "A2",
      makeNode("A2", {
        kind: "notable",
        groupKey: "other-cluster",
      }),
    ],
    [
      "M2",
      makeNode("M2", {
        kind: "mastery",
        groupKey: "other-cluster",
        masteryEffects: [
          { effect: 101, stats: ["10% increased damage"] },
          { effect: 103, stats: ["20% increased damage"] },
        ],
      }),
    ],
    [
      "AEmpty",
      makeNode("AEmpty", {
        kind: "notable",
        groupKey: "empty-cluster",
      }),
    ],
    [
      "MEmpty",
      makeNode("MEmpty", {
        kind: "mastery",
        groupKey: "empty-cluster",
      }),
    ],
    ["proxy", makeNode("proxy", { isProxy: true })],
    ["throughProxy", makeNode("throughProxy")],
    ["throughMastery", makeNode("throughMastery")],
    [
      "AS",
      makeNode("AS", {
        kind: "ascendancyStart",
        ascendancyName: "Champion",
      }),
    ],
    ["AN", makeNode("AN", { ascendancyName: "Champion" })],
    ["AT", makeNode("AT", { ascendancyName: "Champion" })],
    [
      "AS2",
      makeNode("AS2", {
        kind: "ascendancyStart",
        ascendancyName: "Slayer",
      }),
    ],
    ["SN", makeNode("SN", { ascendancyName: "Slayer" })],
  ]);
  const renderEdges = [
    ["S", "A"],
    ["A", "B"],
    ["S", "A2"],
    ["A2", "M2"],
    ["S", "AEmpty"],
    ["AEmpty", "MEmpty"],
    ["S", "C"],
    ["C", "D"],
    ["D", "B"],
    ["A", "C"],
    ["A", "M"],
    ["M", "throughMastery"],
    ["S", "S2"],
    ["S2", "Z"],
    ["AS", "AN"],
    ["AN", "AT"],
    ["AS2", "SN"],
  ].map(([fromKey, toKey]) => ({ fromKey, toKey }));

  return {
    datasetId: "current:standard",
    nodes,
    nodeList: [...nodes.values()].filter((node) => !node.isProxy),
    renderEdges,
    classStart: new Map([
      [0, nodes.get("S")],
      [1, nodes.get("S2")],
    ]),
    classes: [
      {
        name: "Duelist",
        ascendancies: [
          { id: "Champion", name: "Champion" },
          { id: "Slayer", name: "Slayer" },
        ],
      },
      { name: "Marauder", ascendancies: [] },
    ],
    adjacency: createAdjacency(
      [...nodes.values()]
        .filter((node) => !node.isProxy)
        .map((node) => node.key),
      renderEdges.filter(
        ({ fromKey, toKey }) =>
          !nodes.get(fromKey)?.isProxy && !nodes.get(toKey)?.isProxy,
      ),
    ),
  };
}

function selectedDuelist(tree) {
  return selectPoe1Class(
    createPoe1AllocationState("current:standard"),
    0,
  );
}

test("starts and previews a shortest main-tree path from the selected class", () => {
  const tree = makeTree();
  const state = selectedDuelist(tree);
  const preview = previewPoe1Allocation(tree, state, tree.nodes.get("B"));

  assert.deepEqual(preview, { keys: ["A", "B"], layer: "main" });
  const allocated = clickPoe1Node(tree, state, tree.nodes.get("B"));
  assert.deepEqual([...allocated.mainAlloc], ["A", "B"]);
  assert.deepEqual(getPoe1AllocationCounts(allocated), {
    main: 2,
    ascendancy: 0,
    total: 2,
  });
  assert.ok(getPoe1ActiveNodeKeys(tree, allocated).has("S"));
});

test("extends the current allocation with the shortest remaining path", () => {
  const tree = makeTree();
  const state = selectedDuelist(tree);
  const withA = clickPoe1Node(tree, state, tree.nodes.get("A"));

  assert.deepEqual(
    previewPoe1Allocation(tree, withA, tree.nodes.get("B")),
    { keys: ["B"], layer: "main" },
  );
  assert.deepEqual(
    [...clickPoe1Node(tree, withA, tree.nodes.get("B")).mainAlloc],
    ["A", "B"],
  );
});

test("deallocating a connector prunes only the disconnected branch", () => {
  const tree = makeTree();
  let state = selectedDuelist(tree);
  state = clickPoe1Node(tree, state, tree.nodes.get("A"));
  state = clickPoe1Node(tree, state, tree.nodes.get("D"));
  assert.deepEqual([...state.mainAlloc], ["A", "C", "D"]);

  state = clickPoe1Node(tree, state, tree.nodes.get("C"));
  assert.deepEqual([...state.mainAlloc], ["A"]);
  assert.equal(state.mainAlloc.has("C"), false);
  assert.equal(state.mainAlloc.has("D"), false);
});

test("blocks disconnected, proxy, and other-class-start routes", () => {
  const tree = makeTree();
  const state = selectedDuelist(tree);

  assert.equal(
    previewPoe1Allocation(tree, state, tree.nodes.get("Z")),
    null,
  );
  assert.equal(
    previewPoe1Allocation(tree, state, tree.nodes.get("S2")),
    null,
  );
  assert.equal(
    previewPoe1Allocation(tree, state, tree.nodes.get("throughProxy")),
    null,
  );
  assert.equal(
    previewPoe1Allocation(tree, state, tree.nodes.get("isolated")),
    null,
  );
  assert.equal(
    clickPoe1Node(tree, state, tree.nodes.get("throughProxy")).mainAlloc.size,
    0,
  );
  assert.equal(
    clickPoe1Node(tree, state, tree.nodes.get("S2")).selectedClass,
    1,
  );
});

test("keeps ascendancy paths isolated from main and other ascendancy nodes", () => {
  const tree = makeTree();
  const state = selectedDuelist(tree);
  assert.equal(
    previewPoe1Allocation(tree, state, tree.nodes.get("AN")),
    null,
  );

  const selected = selectPoe1Ascendancy(state, "Champion", tree);
  assert.deepEqual(
    previewPoe1Allocation(tree, selected, tree.nodes.get("AT")),
    { keys: ["AN", "AT"], layer: "ascendancy" },
  );
  const allocated = clickPoe1Node(tree, selected, tree.nodes.get("AT"));
  assert.deepEqual([...allocated.ascAlloc], ["AN", "AT"]);
  assert.deepEqual([...allocated.mainAlloc], []);
  assert.equal(
    previewPoe1Allocation(tree, selected, tree.nodes.get("SN")),
    null,
  );
});

test("class changes and dataset changes reset selections and allocations", () => {
  const tree = makeTree();
  let state = selectedDuelist(tree);
  state = selectPoe1Ascendancy(state, "Champion", tree);
  state = clickPoe1Node(tree, state, tree.nodes.get("AT"));
  state = clickPoe1Node(tree, state, tree.nodes.get("A"));
  state = choosePoe1MasteryEffect(tree, state, "M", 101);

  const changedClass = selectPoe1Class(state, 1);
  assert.equal(changedClass.selectedClass, 1);
  assert.equal(changedClass.selectedAscendancyId, null);
  assert.equal(changedClass.mainAlloc.size, 0);
  assert.equal(changedClass.ascAlloc.size, 0);
  assert.equal(changedClass.masteryChoices.size, 0);

  const changedDataset = changePoe1Dataset(state, "3.29.0:ruthless");
  assert.equal(changedDataset.datasetId, "3.29.0:ruthless");
  assert.equal(changedDataset.selectedClass, null);
  assert.equal(changedDataset.mainAlloc.size, 0);
  assert.equal(changedDataset.ascAlloc.size, 0);
  assert.equal(changedDataset.masteryChoices.size, 0);
});

test("mastery clicks and invalid or unavailable effect choices do not allocate points", () => {
  const tree = makeTree();
  const state = selectedDuelist(tree);
  assert.equal(canUnlockPoe1Mastery(tree, state, "M"), false);
  assert.strictEqual(clickPoe1Node(tree, state, tree.nodes.get("M")), state);
  assert.strictEqual(
    choosePoe1MasteryEffect(tree, state, "M", 101),
    state,
  );
  assert.strictEqual(
    choosePoe1MasteryEffect(tree, state, "M", 999),
    state,
  );

  const withEmptyClusterNotable = clickPoe1Node(
    tree,
    state,
    tree.nodes.get("AEmpty"),
  );
  assert.equal(canUnlockPoe1Mastery(tree, withEmptyClusterNotable, "MEmpty"), false);
  assert.strictEqual(
    choosePoe1MasteryEffect(tree, withEmptyClusterNotable, "MEmpty", 101),
    withEmptyClusterNotable,
  );
});

test("an allocated cluster notable unlocks one mastery point and effect selection can be replaced or cleared", () => {
  const tree = makeTree();
  const state = clickPoe1Node(
    tree,
    selectedDuelist(tree),
    tree.nodes.get("A"),
  );

  assert.equal(canUnlockPoe1Mastery(tree, state, "M"), true);
  assert.deepEqual(previewPoe1Allocation(tree, state, tree.nodes.get("M")), {
    keys: ["M"],
    layer: "main",
  });
  const otherDatasetState = {
    ...state,
    datasetId: "current:ruthless",
  };
  assert.equal(
    canChoosePoe1MasteryEffect(tree, otherDatasetState, "M", 101),
    false,
  );
  assert.strictEqual(
    choosePoe1MasteryEffect(tree, otherDatasetState, "M", 101),
    otherDatasetState,
  );

  const selected = choosePoe1MasteryEffect(tree, state, "M", 101);
  assert.deepEqual([...selected.mainAlloc], ["A", "M"]);
  assert.deepEqual([...selected.masteryChoices], [["M", 101]]);
  assert.equal(getPoe1AllocationCounts(selected).main, 2);
  assert.equal(getPoe1MasteryEffect(tree.nodes.get("M"), 101).effect, 101);

  const replaced = choosePoe1MasteryEffect(tree, selected, "M", 102);
  assert.deepEqual([...replaced.mainAlloc], ["A", "M"]);
  assert.deepEqual([...replaced.masteryChoices], [["M", 102]]);
  assert.equal(getPoe1AllocationCounts(replaced).main, 2);
  assert.equal(getPoe1MasteryEffect(tree.nodes.get("M"), 101).effect, 101);

  const clearedChoice = clearPoe1MasteryChoice(tree, replaced, "M");
  assert.equal(clearedChoice.mainAlloc.has("M"), true);
  assert.equal(clearedChoice.masteryChoices.has("M"), false);
  assert.equal(getPoe1AllocationCounts(clearedChoice).main, 2);

  const removed = removePoe1Mastery(tree, clearedChoice, "M");
  assert.equal(removed.mainAlloc.has("M"), false);
  assert.equal(removed.masteryChoices.has("M"), false);
  assert.equal(getPoe1AllocationCounts(removed).main, 1);
});

test("does not allow duplicate mastery effects across allocated clusters", () => {
  const tree = makeTree();
  let state = selectedDuelist(tree);
  state = clickPoe1Node(tree, state, tree.nodes.get("A"));
  state = choosePoe1MasteryEffect(tree, state, "M", 101);
  state = clickPoe1Node(tree, state, tree.nodes.get("A2"));

  assert.equal(canUnlockPoe1Mastery(tree, state, "M2"), true);
  assert.equal(canChoosePoe1MasteryEffect(tree, state, "M2", 101), false);
  assert.strictEqual(
    choosePoe1MasteryEffect(tree, state, "M2", 101),
    state,
  );

  const secondChoice = choosePoe1MasteryEffect(tree, state, "M2", 103);
  assert.deepEqual([...secondChoice.masteryChoices], [
    ["M", 101],
    ["M2", 103],
  ]);
});

test("deallocating the last cluster notable prunes its mastery and selected effect", () => {
  const tree = makeTree();
  let state = selectedDuelist(tree);
  state = clickPoe1Node(tree, state, tree.nodes.get("A"));
  state = choosePoe1MasteryEffect(tree, state, "M", 101);

  const pruned = clickPoe1Node(tree, state, tree.nodes.get("A"));
  assert.equal(pruned.mainAlloc.size, 0);
  assert.equal(pruned.masteryChoices.size, 0);
});

test("main paths cannot pass through an allocated mastery", () => {
  const tree = makeTree();
  let state = selectedDuelist(tree);
  state = clickPoe1Node(tree, state, tree.nodes.get("A"));
  state = choosePoe1MasteryEffect(tree, state, "M", 101);

  assert.equal(
    previewPoe1Allocation(tree, state, tree.nodes.get("throughMastery")),
    null,
  );

  const stale = {
    ...state,
    mainAlloc: new Set([...state.mainAlloc, "throughMastery"]),
  };
  const reconciled = reconcilePoe1Allocation(tree, stale);
  assert.equal(reconciled.mainAlloc.has("throughMastery"), false);
});

test("reconciles stale or cross-layer keys, validates selected effects, and counts mastery points", () => {
  const tree = makeTree();
  let state = selectedDuelist(tree);
  state = clickPoe1Node(tree, state, tree.nodes.get("A"));
  state = choosePoe1MasteryEffect(tree, state, "M", 101);

  const withAscendancy = selectPoe1Ascendancy(
    state,
    "Champion",
    tree,
  );
  const allocated = clickPoe1Node(
    tree,
    withAscendancy,
    tree.nodes.get("AN"),
  );
  const stale = {
    ...allocated,
    mainAlloc: new Set(["A", "M", "S2", "proxy", "missing"]),
    ascAlloc: new Set(["AN", "SN"]),
    masteryChoices: new Map([
      ["M", 101],
      ["missing", 202],
    ]),
  };
  const reconciled = reconcilePoe1Allocation(tree, stale);

  assert.deepEqual([...reconciled.mainAlloc], ["A", "M"]);
  assert.deepEqual([...reconciled.ascAlloc], ["AN"]);
  assert.deepEqual([...reconciled.masteryChoices], [["M", 101]]);
  assert.equal(getPoe1AllocationCounts(reconciled).total, 3);

  const invalidChoice = reconcilePoe1Allocation(tree, {
    ...state,
    masteryChoices: new Map([["M", 999]]),
  });
  assert.deepEqual([...invalidChoice.mainAlloc], ["A", "M"]);
  assert.equal(invalidChoice.masteryChoices.size, 0);

  const cleared = clearPoe1Allocation(reconciled);
  assert.equal(cleared.selectedClass, 0);
  assert.equal(cleared.selectedAscendancyId, "Champion");
  assert.deepEqual(getPoe1AllocationCounts(cleared), {
    main: 0,
    ascendancy: 0,
    total: 0,
  });
  assert.equal(cleared.masteryChoices.size, 0);
});
