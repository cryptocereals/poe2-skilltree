// PoE2 `.build` file (pathofexile.com/developer/docs/game). JSON authored here
// and dropped into the game's Preferences/BuildPlanner folder.
import { reach } from "./allocation";
import type { ParsedTree } from "../types";
import type { Tag } from "./buildState";

export interface BuildInventorySlot {
  inventory_id: string;
  unique?: string;
  hint?: string;
}

export interface BuildSkill {
  id: string;
  supports?: string[];
  additional_text?: string;
}

export type BuildPassiveEntry = string | { id: string; weapon_set?: number };

export interface BuildBody {
  name: string;
  author?: string;
  description?: string;
  ascendancy?: string;
  passives?: BuildPassiveEntry[];
  skills?: BuildSkill[];
  inventory_slots?: BuildInventorySlot[];
}

// The docs describe a root object named `Build`; we emit { Build: {...} } and
// accept either that or a bare body on import.
export interface BuildFile {
  Build: BuildBody;
}

/** Editable metadata + gear/skills the wizard collects (passives live in the tree). */
export interface PlannerDoc {
  name: string;
  author: string;
  description: string;
  inventory: BuildInventorySlot[];
  skills: BuildSkill[];
}

export const emptyDoc = (): PlannerDoc => ({
  name: "",
  author: "",
  description: "",
  inventory: [],
  skills: [],
});

function idToKeyMap(tree: ParsedTree): Map<string, string> {
  const m = new Map<string, string>();
  for (const n of tree.nodeList) if (n.id) m.set(n.id, n.key);
  return m;
}

/** Assemble a `.build` file from current planner + tree state. */
export function exportBuild(
  tree: ParsedTree,
  alloc: Map<string, Tag>,
  ascAlloc: Set<string>,
  selectedAsc: string | null,
  doc: PlannerDoc
): BuildFile {
  const passives: BuildPassiveEntry[] = [];
  for (const [key, tag] of alloc) {
    const id = tree.nodes.get(key)?.id;
    if (!id) continue;
    passives.push(tag === 0 ? id : { id, weapon_set: tag });
  }
  for (const key of ascAlloc) {
    const id = tree.nodes.get(key)?.id;
    if (id) passives.push(id);
  }

  const body: BuildBody = { name: doc.name.trim() || "Untitled Build" };
  if (doc.author.trim()) body.author = doc.author.trim();
  if (doc.description.trim()) body.description = doc.description.trim();
  if (selectedAsc) body.ascendancy = selectedAsc;
  if (passives.length) body.passives = passives;
  const skills = doc.skills.filter((s) => s.id.trim());
  if (skills.length) body.skills = skills;
  const inv = doc.inventory.filter((s) => s.unique?.trim() || s.hint?.trim());
  if (inv.length) body.inventory_slots = inv;

  return { Build: body };
}

export interface ParsedBuild {
  selectedClass: number | null;
  selectedAsc: string | null;
  alloc: Map<string, Tag>;
  ascAlloc: Set<string>;
  doc: PlannerDoc;
}

/** Parse an imported `.build` into app state. Throws on malformed JSON. */
export function parseBuildFile(text: string, tree: ParsedTree): ParsedBuild {
  const json = JSON.parse(text);
  const body: BuildBody = json && json.Build ? json.Build : json;
  if (!body || typeof body !== "object") throw new Error("Not a build file");

  const idToKey = idToKeyMap(tree);
  const alloc = new Map<string, Tag>();
  const ascAlloc = new Set<string>();

  for (const entry of body.passives ?? []) {
    const id = typeof entry === "string" ? entry : entry.id;
    const ws = typeof entry === "string" ? 0 : entry.weapon_set ?? 0;
    const key = idToKey.get(id);
    if (!key) continue;
    if (tree.nodes.get(key)?.ascendancyId) ascAlloc.add(key);
    else alloc.set(key, (ws === 1 || ws === 2 ? ws : 0) as Tag);
  }

  const selectedAsc = body.ascendancy ?? null;
  const selectedClass = inferClass(tree, selectedAsc, alloc);

  const doc: PlannerDoc = {
    name: body.name ?? "",
    author: body.author ?? "",
    description: body.description ?? "",
    inventory: Array.isArray(body.inventory_slots) ? body.inventory_slots : [],
    skills: Array.isArray(body.skills) ? body.skills : [],
  };

  return { selectedClass, selectedAsc, alloc, ascAlloc, doc };
}

/** Class from the ascendancy prefix, else the class start that best reaches the allocation. */
function inferClass(tree: ParsedTree, asc: string | null, alloc: Map<string, Tag>): number | null {
  if (asc) {
    const m = asc.match(/^([A-Za-z]+)\d+$/);
    if (m) {
      const idx = tree.classes.findIndex((c) => c.name === m[1]);
      if (idx >= 0) return idx;
    }
  }
  if (alloc.size === 0) return null;
  let best: number | null = null;
  let bestHits = -1;
  for (const [idx, start] of tree.classStart) {
    const r = reach(tree.adjacency, start.key, (k) => alloc.has(k));
    let hits = 0;
    alloc.forEach((_t, k) => r.has(k) && hits++);
    if (hits > bestHits) {
      bestHits = hits;
      best = idx;
    }
  }
  return best;
}

/** Trigger a download of the build as `<name>.build`. */
export function downloadBuild(file: BuildFile): void {
  const name = (file.Build.name || "build").replace(/[^\w.-]+/g, "_");
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.build`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
