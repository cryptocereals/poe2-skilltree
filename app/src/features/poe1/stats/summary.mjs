import { getPoe1MasteryEffect } from "../allocation/model.mjs";
import { aggregateTreeStats } from "../../sharedTree/stats/aggregateTreeStats.mjs";

export function getPoe1EffectiveNode(node, effectId) {
  if (!node) return node;
  const effect =
    node.kind === "mastery"
      ? getPoe1MasteryEffect(node, effectId)
      : null;
  if (!effect) return node;

  return {
    ...node,
    stats: [...(node.stats ?? []), ...effect.stats],
    selectedMasteryEffect: {
      ...effect,
      stats: [...effect.stats],
      ...(Array.isArray(effect.reminderText)
        ? { reminderText: [...effect.reminderText] }
        : {}),
    },
  };
}

export function summarizePoe1Allocation(tree, state) {
  if (
    typeof tree.datasetId === "string" &&
    state.datasetId !== tree.datasetId
  ) {
    return { rows: [], masteryEffects: [] };
  }

  const keys = [...new Set([...state.mainAlloc, ...state.ascAlloc])];
  const effectiveNodes = new Map(tree.nodes);
  const baseStatsOverrides = new Map();
  const masteryEffects = [];
  const usedEffectIds = new Set();
  const choices =
    state.masteryChoices instanceof Map ? state.masteryChoices : new Map();

  for (const key of state.mainAlloc) {
    const node = tree.nodes.get(key);
    if (node?.kind !== "mastery") continue;
    const effectId = choices.get(key);
    const effect = getPoe1MasteryEffect(node, effectId);
    if (!effect || usedEffectIds.has(effectId)) continue;

    usedEffectIds.add(effectId);
    const effectiveNode = getPoe1EffectiveNode(node, effectId);
    effectiveNodes.set(key, effectiveNode);
    baseStatsOverrides.set(key, { stats: node.stats ?? [] });
    masteryEffects.push({
      key,
      name: node.name || "Mastery",
      effectId,
      stats: [...effect.stats],
      reminderText: Array.isArray(effect.reminderText)
        ? [...effect.reminderText]
        : [],
    });
  }

  return {
    rows: aggregateTreeStats(effectiveNodes, keys, baseStatsOverrides),
    masteryEffects,
  };
}
