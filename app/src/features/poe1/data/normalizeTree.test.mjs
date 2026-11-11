import assert from "node:assert/strict";
import test from "node:test";

import {
  findPoe1AscendancyStart,
  identifyPoe1Ascendancy,
} from "./ascendancySelection.mjs";
import { normalizePoe1Tree } from "./normalizeTree.mjs";

function rawTree() {
  return {
    tree: "Default",
    classes: [{ name: "Scion", ascendancies: [] }],
    groups: {
      "10": { x: 100, y: 50, orbits: [0, 1], nodes: ["1", "2", "3"] },
    },
    nodes: {
      "1": {
        skill: 1,
        name: "SIX",
        group: 10,
        orbit: 0,
        orbitIndex: 0,
        classStartIndex: 0,
        out: ["2"],
        in: [],
      },
      "2": {
        skill: 2,
        name: "Notable",
        group: "10",
        orbit: 1,
        orbitIndex: 0,
        isNotable: true,
        icon: "Art/2DArt/SkillIcons/passives/example.png",
        stats: ["10% increased damage"],
        out: ["1", "3"],
        in: [],
      },
      "3": {
        skill: 3,
        name: "Keystone",
        group: 10,
        orbit: 1,
        orbitIndex: 3,
        isKeystone: true,
        in: ["2"],
        out: [],
      },
      "4": {
        skill: 4,
        name: "Dynamic cluster passive",
        isNotable: true,
        out: ["2"],
      },
    },
    constants: {
      orbitRadii: [0, 82],
      skillsPerOrbit: [1, 6],
    },
    sprites: {},
    min_x: 0,
    min_y: -100,
    max_x: 200,
    max_y: 100,
  };
}

test("normalizes the official group/orbit format, class starts, and undirected links", () => {
  const tree = normalizePoe1Tree(rawTree(), "standard");

  assert.equal(tree.game, "poe1");
  assert.equal(tree.ruleset, "standard");
  assert.equal(tree.datasetId, "current:standard");
  assert.equal(tree.versionId, "current");
  assert.equal(tree.nodeList.length, 3);
  assert.equal(tree.renderGroups.length, 1);
  assert.deepEqual(tree.classStart.get(0)?.key, "1");
  assert.deepEqual(
    { x: tree.nodes.get("2").x, y: tree.nodes.get("2").y },
    { x: 100, y: -32 },
  );
  assert.equal(tree.nodes.get("2").kind, "notable");
  assert.equal(tree.nodes.get("2").stats[0], "10% increased damage");
  assert.deepEqual(
    tree.edges.map(({ fromKey, toKey }) => [fromKey, toKey]),
    [
      ["1", "2"],
      ["2", "3"],
    ],
  );
  assert.deepEqual(
    tree.renderEdges.map(({ fromKey, toKey }) => [fromKey, toKey]),
    [
      ["1", "2"],
      ["2", "3"],
    ],
  );
  assert.deepEqual(tree.adjacency.get("1"), ["2"]);
  assert.deepEqual(tree.adjacency.get("2"), ["1", "3"]);
  assert.ok(tree.bounds.minY <= -100);
});

test("normalizes mastery effect IDs, stats, and reminders while dropping malformed entries", () => {
  const raw = rawTree();
  raw.nodes["2"].isNotable = false;
  raw.nodes["2"].isMastery = true;
  raw.nodes["2"].masteryEffects = [
    {
      effect: 123,
      stats: ["10% increased Damage", 7, null],
      reminderText: ["Only while supported", false],
    },
    { effect: 123, stats: ["Duplicate IDs are ignored"] },
    { effect: "124", stats: ["String IDs are not valid"] },
    { effect: 12.5, stats: ["Fractional IDs are not valid"] },
    null,
    { effect: 125, stats: "A stat must be a string array" },
  ];

  const tree = normalizePoe1Tree(raw, "ruthless", "3.29.0");
  assert.equal(tree.nodes.get("2").kind, "mastery");
  assert.deepEqual(tree.nodes.get("2").masteryEffects, [
    {
      effect: 123,
      stats: ["10% increased Damage"],
      reminderText: ["Only while supported"],
    },
    { effect: 125, stats: [] },
  ]);
  assert.equal(tree.nodes.get("2").masteryEffects[1].reminderText, undefined);
  assert.equal(tree.ruleset, "ruthless");
  assert.equal(tree.versionId, "3.29.0");
});

test("positions official orbit slots using each orbit's radius and slot count", () => {
  const raw = rawTree();
  const orbitRadii = [0, 82, 162, 335, 493, 662, 846];
  const skillsPerOrbit = [1, 6, 16, 16, 40, 72, 72];
  raw.constants.orbitRadii = orbitRadii;
  raw.constants.skillsPerOrbit = skillsPerOrbit;
  raw.groups["20"] = {
    x: 1000,
    y: -250,
    orbits: orbitRadii.map((_, orbit) => orbit),
    nodes: orbitRadii.map((_, orbit) => String(5 + orbit)),
  };
  for (let orbit = 0; orbit < orbitRadii.length; orbit += 1) {
    const orbitIndex =
      orbit === 0 ? 0 : Math.floor(skillsPerOrbit[orbit] / 4);
    raw.nodes[String(5 + orbit)] = {
      skill: 5 + orbit,
      name: `Orbit ${orbit} passive`,
      group: "20",
      orbit,
      orbitIndex,
    };
  }
  raw.nodes["12"] = {
    skill: 12,
    name: "Invalid orbit slot",
    group: "20",
    orbit: 3,
    orbitIndex: skillsPerOrbit[3],
  };

  const tree = normalizePoe1Tree(raw);
  for (let orbit = 0; orbit < orbitRadii.length; orbit += 1) {
    const node = tree.nodes.get(String(5 + orbit));
    const orbitIndex =
      orbit === 0 ? 0 : Math.floor(skillsPerOrbit[orbit] / 4);
    const angle =
      orbit === 0
        ? 0
        : (Math.PI * 2 * orbitIndex) / skillsPerOrbit[orbit] -
          Math.PI / 2;
    assert.ok(
      Math.abs(
        node.x - (1000 + Math.cos(angle) * orbitRadii[orbit]),
      ) < 1e-9,
    );
    assert.ok(
      Math.abs(
        node.y - (-250 + Math.sin(angle) * orbitRadii[orbit]),
      ) < 1e-9,
    );
  }
  assert.equal(tree.nodes.has("12"), false);
});

test("retains proxy links logically but excludes proxy nodes and links from rendering", () => {
  const raw = rawTree();
  raw.groups["90"] = { x: 900, y: 900, orbits: [0, 1], nodes: [] };
  raw.nodes.proxy = {
    skill: 99,
    name: "Position Proxy",
    group: 10,
    orbit: 1,
    orbitIndex: 4,
    isProxy: true,
    out: ["2"],
  };

  const tree = normalizePoe1Tree(raw);
  assert.equal(tree.nodes.get("proxy")?.isProxy, true);
  assert.equal(tree.nodeList.some((node) => node.key === "proxy"), false);
  assert.equal(
    tree.edges.some((edge) => edge.fromKey === "proxy" || edge.toKey === "proxy"),
    true,
  );
  assert.equal(
    tree.renderEdges.some(
      (edge) => edge.fromKey === "proxy" || edge.toKey === "proxy",
    ),
    false,
  );
  assert.equal(tree.adjacency.has("proxy"), false);
  assert.equal(tree.adjacency.get("2")?.includes("proxy"), false);
  assert.equal(tree.groups.some((group) => group.key === "90"), true);
  assert.equal(tree.renderGroups.some((group) => group.key === "90"), false);
});

test("filters cross-layout links without dropping long main-tree connections", () => {
  const raw = rawTree();
  raw.classes = [
    { name: "Ranger", ascendancies: [{ id: "Raider", name: "Warden" }] },
  ];
  raw.groups["20"] = {
    x: 1000,
    y: 0,
    orbits: [0, 1],
    nodes: ["5", "6"],
  };
  raw.groups["30"] = { x: 20_000, y: 0, orbits: [0], nodes: ["7"] };
  raw.nodes["1"].out.push("7");
  raw.nodes["2"].out.push("5");
  raw.nodes["5"] = {
    skill: 5,
    name: "Warden Start",
    group: "20",
    orbit: 0,
    orbitIndex: 0,
    isAscendancyStart: true,
    ascendancyName: "Warden",
    out: ["6"],
  };
  raw.nodes["6"] = {
    skill: 6,
    name: "Warden Notable",
    group: "20",
    orbit: 1,
    orbitIndex: 0,
    isNotable: true,
    ascendancyName: "Warden",
  };
  raw.nodes["7"] = {
    skill: 7,
    name: "Distant main passive",
    group: "30",
    orbit: 0,
    orbitIndex: 0,
  };

  const tree = normalizePoe1Tree(raw);
  const hasEdge = (edges, left, right) =>
    edges.some(
      (edge) =>
        (edge.fromKey === left && edge.toKey === right) ||
        (edge.fromKey === right && edge.toKey === left),
    );

  assert.equal(hasEdge(tree.edges, "2", "5"), true);
  assert.equal(hasEdge(tree.renderEdges, "2", "5"), false);
  assert.equal(hasEdge(tree.renderEdges, "5", "6"), true);
  assert.ok(
    Math.hypot(
      tree.nodes.get("1").x - tree.nodes.get("7").x,
      tree.nodes.get("1").y - tree.nodes.get("7").y,
    ) > 15_000,
  );
  assert.equal(hasEdge(tree.renderEdges, "1", "7"), true);
});

test("maps ascendancy IDs and display names to the official start node", () => {
  const raw = rawTree();
  raw.classes = [
    { name: "Ranger", ascendancies: [{ id: "Raider", name: "Warden" }] },
  ];
  raw.groups["20"] = { x: 1000, y: 0, orbits: [0, 1], nodes: ["5", "6"] };
  raw.nodes["5"] = {
    skill: 5,
    name: "Warden Start",
    group: "20",
    orbit: 0,
    orbitIndex: 0,
    isAscendancyStart: true,
    ascendancyName: "Warden",
  };
  raw.nodes["6"] = {
    skill: 6,
    name: "Warden Notable",
    group: "20",
    orbit: 1,
    orbitIndex: 0,
    isNotable: true,
    ascendancyName: "Warden",
  };
  const tree = normalizePoe1Tree(raw);

  assert.equal(findPoe1AscendancyStart(tree, 0, "Raider")?.key, "5");
  assert.deepEqual(identifyPoe1Ascendancy(tree, tree.nodes.get("6")), {
    classIndex: 0,
    ascendancyId: "Raider",
  });
  assert.deepEqual(
    identifyPoe1Ascendancy(tree, {
      ...tree.nodes.get("6"),
      ascendancyName: "Raider",
    }),
    {
      classIndex: 0,
      ascendancyId: "Raider",
    },
  );
});

test("keeps the ruleset on the normalized PoE1 tree without PoE2 build fields", () => {
  const tree = normalizePoe1Tree(rawTree(), "ruthless");
  const archived = normalizePoe1Tree(rawTree(), "ruthless", "3.29.0");

  assert.equal(tree.ruleset, "ruthless");
  assert.equal(archived.versionId, "3.29.0");
  assert.equal(tree.classes[0].name, "Scion");
  assert.equal("baseBudget" in tree, false);
  assert.equal("selectedAsc" in tree, false);
});

test("rejects unsupported export shapes and invalid rulesets", () => {
  assert.throws(() => normalizePoe1Tree({ nodes: {} }), /Unsupported PoE1/);
  assert.throws(() => normalizePoe1Tree(rawTree(), "current"), /Unsupported PoE1 ruleset/);
  assert.throws(
    () => normalizePoe1Tree(rawTree(), "standard", "../secret"),
    /Unsupported PoE1 tree version/,
  );
});
