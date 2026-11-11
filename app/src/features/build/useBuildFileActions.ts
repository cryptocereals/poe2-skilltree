import { useCallback, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { BuildAction, Tag } from "../../lib/buildState";
import {
  downloadBuild,
  exportBuild,
  parseBuildFile,
  type ParsedBuild,
  type PlannerDoc,
} from "../../lib/buildFile";
import { importPobString } from "../../lib/pobImport";
import { isPobExport } from "../../lib/pobDecode";
import { loadPoeDb } from "../../lib/poedb";
import type { ParsedTree } from "../../types";

interface Inputs {
  tree: ParsedTree | null;
  alloc: Map<string, Tag>;
  ascAlloc: Set<string>;
  selectedAsc: string | null;
  doc: PlannerDoc;
  setDoc: Dispatch<SetStateAction<PlannerDoc>>;
  dispatch: Dispatch<BuildAction>;
  goTo: (x: number, y: number, zoom?: number) => void;
  resetView: () => void;
  setPobModalOpen: Dispatch<SetStateAction<boolean>>;
}

export function useBuildFileActions({
  tree,
  alloc,
  ascAlloc,
  selectedAsc,
  doc,
  setDoc,
  dispatch,
  goTo,
  resetView,
  setPobModalOpen,
}: Inputs) {
  const currentTree = useRef(tree);
  currentTree.current = tree;

  const onExport = useCallback(() => {
    const exportTree = tree;
    if (!exportTree) return;
    void loadPoeDb()
      .then((db) => {
        if (currentTree.current !== exportTree) return;
        downloadBuild(exportBuild(exportTree, alloc, ascAlloc, selectedAsc, doc, db));
      })
      .catch((error: unknown) => {
        if (currentTree.current === exportTree) {
          alert("Could not export build: " + (error instanceof Error ? error.message : String(error)));
        }
      });
  }, [tree, alloc, ascAlloc, selectedAsc, doc]);

  const applyParsedBuild = useCallback(
    (parsed: ParsedBuild, targetTree: ParsedTree) => {
      dispatch({
        type: "load",
        selectedClass: parsed.selectedClass,
        selectedAsc: parsed.selectedAsc,
        alloc: parsed.alloc,
        ascAlloc: parsed.ascAlloc,
      });
      setDoc(parsed.doc);
      const start =
        parsed.selectedClass != null ? targetTree.classStart.get(parsed.selectedClass) : null;
      if (start) goTo(start.x, start.y, 0.3);
      else resetView();
    },
    [dispatch, setDoc, goTo, resetView],
  );

  const onImport = useCallback(
    async (file: File) => {
      const importTree = tree;
      if (!importTree) return;

      try {
        const text = await file.text();
        if (currentTree.current !== importTree) return;
        if (isPobExport(text.trim())) {
          const result = await importPobString(text.trim(), importTree);
          if (currentTree.current !== importTree) return;
          applyParsedBuild(result, importTree);
          if (result.warnings.length > 0) {
            console.warn("[PoB import]", result.warnings.join("\n"));
          }
        } else {
          const db = await loadPoeDb();
          if (currentTree.current !== importTree) return;
          const parsed = parseBuildFile(text, importTree, db);
          applyParsedBuild(parsed, importTree);
        }
      } catch (error) {
        if (currentTree.current === importTree) {
          alert("Could not read that file: " + (error instanceof Error ? error.message : String(error)));
        }
      }
    },
    [tree, applyParsedBuild],
  );

  const onPobString = useCallback(
    async (value: string) => {
      const importTree = tree;
      if (!importTree) throw new Error("Tree not loaded yet");
      const result = await importPobString(value, importTree);
      if (currentTree.current !== importTree) return;
      applyParsedBuild(result, importTree);
      setPobModalOpen(false);
      if (result.warnings.length > 0) {
        setTimeout(() => {
          console.warn("[PoB import warnings]\n" + result.warnings.join("\n"));
        }, 0);
      }
    },
    [tree, applyParsedBuild, setPobModalOpen],
  );

  return { onExport, onImport, onPobString };
}
