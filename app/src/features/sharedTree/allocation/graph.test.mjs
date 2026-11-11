import assert from "node:assert/strict";
import test from "node:test";

import {
  createAdjacency,
  pathFrom,
  prunedSet,
  reach,
} from "./graph.mjs";

test("creates undirected adjacency while ignoring duplicate and unavailable edges", () => {
  const adjacency = createAdjacency(["start", "a", "b"], [
    { fromKey: "start", toKey: "a" },
    { fromKey: "a", toKey: "start" },
    { fromKey: "a", toKey: "proxy" },
    { fromKey: "b", toKey: "b" },
  ]);

  assert.deepEqual(adjacency.get("start"), ["a"]);
  assert.deepEqual(adjacency.get("a"), ["start"]);
  assert.deepEqual(adjacency.get("b"), []);
  assert.equal(adjacency.has("proxy"), false);
});

test("finds the shortest path from any allocated source", () => {
  const adjacency = createAdjacency(
    ["start", "a", "b", "c", "target"],
    [
      { fromKey: "start", toKey: "a" },
      { fromKey: "a", toKey: "target" },
      { fromKey: "start", toKey: "b" },
      { fromKey: "b", toKey: "c" },
      { fromKey: "c", toKey: "target" },
    ],
  );

  assert.deepEqual(
    pathFrom(adjacency, new Set(["start"]), "target", () => true),
    ["a", "target"],
  );
  assert.deepEqual(
    pathFrom(adjacency, new Set(["start", "a"]), "target", () => true),
    ["target"],
  );
  assert.deepEqual(
    pathFrom(adjacency, new Set(["start"]), "target", (key) => key !== "a"),
    ["b", "c", "target"],
  );
  assert.equal(
    pathFrom(
      adjacency,
      new Set(["start"]),
      "target",
      (key) => key !== "a" && key !== "b",
    ),
    null,
  );
});

test("reach and pruning discard a disconnected allocated branch", () => {
  const adjacency = createAdjacency(
    ["start", "a", "b", "branch"],
    [
      { fromKey: "start", toKey: "a" },
      { fromKey: "a", toKey: "b" },
      { fromKey: "b", toKey: "branch" },
    ],
  );
  const allocated = new Set(["a", "b", "branch"]);
  const afterRemoval = new Set(["a", "branch"]);

  assert.deepEqual(
    reach(adjacency, "start", (key) => allocated.has(key)),
    new Set(["start", "a", "b", "branch"]),
  );
  assert.deepEqual(prunedSet(adjacency, afterRemoval, "start"), new Set(["a"]));
});
