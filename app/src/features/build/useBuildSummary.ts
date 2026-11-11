import { useMemo } from "react";
import type { BuildState } from "../../lib/buildState";
import type { ParsedTree } from "../../types";

interface Inputs {
  tree: ParsedTree | null;
  build: BuildState;
  notes: Record<string, string>;
}

export function useBuildSummary({ tree, build, notes }: Inputs) {
  const { selectedClass, selectedAsc, alloc, ascAlloc } = build;
  const startKey =
    selectedClass != null && tree ? tree.classStart.get(selectedClass)?.key ?? null : null;

  const allocated = useMemo(() => {
    const keys = new Set<string>();
    if (!tree) return keys;
    alloc.forEach((_tag, key) => keys.add(key));
    ascAlloc.forEach((key) => keys.add(key));
    if (startKey) keys.add(startKey);
    if (selectedAsc) {
      const start = tree.ascStart.get(selectedAsc);
      if (start) keys.add(start.key);
    }
    return keys;
  }, [tree, alloc, ascAlloc, startKey, selectedAsc]);

  const weaponTag = useMemo(() => {
    const tags = new Map<string, 1 | 2>();
    alloc.forEach((tag, key) => tag !== 0 && tags.set(key, tag as 1 | 2));
    return tags;
  }, [alloc]);

  const ascOffset = useMemo(() => {
    if (!selectedAsc || !tree) return null;
    const box = tree.ascBox.get(selectedAsc);
    if (!box) return null;
    return {
      dx: -((box.minX + box.maxX) / 2),
      dy: -((box.minY + box.maxY) / 2),
    };
  }, [selectedAsc, tree]);

  const ascAngle = useMemo(() => {
    if (!selectedAsc || !tree) return null;
    const box = tree.ascBox.get(selectedAsc);
    if (!box) return null;
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    const raw = Math.atan2(cx, -cy) - Math.PI / 6;
    const step = Math.PI / 3;
    return Math.round(raw / step) * step;
  }, [selectedAsc, tree]);

  const bonus = useMemo(() => {
    if (!tree) return 0;
    let total = 0;
    const add = (key: string) => {
      const granted = tree.nodes.get(key)?.grantedPassivePoints;
      if (granted) total += granted;
    };
    alloc.forEach((_tag, key) => add(key));
    ascAlloc.forEach(add);
    return total;
  }, [tree, alloc, ascAlloc]);

  const setCounts = useMemo(() => {
    let set1 = 0;
    let set2 = 0;
    alloc.forEach((tag) => (tag === 1 ? set1++ : tag === 2 ? set2++ : 0));
    return [set1, set2] as const;
  }, [alloc]);
  const mainUsed = alloc.size - Math.min(setCounts[0], setCounts[1]);

  const ascUsed = useMemo(() => {
    if (!tree) return 0;
    let total = 0;
    ascAlloc.forEach((key) => {
      if (!tree.nodes.get(key)?.mcOption) total++;
    });
    return total;
  }, [tree, ascAlloc]);

  const notesNodes = useMemo(() => {
    if (!tree) return [] as { key: string; name: string; asc: boolean }[];
    const out: { key: string; name: string; asc: boolean }[] = [];
    const add = (key: string) => {
      const node = tree.nodes.get(key);
      if (
        node &&
        node.name &&
        (node.kind === "notable" || node.kind === "keystone" || node.kind === "ascNotable")
      ) {
        out.push({ key, name: node.name, asc: node.kind === "ascNotable" });
      }
    };
    alloc.forEach((_tag, key) => add(key));
    ascAlloc.forEach(add);
    return out;
  }, [tree, alloc, ascAlloc]);

  const notedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const [key, value] of Object.entries(notes)) {
      if (value.trim()) keys.add(key);
    }
    return keys;
  }, [notes]);

  const selectedClassName =
    selectedClass != null && tree ? tree.classes[selectedClass]?.name ?? null : null;
  const activeOverrides =
    selectedClass != null && tree ? tree.classOverrides.get(selectedClass) ?? null : null;

  return {
    allocated,
    weaponTag,
    ascOffset,
    ascAngle,
    bonus,
    setCounts,
    mainUsed,
    ascUsed,
    notesNodes,
    notedKeys,
    ascPrefixForClass: selectedClassName,
    activeOverrides,
    className: selectedClassName ?? undefined,
  };
}
