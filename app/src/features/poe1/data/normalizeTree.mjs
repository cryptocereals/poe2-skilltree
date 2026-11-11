import { createAdjacency } from "../../sharedTree/allocation/graph.mjs";
import { getPoe1DatasetId, isPoe1ReleaseId } from "./source.mjs";

const VALID_RULESETS = new Set(["standard", "ruthless"]);

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function stringList(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === "string")
    : [];
}

function normalizeMasteryEffects(value) {
  if (!Array.isArray(value)) return [];

  const seenEffectIds = new Set();
  return value.flatMap((rawEffect) => {
    const effect = asRecord(rawEffect);
    if (
      !effect ||
      !Number.isSafeInteger(effect.effect) ||
      effect.effect <= 0 ||
      seenEffectIds.has(effect.effect)
    ) {
      return [];
    }
    seenEffectIds.add(effect.effect);

    return [
      {
        effect: effect.effect,
        stats: stringList(effect.stats),
        ...(Array.isArray(effect.reminderText)
          ? { reminderText: stringList(effect.reminderText) }
          : {}),
      },
    ];
  });
}

function getPosition(node, group, orbitRadii, skillsPerOrbit) {
  if (isFiniteNumber(node.x) && isFiniteNumber(node.y)) {
    return { x: node.x, y: node.y };
  }
  if (!group || !isFiniteNumber(group.x) || !isFiniteNumber(group.y)) return null;

  const orbit = Number(node.orbit);
  const orbitIndex = Number(node.orbitIndex);
  if (
    !Number.isInteger(orbit) ||
    !Number.isInteger(orbitIndex) ||
    orbit < 0 ||
    orbitIndex < 0
  ) {
    return null;
  }
  const radius = orbitRadii[orbit];
  const count = skillsPerOrbit[orbit];
  if (
    !isFiniteNumber(radius) ||
    !Number.isInteger(count) ||
    count < 1 ||
    orbitIndex >= count
  ) {
    return null;
  }
  if (orbit === 0) return { x: group.x, y: group.y };

  const angle = (Math.PI * 2 * orbitIndex) / count - Math.PI / 2;
  return {
    x: group.x + Math.cos(angle) * radius,
    y: group.y + Math.sin(angle) * radius,
  };
}

function classifyNode(node) {
  if (node.isKeystone) return "keystone";
  if (node.isNotable) return "notable";
  if (node.isMastery) return "mastery";
  if (node.isJewelSocket) return "jewel";
  if (node.isAscendancyStart) return "ascendancyStart";
  return "small";
}

function addClassStarts(node, treeNode, classStart) {
  const indices = Array.isArray(node.classStartIndex)
    ? node.classStartIndex
    : node.classStartIndex == null
      ? []
      : [node.classStartIndex];
  for (const value of indices) {
    const index = Number(value);
    if (Number.isInteger(index) && index >= 0) classStart.set(index, treeNode);
  }
}

function addEdge(from, to, nodes, edges, seen) {
  const fromKey = String(from);
  const toKey = String(to);
  if (fromKey === toKey || !nodes.has(fromKey) || !nodes.has(toKey)) return;
  const signature = fromKey < toKey ? `${fromKey}:${toKey}` : `${toKey}:${fromKey}`;
  if (seen.has(signature)) return;
  seen.add(signature);
  edges.push({ fromKey, toKey });
}

function sameAscendancy(left, right) {
  const normalize = (value) =>
    typeof value === "string" && value.trim()
      ? value.trim().toLocaleLowerCase()
      : null;
  return normalize(left.ascendancyName) === normalize(right.ascendancyName);
}

function getBounds(raw, nodeList) {
  const xs = nodeList.map((node) => node.x);
  const ys = nodeList.map((node) => node.y);
  const minX = isFiniteNumber(raw.min_x) ? Math.min(raw.min_x, ...xs) : Math.min(...xs);
  const minY = isFiniteNumber(raw.min_y) ? Math.min(raw.min_y, ...ys) : Math.min(...ys);
  const maxX = isFiniteNumber(raw.max_x) ? Math.max(raw.max_x, ...xs) : Math.max(...xs);
  const maxY = isFiniteNumber(raw.max_y) ? Math.max(raw.max_y, ...ys) : Math.max(...ys);
  const pad = 160;
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  };
}

export function normalizePoe1Tree(input, ruleset = "standard", versionId = "current") {
  const raw = asRecord(input);
  if (!VALID_RULESETS.has(ruleset)) {
    throw new Error(`Unsupported PoE1 ruleset: ${ruleset}`);
  }
  if (versionId !== "current" && !isPoe1ReleaseId(versionId)) {
    throw new Error(`Unsupported PoE1 tree version: ${versionId}`);
  }
  if (
    !raw ||
    !Array.isArray(raw.classes) ||
    !asRecord(raw.groups) ||
    !asRecord(raw.nodes) ||
    !Array.isArray(raw.constants?.orbitRadii) ||
    !Array.isArray(raw.constants?.skillsPerOrbit) ||
    !asRecord(raw.sprites)
  ) {
    throw new Error("Unsupported PoE1 skill-tree export format.");
  }

  const orbitRadii = raw.constants.orbitRadii;
  const skillsPerOrbit = raw.constants.skillsPerOrbit;
  const nodes = new Map();
  const nodeList = [];
  const classStart = new Map();

  for (const [key, rawNodeValue] of Object.entries(raw.nodes)) {
    const rawNode = asRecord(rawNodeValue);
    if (!rawNode) continue;
    const rawGroup = rawNode.group == null ? null : raw.groups[String(rawNode.group)];
    const position = getPosition(rawNode, rawGroup, orbitRadii, skillsPerOrbit);
    if (!position) continue;

    const numericSkill = Number(rawNode.skill ?? key);
    const treeNode = {
      key,
      skill: Number.isFinite(numericSkill) ? numericSkill : 0,
      name: typeof rawNode.name === "string" ? rawNode.name : "",
      kind: classifyNode(rawNode),
      x: position.x,
      y: position.y,
      groupKey: rawNode.group == null ? undefined : String(rawNode.group),
      icon: typeof rawNode.icon === "string" ? rawNode.icon : undefined,
      activeIcon:
        typeof rawNode.activeIcon === "string" ? rawNode.activeIcon : undefined,
      inactiveIcon:
        typeof rawNode.inactiveIcon === "string" ? rawNode.inactiveIcon : undefined,
      stats: stringList(rawNode.stats),
      masteryEffects: rawNode.isMastery
        ? normalizeMasteryEffects(rawNode.masteryEffects)
        : [],
      flavourText: stringList(rawNode.flavourText),
      ascendancyName:
        typeof rawNode.ascendancyName === "string"
          ? rawNode.ascendancyName
          : undefined,
      classStartIndex: rawNode.classStartIndex,
      grantedPassivePoints:
        Number.isFinite(rawNode.grantedPassivePoints)
          ? rawNode.grantedPassivePoints
          : undefined,
      isProxy: Boolean(rawNode.isProxy),
    };
    nodes.set(key, treeNode);
    if (!treeNode.isProxy) nodeList.push(treeNode);
    addClassStarts(rawNode, treeNode, classStart);
  }

  const edges = [];
  const seenEdges = new Set();
  for (const [key, rawNodeValue] of Object.entries(raw.nodes)) {
    const rawNode = asRecord(rawNodeValue);
    if (!rawNode) continue;
    for (const target of [...(rawNode.out ?? []), ...(rawNode.in ?? [])]) {
      addEdge(key, target, nodes, edges, seenEdges);
    }
  }
  const renderEdges = edges.filter((edge) => {
    const from = nodes.get(edge.fromKey);
    const to = nodes.get(edge.toKey);
    return (
      from &&
      to &&
      !from.isProxy &&
      !to.isProxy &&
      sameAscendancy(from, to)
    );
  });

  const groups = [];
  for (const [key, group] of Object.entries(raw.groups)) {
    if (!isFiniteNumber(group?.x) || !isFiniteNumber(group?.y)) continue;
    groups.push({
      key,
      x: group.x,
      y: group.y,
      orbits: Array.isArray(group.orbits)
        ? group.orbits.filter((orbit) => Number.isInteger(orbit) && orbit >= 0)
        : [],
    });
  }
  const visibleGroupKeys = new Set(
    nodeList.flatMap((node) => (node.groupKey == null ? [] : [node.groupKey])),
  );
  const renderGroups = groups.filter((group) => visibleGroupKeys.has(group.key));

  if (nodeList.length === 0) {
    throw new Error("The PoE1 skill-tree export contains no renderable nodes.");
  }

  return {
    game: "poe1",
    ruleset,
    datasetId: getPoe1DatasetId(versionId, ruleset),
    versionId,
    version: typeof raw.tree === "string" ? raw.tree : "Default",
    nodes,
    nodeList,
    edges,
    renderEdges,
    groups,
    renderGroups,
    classes: raw.classes,
    sprites: raw.sprites,
    orbitRadii,
    classStart,
    adjacency: createAdjacency(
      nodeList.map((node) => node.key),
      renderEdges,
    ),
    bounds: getBounds(raw, nodeList),
  };
}
