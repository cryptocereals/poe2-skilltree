import assert from "node:assert/strict";
import test from "node:test";

import {
  getPoe1EffectiveNode,
  summarizePoe1Allocation,
} from "./summary.mjs";

function masteryNode() {
  return {
    key: "mastery",
    name: "Life Mastery",
    kind: "mastery",
    stats: ["+5 to maximum Life"],
    masteryEffects: [
      {
        effect: 701,
        stats: [
          "10% more Maximum Life if you have at least 6 Life Masteries allocated",
          "Enemies take 2% increased Damage",
          "Cannot deal Damage",
        ],
        reminderText: ["This condition is checked by the game."],
      },
    ],
  };
}

function state(overrides = {}) {
  return {
    datasetId: "current:standard",
    selectedClass: 0,
    selectedAscendancyId: null,
    mainAlloc: new Set(["mastery"]),
    ascAlloc: new Set(),
    masteryChoices: new Map([["mastery", 701]]),
    ...overrides,
  };
}

function tree() {
  const node = masteryNode();
  return {
    datasetId: "current:standard",
    nodes: new Map([["mastery", node]]),
  };
}

test("effective mastery stats preserve base stats and retain the full chosen effect", () => {
  const node = masteryNode();
  const effective = getPoe1EffectiveNode(node, 701);

  assert.deepEqual(effective.stats, [
    "+5 to maximum Life",
    "10% more Maximum Life if you have at least 6 Life Masteries allocated",
    "Enemies take 2% increased Damage",
    "Cannot deal Damage",
  ]);
  assert.deepEqual(effective.selectedMasteryEffect, node.masteryEffects[0]);
});

test("the summary shows conditional and non-numeric mastery effects verbatim, not as player totals", () => {
  const summary = summarizePoe1Allocation(tree(), state());

  assert.deepEqual(summary.rows, [
    {
      template: "# to maximum Life",
      total: 5,
      count: 1,
      isPct: false,
    },
  ]);
  assert.deepEqual(summary.masteryEffects, [
    {
      key: "mastery",
      name: "Life Mastery",
      effectId: 701,
      stats: [
        "10% more Maximum Life if you have at least 6 Life Masteries allocated",
        "Enemies take 2% increased Damage",
        "Cannot deal Damage",
      ],
      reminderText: ["This condition is checked by the game."],
    },
  ]);
  assert.equal(
    summary.rows.some((row) => row.template.includes("Enemies")),
    false,
  );
  assert.equal(
    summary.rows.some((row) => row.template.includes("Life Masteries")),
    false,
  );
});

test("the summary ignores unallocated or wrong-dataset mastery choices", () => {
  const unallocated = summarizePoe1Allocation(
    tree(),
    state({ mainAlloc: new Set() }),
  );
  assert.deepEqual(unallocated.masteryEffects, []);

  const otherDataset = summarizePoe1Allocation(
    tree(),
    state({ datasetId: "3.29.0:ruthless" }),
  );
  assert.deepEqual(otherDataset, { rows: [], masteryEffects: [] });
});
