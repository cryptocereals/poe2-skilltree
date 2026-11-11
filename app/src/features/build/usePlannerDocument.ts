import { useCallback, useEffect, useState } from "react";
import {
  emptyDoc,
  type BuildInventorySlot,
  type BuildSkill,
  type PlannerDoc,
} from "../../lib/buildFile";
import type { Tag } from "../../lib/buildState";

export function usePlannerDocument(
  planner: boolean,
  alloc: Map<string, Tag>,
  ascAlloc: Set<string>,
) {
  const [doc, setDoc] = useState<PlannerDoc>(emptyDoc);

  const resetDoc = useCallback(() => setDoc(emptyDoc()), []);
  const setDocField = useCallback(
    (field: "name" | "author" | "description", value: string) => {
      setDoc((current) => ({ ...current, [field]: value }));
    },
    [],
  );
  const setInventory = useCallback((inventory: BuildInventorySlot[]) => {
    setDoc((current) => ({ ...current, inventory }));
  }, []);
  const setSkills = useCallback((skills: BuildSkill[]) => {
    setDoc((current) => ({ ...current, skills }));
  }, []);
  const setNote = useCallback((key: string, text: string) => {
    setDoc((current) => ({
      ...current,
      notes: { ...current.notes, [key]: text },
    }));
  }, []);

  useEffect(() => {
    if (!planner) return;
    setDoc((current) => {
      let changed = false;
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(current.notes)) {
        if (alloc.has(key) || ascAlloc.has(key)) next[key] = value;
        else changed = true;
      }
      return changed ? { ...current, notes: next } : current;
    });
  }, [planner, alloc, ascAlloc]);

  return { doc, setDoc, resetDoc, setDocField, setInventory, setSkills, setNote };
}
