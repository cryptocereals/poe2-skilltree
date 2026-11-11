import assert from "node:assert/strict";
import test from "node:test";

import { computePoe1Diff } from "./diff.mjs";

function poe1Node(key, overrides = {}) {
  return {
    key,
    name: `PoE1 passive ${key}`,
    stats: [],
    x: 0,
    y: 0,
    kind: "small",
    isProxy: false,
    ...overrides,
  };
}

function tree(nodes) {
  return { game: "poe1", nodeList: nodes };
}

test("PoE1 diff uses stable official node keys and retains PoE1 node kinds", () => {
  const previous = tree([
    poe1Node("1", { stats: ["10% increased damage"] }),
    poe1Node("2", { name: "Old notable", kind: "notable" }),
    poe1Node("3"),
    poe1Node("4", { name: "Removed keystone", kind: "keystone" }),
  ]);
  const next = tree([
    poe1Node("1", { stats: ["12% increased damage"] }),
    poe1Node("2", { name: "New notable", kind: "notable" }),
    poe1Node("3", { x: 200 }),
    poe1Node("5", { name: "New mastery", kind: "mastery" }),
  ]);

  const diff = computePoe1Diff(previous, next);

  assert.equal(diff.byKey.get("1").status, "stats");
  assert.equal(diff.byKey.get("2").status, "renamed");
  assert.equal(diff.byKey.get("5").status, "added");
  assert.equal(diff.removed[0].ghost.kind, "keystone");
  assert.equal(diff.moved[0].key, "3");
  assert.deepEqual(diff.counts, {
    added: 1,
    removed: 1,
    stats: 1,
    renamed: 1,
    moved: 1,
  });
});
