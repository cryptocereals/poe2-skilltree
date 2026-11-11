import assert from "node:assert/strict";
import test from "node:test";

import { aggregateTreeStats } from "./aggregateTreeStats.mjs";

test("aggregates matching numeric stats for allocated nodes", () => {
  const nodes = new Map([
    ["a", { stats: ["10% increased damage", "+20 to maximum Life"] }],
    ["b", { stats: ["5% increased damage", "Allocates a mastery"] }],
    ["c", { stats: ["-20 to maximum Life"] }],
  ]);

  assert.deepEqual(aggregateTreeStats(nodes, ["a", "b", "c"]), [
    { template: "#% increased damage", total: 15, count: 2, isPct: true },
  ]);
});

test("uses class-specific overrides and ignores unallocated or non-numeric nodes", () => {
  const nodes = new Map([
    ["a", { stats: ["10% increased damage"] }],
    ["b", { stats: ["25% increased damage"] }],
  ]);
  const overrides = new Map([
    ["a", { stats: ["12% increased attack damage"] }],
  ]);

  assert.deepEqual(aggregateTreeStats(nodes, ["a"], overrides), [
    {
      template: "#% increased attack damage",
      total: 12,
      count: 1,
      isPct: true,
    },
  ]);
});

test("omits a stat group when positive and negative values cancel out", () => {
  const nodes = new Map([
    ["a", { stats: ["10 to Armour"] }],
    ["b", { stats: ["-10 to Armour"] }],
  ]);

  assert.deepEqual(aggregateTreeStats(nodes, ["a", "b"]), []);
});
