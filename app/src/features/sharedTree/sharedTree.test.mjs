import assert from "node:assert/strict";
import test from "node:test";

import { computeNodeDiff } from "./nodeDiff.mjs";
import { getHoverTransition } from "./hoverState.mjs";
import { getTooltipPosition } from "./tooltipPosition.mjs";
import { createVersionRequestGate } from "./versionRequest.mjs";

function node(key, overrides = {}) {
  return {
    key,
    name: `Node ${key}`,
    stats: [],
    x: 0,
    y: 0,
    kind: "small",
    ...overrides,
  };
}

test("shared diff reports added, removed, renamed, stat, and moved nodes", () => {
  const previous = new Map([
    ["changed", node("changed", { stats: ["10% damage"] })],
    ["renamed", node("renamed", { name: "Old name" })],
    ["moved", node("moved")],
    ["removed", node("removed")],
    ["placeholder", node("placeholder", { name: "[DNT] hidden" })],
  ]);
  const next = new Map([
    ["changed", node("changed", { stats: ["12% damage"] })],
    ["renamed", node("renamed", { name: "New name" })],
    ["moved", node("moved", { x: 140 })],
    ["added", node("added")],
    ["placeholder", node("placeholder", { name: "[DNT] hidden" })],
  ]);

  const diff = computeNodeDiff(previous, next);

  assert.equal(diff.byKey.get("changed").status, "stats");
  assert.deepEqual(diff.byKey.get("changed").oldStats, ["10% damage"]);
  assert.deepEqual(diff.byKey.get("changed").newStats, ["12% damage"]);
  assert.equal(diff.byKey.get("renamed").status, "renamed");
  assert.equal(diff.byKey.get("added").status, "added");
  assert.equal(diff.byKey.get("removed").status, "removed");
  assert.deepEqual(diff.removed[0].ghost, {
    x: 0,
    y: 0,
    name: "Node removed",
    kind: "small",
  });
  assert.deepEqual(diff.moved[0], {
    key: "moved",
    name: "Node moved",
    fromX: 0,
    fromY: 0,
    toX: 140,
    toY: 0,
  });
  assert.deepEqual(diff.counts, {
    added: 1,
    removed: 1,
    stats: 1,
    renamed: 1,
    moved: 1,
  });
  assert.equal(diff.byKey.has("placeholder"), false);
});

test("shared tooltip positioning stays inside an offset canvas container", () => {
  assert.deepEqual(
    getTooltipPosition({
      x: 120,
      y: 80,
      tooltipWidth: 180,
      tooltipHeight: 100,
      containerWidth: 400,
      containerHeight: 280,
    }),
    { left: 140, top: 100 },
  );
  assert.deepEqual(
    getTooltipPosition({
      x: 380,
      y: 260,
      tooltipWidth: 180,
      tooltipHeight: 100,
      containerWidth: 400,
      containerHeight: 280,
    }),
    { left: 212, top: 172 },
  );
});

test("hover state appears on node entry and clears when the pointer leaves", () => {
  const node = { key: "42" };
  assert.deepEqual(getHoverTransition(null, node), {
    key: "42",
    changed: true,
  });
  assert.deepEqual(getHoverTransition("42", node), {
    key: "42",
    changed: false,
  });
  assert.deepEqual(getHoverTransition("42", null), {
    key: null,
    changed: true,
  });
  assert.deepEqual(getHoverTransition(null, null), {
    key: null,
    changed: false,
  });
});

test("newer version requests invalidate older responses and cancelled loads", async () => {
  const gate = createVersionRequestGate();
  const olderId = gate.begin();
  const newerId = gate.begin();
  let value = "";
  let resolveOlder;
  let resolveNewer;
  const older = new Promise((resolve) => {
    resolveOlder = resolve;
  }).then((result) => {
    if (gate.isCurrent(olderId)) value = result;
  });
  const newer = new Promise((resolve) => {
    resolveNewer = resolve;
  }).then((result) => {
    if (gate.isCurrent(newerId)) value = result;
  });

  resolveNewer("selected version");
  await newer;
  resolveOlder("stale version");
  await older;
  assert.equal(value, "selected version");

  const retryId = gate.begin();
  gate.cancel(retryId);
  assert.equal(gate.isCurrent(retryId), false);
});
